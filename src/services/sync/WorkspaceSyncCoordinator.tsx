import { useEffect } from "react";
import type { ApplicationsEndpoint } from "../api/endpoints/applications";
import { createTauriResponseDocStore } from "../storage/response-doc-store";
import type { WorkspaceOwnerId } from "../storage/workspace-owner";
import { tauriSqlExecutor } from "../../db/tauri-sql-executor";
import { listPendingSyncOperations } from "../../db/repositories/sync-operations";
import { listUnresolvedConflicts } from "./conflicts";
import { useWorkspaceRuntime } from "../storage/workspace-runtime-context";

const RETRY_DELAYS_MS = [5_000, 30_000, 120_000] as const;

export function WorkspaceSyncCoordinator({
  ownerId,
  applications,
}: {
  ownerId?: WorkspaceOwnerId;
  applications: ApplicationsEndpoint;
}) {
  const workspace = useWorkspaceRuntime();
  useEffect(() => {
    if (!ownerId || !workspace) return;
    const store = createTauriResponseDocStore(ownerId);
    let active = true;
    let running = false;
    let retryIndex = 0;
    let retryTimer: number | undefined;
    let controller: AbortController | undefined;

    const refreshSummary = async (phase: "idle" | "syncing" | "failed") => {
      const [pending, conflicts] = await Promise.all([
        listPendingSyncOperations(tauriSqlExecutor, ownerId),
        listUnresolvedConflicts(tauriSqlExecutor, ownerId),
      ]);
      if (active) {
        workspace.status.update({
          phase,
          pendingCount: pending.length,
          conflictCount: conflicts.length,
        });
      }
      return pending.length;
    };

    const flush = () => {
      if (!active || running) return;
      running = true;
      controller = new AbortController();
      workspace.status.update({ phase: "syncing" });
      const remoteBlueprints = new Map<
        string,
        Promise<Record<string, string> | undefined>
      >();
      void store
        .replayPendingSaves(
          (applicationId, documentKey, content) =>
            applications
              .saveResponseDocument(
                applicationId,
                documentKey,
                content,
                controller?.signal,
              )
              .then(() => undefined),
          async (applicationId, documentKey) => {
            let request = remoteBlueprints.get(applicationId);
            if (!request) {
              request = applications
                .getResponseBlueprint(applicationId, controller?.signal)
                .then((payload) => payload.responseDocs);
              remoteBlueprints.set(applicationId, request);
            }
            return (await request)?.[documentKey];
          },
        )
        .then(async () => {
          const pending = await refreshSummary("idle");
          if (pending === 0) retryIndex = 0;
          if (pending > 0 && active && navigator.onLine) {
            const delay =
              RETRY_DELAYS_MS[Math.min(retryIndex, RETRY_DELAYS_MS.length - 1)];
            retryIndex += 1;
            retryTimer = window.setTimeout(flush, delay);
          }
        })
        .catch(async () => {
          await refreshSummary("failed").catch(() => undefined);
        })
        .finally(() => {
          running = false;
        });
    };
    flush();
    window.addEventListener("online", flush);
    return () => {
      active = false;
      controller?.abort();
      window.removeEventListener("online", flush);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [applications, ownerId, workspace]);

  return null;
}
