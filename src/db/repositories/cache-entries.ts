import type { SqlExecutor } from "../executor";
import type { CacheEntryRow } from "../schema/types";

export interface NewCacheEntry {
  ownerId: string;
  key: string;
  entityType: string;
  entityId: string;
  etag?: string;
  payload: string;
  encrypted: boolean;
  expiresAt?: string;
}

export async function upsertCacheEntry(
  executor: SqlExecutor,
  entry: NewCacheEntry,
  now: string = new Date().toISOString(),
): Promise<void> {
  await executor.execute(
    `INSERT INTO cache_entries
       (key, entity_type, entity_id, etag, payload, encrypted, expires_at, created_at, updated_at, owner_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT(key) DO UPDATE SET
       entity_type = excluded.entity_type,
       entity_id = excluded.entity_id,
       etag = excluded.etag,
       payload = excluded.payload,
       encrypted = excluded.encrypted,
       expires_at = excluded.expires_at,
       updated_at = excluded.updated_at`,
    [
      scopedCacheKey(entry.ownerId, entry.key),
      entry.entityType,
      entry.entityId,
      entry.etag ?? null,
      entry.payload,
      entry.encrypted ? 1 : 0,
      entry.expiresAt ?? null,
      now,
      now,
      entry.ownerId,
    ],
  );
}

export async function getCacheEntry(
  executor: SqlExecutor,
  ownerId: string,
  key: string,
): Promise<CacheEntryRow | undefined> {
  const rows = await executor.select<CacheEntryRow[]>(
    "SELECT * FROM cache_entries WHERE owner_id = $1 AND key = $2",
    [ownerId, scopedCacheKey(ownerId, key)],
  );
  return rows[0];
}

function scopedCacheKey(ownerId: string, key: string): string {
  return `${ownerId}:${key}`;
}

export async function deleteExpiredCacheEntries(
  executor: SqlExecutor,
  ownerId: string,
  nowIso: string,
): Promise<number> {
  const result = await executor.execute(
    "DELETE FROM cache_entries WHERE owner_id = $1 AND expires_at IS NOT NULL AND expires_at < $2",
    [ownerId, nowIso],
  );
  return result.rowsAffected;
}

export async function deleteCacheEntry(
  executor: SqlExecutor,
  ownerId: string,
  key: string,
): Promise<void> {
  await executor.execute(
    "DELETE FROM cache_entries WHERE owner_id = $1 AND key = $2",
    [ownerId, scopedCacheKey(ownerId, key)],
  );
}
