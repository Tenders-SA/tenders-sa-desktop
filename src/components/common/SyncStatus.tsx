import { useSyncExternalStore } from "react";
import { useConnectivity } from "../../hooks/use-connectivity";
import { useWorkspaceRuntime } from "../../services/storage/workspace-runtime-context";
import { EMPTY_WORKSPACE_SYNC_SUMMARY } from "../../services/storage/workspace-status";

export interface SyncStatusProps {
  /** Pending offline operations, from TASK-0.6's queue. */
  pendingCount?: number;
  /** Conflicts awaiting human resolution (REL-2). */
  conflictCount?: number;
}

/**
 * Connectivity and sync indicator (REQ-2, REL-2).
 *
 * Status is never conveyed by colour alone: each state carries a text
 * label, satisfying the design system's rule for status signalling.
 */
export function SyncStatus({ pendingCount, conflictCount }: SyncStatusProps) {
  const connectivity = useConnectivity();
  const workspace = useWorkspaceRuntime();
  const workspaceSummary = useSyncExternalStore(
    workspace?.status.subscribe ?? (() => () => undefined),
    workspace?.status.getSnapshot ?? (() => EMPTY_WORKSPACE_SYNC_SUMMARY),
  );
  const pending = pendingCount ?? workspaceSummary.pendingCount;
  const conflicts = conflictCount ?? workspaceSummary.conflictCount;

  const parts: string[] = [connectivity === "online" ? "Online" : "Offline"];
  if (workspaceSummary.phase === "syncing") {
    parts.push("Syncing");
  }
  if (workspaceSummary.phase === "failed") {
    parts.push("Sync failed");
  }
  if (pending > 0) {
    parts.push(`${pending} pending`);
  }
  if (conflicts > 0) {
    parts.push(`${conflicts} needing review`);
  }

  return (
    <output
      aria-live="polite"
      aria-label="Connectivity and sync status"
      className="flex items-center gap-2 text-sm"
    >
      <span
        aria-hidden="true"
        className={[
          "size-2 rounded-full",
          connectivity === "online" ? "bg-success" : "bg-warning",
        ].join(" ")}
      />
      <span
        className={conflicts > 0 ? "text-warning" : "text-muted-foreground"}
      >
        {parts.join(" · ")}
      </span>
    </output>
  );
}
