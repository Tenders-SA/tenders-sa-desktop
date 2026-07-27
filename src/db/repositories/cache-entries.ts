import type { SqlExecutor } from "../executor";
import type { CacheEntryRow } from "../schema/types";

export interface NewCacheEntry {
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
       (key, entity_type, entity_id, etag, payload, encrypted, expires_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT(key) DO UPDATE SET
       entity_type = excluded.entity_type,
       entity_id = excluded.entity_id,
       etag = excluded.etag,
       payload = excluded.payload,
       encrypted = excluded.encrypted,
       expires_at = excluded.expires_at,
       updated_at = excluded.updated_at`,
    [
      entry.key,
      entry.entityType,
      entry.entityId,
      entry.etag ?? null,
      entry.payload,
      entry.encrypted ? 1 : 0,
      entry.expiresAt ?? null,
      now,
      now,
    ],
  );
}

export async function getCacheEntry(
  executor: SqlExecutor,
  key: string,
): Promise<CacheEntryRow | undefined> {
  const rows = await executor.select<CacheEntryRow[]>(
    "SELECT * FROM cache_entries WHERE key = $1",
    [key],
  );
  return rows[0];
}

export async function deleteExpiredCacheEntries(
  executor: SqlExecutor,
  nowIso: string,
): Promise<number> {
  const result = await executor.execute(
    "DELETE FROM cache_entries WHERE expires_at IS NOT NULL AND expires_at < $1",
    [nowIso],
  );
  return result.rowsAffected;
}
