/**
 * Procurement Officer Directory route shell (TASK-1.5).
 *
 * Wires the single sync runner to the route and renders honest sync state.
 * The search surface (TASK-1.6) replaces the placeholder body; the
 * dedicated FeatureOff / EntitlementMissing screens arrive in TASK-1.9,
 * but the status line below already distinguishes the two terminal states.
 */

import { useState } from "react";
import type { SqlExecutor } from "../../db/executor";
import { tauriSqlExecutor } from "../../db/tauri-sql-executor";
import type { OfficerSyncFeed } from "../../services/sync/procurement-officers-sync";
import type { WorkspaceOwnerId } from "../../services/storage/workspace-owner";
import { useOfficerSync } from "./use-officer-sync";

export interface ProcurementOfficerDirectoryProps {
  feed: OfficerSyncFeed;
  executor?: SqlExecutor;
  ownerId?: WorkspaceOwnerId;
}

export function ProcurementOfficerDirectory({
  feed,
  executor = tauriSqlExecutor,
  ownerId,
}: ProcurementOfficerDirectoryProps) {
  const sync = useOfficerSync(feed, executor, ownerId);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await sync.refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const statusLine =
    sync.phase === "syncing"
      ? "Syncing the local directory…"
      : sync.phase === "failed"
        ? "Sync failed — showing the last synced directory."
        : sync.lastSyncAt
          ? `Last synced ${formatSyncTime(sync.lastSyncAt)}.`
          : "No sync has run yet.";

  return (
    <section aria-labelledby="procurement-officers-heading">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 id="procurement-officers-heading" className="text-2xl font-semibold">
            Procurement Officers
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            Official procurement contacts, compiled from published tender
            documents.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing || sync.phase === "syncing"}
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          {refreshing || sync.phase === "syncing" ? "Syncing…" : "Sync now"}
        </button>
      </header>

      {sync.featureState === "off" ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">Directory not enabled</p>
          <p className="mt-1 text-foreground/70">
            The Procurement Officers directory is not enabled for your
            workspace yet. Check back later.
          </p>
        </div>
      ) : sync.featureState === "entitlement-missing" ? (
        <div className="rounded-md border border-orange-300 bg-orange-50 p-4 text-sm">
          <p className="font-medium">Not included in your plan</p>
          <p className="mt-1 text-foreground/70">
            Procurement officer data is not part of your current plan. Your
            last synced directory remains available in read-only form.
          </p>
        </div>
      ) : (
        <div className="rounded-md border p-6 text-center text-sm text-foreground/60">
          <p>Officer search is coming next.</p>
          <p className="mt-1">{statusLine}</p>
        </div>
      )}
    </section>
  );
}

function formatSyncTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}