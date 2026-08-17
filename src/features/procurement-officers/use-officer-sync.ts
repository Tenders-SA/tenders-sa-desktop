/**
 * Single-instance sync driver for the Procurement Officer Directory
 * (design.md "Sync runner"): one runner per account, boot sync, 15-minute
 * cadence, manual refresh. The runner itself already refuses overlapping
 * runs; the registry makes "one runner" hold across remounts.
 */

import { useEffect, useRef, useState } from "react";
import type { SqlExecutor } from "../../db/executor";
import { getSyncState } from "../../db/repositories/procurement-officers";
import {
  OfficerSyncRunner,
  type OfficerFeatureState,
  type OfficerSyncFeed,
  type OfficerSyncOutcome,
} from "../../services/sync/procurement-officers-sync";

export type OfficerSyncPhase =
  | "idle"
  | "syncing"
  | "off"
  | "entitlement-missing"
  | "failed";

export interface OfficerSyncView {
  phase: OfficerSyncPhase;
  lastSyncAt: string | null;
  featureState: OfficerFeatureState;
  refresh: () => Promise<OfficerSyncOutcome>;
}

const SYNC_CADENCE_MS = 15 * 60_000;

interface RegisteredRunner {
  runner: OfficerSyncRunner;
  feed: OfficerSyncFeed;
  executor: SqlExecutor;
}

const registeredRunners = new Map<string, RegisteredRunner>();

/**
 * One runner per account (design.md §Performance: "one runner, no
 * overlapping syncs"). Reuses the registered instance while the feed and
 * executor references are unchanged; replaces it when the wiring changes
 * (re-login, test re-injection).
 */
export function getOfficerSyncRunner(
  ownerId: string,
  feed: OfficerSyncFeed,
  executor: SqlExecutor,
): OfficerSyncRunner {
  const existing = registeredRunners.get(ownerId);
  if (existing && existing.feed === feed && existing.executor === executor) {
    return existing.runner;
  }
  const runner = new OfficerSyncRunner({ feed, executor, ownerId });
  registeredRunners.set(ownerId, { runner, feed, executor });
  return runner;
}

/** Test-only: resets the per-account registry between test cases. */
export function resetOfficerSyncRunnersForTesting(): void {
  registeredRunners.clear();
}

export function useOfficerSync(
  feed: OfficerSyncFeed,
  executor: SqlExecutor,
  ownerId?: string,
): OfficerSyncView {
  const [view, setView] = useState<OfficerSyncView>({
    phase: "idle",
    lastSyncAt: null,
    featureState: "active",
    refresh: () => Promise.resolve({
      featureState: "active",
      appliedRows: 0,
      tombstones: 0,
      pages: 0,
    }),
  });
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    if (!ownerId) return;
    const runner = getOfficerSyncRunner(ownerId, feed, executor);
    let active = true;

    const run = async (): Promise<OfficerSyncOutcome> => {
      if (!active) {
        return { featureState: "active", appliedRows: 0, tombstones: 0, pages: 0 };
      }
      setView((prev) => ({ ...prev, phase: "syncing" }));
      const outcome = await runner.sync();
      if (!active) return outcome;

      const lastSyncAt =
        outcome.featureState === "active"
          ? (await getSyncState(executor, ownerId).catch(() => undefined))
              ?.last_sync_at ?? null
          : viewRef.current.lastSyncAt;

      setView({
        phase:
          outcome.featureState === "active"
            ? outcome.error
              ? "failed"
              : "idle"
            : outcome.featureState,
        lastSyncAt,
        featureState: outcome.featureState,
        refresh: run,
      });
      return outcome;
    };

    const refresh = () => run();
    setView((prev) => ({ ...prev, refresh }));

    void run().catch(() => {
      if (active) {
        setView((prev) => ({ ...prev, phase: "failed" }));
      }
    });
    const interval = window.setInterval(() => void run(), SYNC_CADENCE_MS);
    window.addEventListener("online", refresh);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("online", refresh);
    };
  }, [feed, executor, ownerId]);

  return view;
}