import type { SqlExecutor } from "../../db/executor";
import type { SyncConflictRow } from "../../db/schema/types";

export interface NewSyncConflict {
  id: string;
  syncOperationId: string;
  entityType: string;
  entityId: string;
  localVersion: string;
  remoteVersion: string;
  fieldPolicy?: string;
}

/**
 * Entity types whose conflicts must never be auto-resolved by any
 * policy -- a human decides (REQ-7, design.md: "Proposal and pricing
 * conflicts require explicit resolution and preserve both versions").
 */
const HUMAN_RESOLUTION_ONLY: readonly string[] = ["proposal", "pricing"];

export function requiresHumanResolution(entityType: string): boolean {
  return HUMAN_RESOLUTION_ONLY.includes(entityType);
}

/**
 * Records a conflict with both versions preserved. There is
 * deliberately no "overwrite" path here: resolution is a separate,
 * explicit act (see `resolveConflict` in state-machine.ts), and both
 * local_version and remote_version stay on the row afterwards for
 * audit.
 */
export async function recordConflict(
  executor: SqlExecutor,
  conflict: NewSyncConflict,
  now: string = new Date().toISOString(),
): Promise<void> {
  await executor.execute(
    `INSERT INTO sync_conflicts
       (id, sync_operation_id, entity_type, entity_id, local_version, remote_version, field_policy, resolution_state, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'unresolved', $8)`,
    [
      conflict.id,
      conflict.syncOperationId,
      conflict.entityType,
      conflict.entityId,
      conflict.localVersion,
      conflict.remoteVersion,
      conflict.fieldPolicy ?? null,
      now,
    ],
  );
}

export async function listUnresolvedConflicts(
  executor: SqlExecutor,
): Promise<SyncConflictRow[]> {
  return executor.select<SyncConflictRow[]>(
    "SELECT * FROM sync_conflicts WHERE resolution_state = 'unresolved' ORDER BY created_at ASC",
  );
}

export async function markConflictResolved(
  executor: SqlExecutor,
  id: string,
  resolution: "resolved_local" | "resolved_remote" | "resolved_merged",
  now: string = new Date().toISOString(),
): Promise<void> {
  await executor.execute(
    `UPDATE sync_conflicts
     SET resolution_state = $1, resolved_at = $2
     WHERE id = $3 AND resolution_state = 'unresolved'`,
    [resolution, now, id],
  );
}
