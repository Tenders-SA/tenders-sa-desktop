import type { SqlExecutor } from "../executor";
import type { SyncOperationRow, SyncOperationStatus } from "../schema/types";

export interface NewSyncOperation {
  ownerId: string;
  id: string;
  idempotencyKey: string;
  entityType: string;
  entityId: string;
  operationType: string;
  payload: string;
  dependsOn?: string;
}

export function scopedSyncIdempotencyKey(
  ownerId: string,
  idempotencyKey: string,
): string {
  if (
    idempotencyKey.startsWith(`${ownerId}:`) ||
    idempotencyKey.includes(`:${ownerId}:`)
  ) {
    return idempotencyKey;
  }
  return `${ownerId}:${idempotencyKey}`;
}

/**
 * Idempotent enqueue: a duplicate idempotencyKey is a no-op (REQ-7),
 * not an error, so callers can safely retry enqueueing without
 * double-submitting the same mutation.
 */
export async function enqueueSyncOperation(
  executor: SqlExecutor,
  op: NewSyncOperation,
  now: string = new Date().toISOString(),
): Promise<void> {
  await executor.execute(
    `INSERT INTO sync_operations
       (id, idempotency_key, entity_type, entity_id, operation_type, payload, depends_on, status, attempt_count, created_at, updated_at, owner_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 0, $8, $8, $9)
     ON CONFLICT(idempotency_key) DO NOTHING`,
    [
      op.id,
      scopedSyncIdempotencyKey(op.ownerId, op.idempotencyKey),
      op.entityType,
      op.entityId,
      op.operationType,
      op.payload,
      op.dependsOn ?? null,
      now,
      op.ownerId,
    ],
  );
}

/**
 * Upsert variant used by the response-document local store (Slice 10,
 * LD-2): re-enqueueing a save for the same (application, key) replaces
 * the pending payload with the latest content and revives the operation
 * to pending, so an offline edit is never shadowed by an older one.
 */
export async function upsertSyncOperation(
  executor: SqlExecutor,
  op: NewSyncOperation,
  now: string = new Date().toISOString(),
): Promise<void> {
  await executor.execute(
    `INSERT INTO sync_operations
       (id, idempotency_key, entity_type, entity_id, operation_type, payload, depends_on, status, attempt_count, created_at, updated_at, owner_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 0, $8, $8, $9)
     ON CONFLICT(idempotency_key) DO UPDATE SET
       id = excluded.id,
       entity_type = excluded.entity_type,
       entity_id = excluded.entity_id,
       operation_type = excluded.operation_type,
       payload = excluded.payload,
       depends_on = excluded.depends_on,
       status = 'pending',
       attempt_count = 0,
       last_error = NULL,
       updated_at = excluded.updated_at`,
    [
      op.id,
      scopedSyncIdempotencyKey(op.ownerId, op.idempotencyKey),
      op.entityType,
      op.entityId,
      op.operationType,
      op.payload,
      op.dependsOn ?? null,
      now,
      op.ownerId,
    ],
  );
}

export async function listPendingSyncOperations(
  executor: SqlExecutor,
  ownerId: string,
): Promise<SyncOperationRow[]> {
  return executor.select<SyncOperationRow[]>(
    "SELECT * FROM sync_operations WHERE owner_id = $1 AND status = 'pending' ORDER BY created_at ASC",
    [ownerId],
  );
}

export async function updateSyncOperationStatus(
  executor: SqlExecutor,
  ownerId: string,
  id: string,
  status: SyncOperationStatus,
  options: { attemptCount?: number; lastError?: string } = {},
  now: string = new Date().toISOString(),
): Promise<void> {
  await executor.execute(
    `UPDATE sync_operations
     SET status = $1, attempt_count = COALESCE($2, attempt_count), last_error = $3, updated_at = $4
     WHERE owner_id = $5 AND id = $6`,
    [
      status,
      options.attemptCount ?? null,
      options.lastError ?? null,
      now,
      ownerId,
      id,
    ],
  );
}
