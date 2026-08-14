import {
  deleteExpiredCacheEntries,
  getCacheEntry,
  upsertCacheEntry,
} from "../../db/repositories/cache-entries";
import type { SqlExecutor } from "../../db/executor";
import type { NativeCrypto } from "./native-crypto";
import type { WorkspaceOwnerId } from "./workspace-owner";

export interface SetCachedOptions {
  entityType: string;
  entityId: string;
  etag?: string;
  expiresAt?: string;
  /**
   * Sensitive payloads are encrypted through the native security
   * boundary (TASK-0.4) before the plaintext ever reaches SQLite.
   * Never set this to false for anything containing an auth token or
   * credential -- those belong in OS secure storage
   * (session_store/session_load), not this cache, regardless of this
   * flag.
   */
  sensitive?: boolean;
}

export async function setCached(
  sql: SqlExecutor,
  crypto: NativeCrypto,
  ownerId: WorkspaceOwnerId,
  key: string,
  value: string,
  options: SetCachedOptions,
): Promise<void> {
  const sensitive = options.sensitive ?? false;
  const payload = sensitive ? await crypto.encrypt(value) : value;
  await upsertCacheEntry(sql, {
    ownerId,
    key,
    entityType: options.entityType,
    entityId: options.entityId,
    etag: options.etag,
    payload,
    encrypted: sensitive,
    expiresAt: options.expiresAt,
  });
}

export async function getCached(
  sql: SqlExecutor,
  crypto: NativeCrypto,
  ownerId: WorkspaceOwnerId,
  key: string,
): Promise<string | undefined> {
  const row = await getCacheEntry(sql, ownerId, key);
  if (!row) {
    return undefined;
  }
  return row.encrypted ? crypto.decrypt(row.payload) : row.payload;
}

export async function pruneExpiredCache(
  sql: SqlExecutor,
  ownerId: WorkspaceOwnerId,
  nowIso: string = new Date().toISOString(),
): Promise<number> {
  return deleteExpiredCacheEntries(sql, ownerId, nowIso);
}
