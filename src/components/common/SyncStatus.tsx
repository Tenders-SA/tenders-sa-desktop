import { useConnectivity } from "../../hooks/use-connectivity";

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
export function SyncStatus({
  pendingCount = 0,
  conflictCount = 0,
}: SyncStatusProps) {
  const connectivity = useConnectivity();

  const parts: string[] = [connectivity === "online" ? "Online" : "Offline"];
  if (pendingCount > 0) {
    parts.push(`${pendingCount} pending`);
  }
  if (conflictCount > 0) {
    parts.push(`${conflictCount} needing review`);
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
        className={conflictCount > 0 ? "text-warning" : "text-muted-foreground"}
      >
        {parts.join(" · ")}
      </span>
    </output>
  );
}
