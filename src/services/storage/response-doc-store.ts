import type { SqlExecutor } from "../../db/executor";
import {
  deleteResponseDocDraft,
  getResponseDocDraft,
  upsertResponseDocDraft,
} from "../../db/repositories/response-doc-drafts";
import {
  insertResponseDocVersion,
  listResponseDocVersions,
  pruneResponseDocVersions,
} from "../../db/repositories/response-doc-versions";
import {
  listPendingSyncOperations,
  updateSyncOperationStatus,
  upsertSyncOperation,
} from "../../db/repositories/sync-operations";
import type { ResponseDocVersionSource } from "../../db/schema/types";
import { tauriSqlExecutor } from "../../db/tauri-sql-executor";
import { ApiError } from "../api/errors";
import type { NativeCrypto } from "./native-crypto";
import { tauriNativeCrypto } from "./native-crypto";

/**
 * Slice 10 (LD-1..LD-4) — local-first drafting for response documents.
 *
 * Everything here is device-local state that mirrors `cache_entries`:
 * plaintext content is encrypted through the native security boundary
 * before it ever reaches SQLite (encrypted = 1). The parent backend
 * remains the single source of truth; these operations only persist
 * unsaved drafts, a pending-save queue (reusing sync_operations), and
 * local version history.
 */
export const RESPONSE_DOC_ENTITY_TYPE = "response-document";
export const RESPONSE_DOC_SAVE_OPERATION = "save";
export const RESPONSE_DOC_SAVE_IDEMPOTENCY_PREFIX = "response-doc-save";
export const RESPONSE_DOC_VERSION_LIMIT = 20;

export interface ResponseDocVersionEntry {
  id: string;
  content: string;
  source: ResponseDocVersionSource;
  createdAt: string;
}

export interface ResponseDocLocalStore {
  /** LD-1 — overwrite the local draft for a document (debounced by caller). */
  persistDraft(
    applicationId: string,
    documentKey: string,
    content: string,
  ): Promise<void>;
  /** LD-1 — read the local draft, or undefined when none exists. */
  loadDraft(
    applicationId: string,
    documentKey: string,
  ): Promise<string | undefined>;
  /** LD-1 — drop the local draft after a successful save. */
  clearDraft(applicationId: string, documentKey: string): Promise<void>;
  /** LD-3 — snapshot the outgoing content before it is replaced. */
  snapshotVersion(
    applicationId: string,
    documentKey: string,
    content: string,
    source: ResponseDocVersionSource,
  ): Promise<void>;
  /** LD-3 — newest-first version history (decrypted). */
  listVersions(
    applicationId: string,
    documentKey: string,
  ): Promise<ResponseDocVersionEntry[]>;
  /** LD-2 — queue a save for later replay (offline / timeout only). */
  enqueueSave(
    applicationId: string,
    documentKey: string,
    content: string,
  ): Promise<void>;
  /** LD-2 — document keys with an outstanding queued save. */
  listPendingSaveKeys(applicationId: string): Promise<string[]>;
  /**
   * LD-2 — replay queued saves oldest-first through the supplied save
   * function. Transient failures stay pending for a later retry; hard
   * failures are marked failed and never retried. Returns the number
   * of operations completed.
   */
  replayPendingSaves(
    save: (
      applicationId: string,
      documentKey: string,
      content: string,
    ) => Promise<void>,
  ): Promise<number>;
}

export function createResponseDocStore(
  sql: SqlExecutor,
  crypto: NativeCrypto,
): ResponseDocLocalStore {
  return {
    async persistDraft(applicationId, documentKey, content) {
      const encrypted = await crypto.encrypt(content);
      await upsertResponseDocDraft(sql, {
        applicationId,
        documentKey,
        content: encrypted,
        encrypted: true,
      });
    },

    async loadDraft(applicationId, documentKey) {
      const row = await getResponseDocDraft(sql, applicationId, documentKey);
      if (!row) return undefined;
      return row.encrypted ? crypto.decrypt(row.content) : row.content;
    },

    async clearDraft(applicationId, documentKey) {
      await deleteResponseDocDraft(sql, applicationId, documentKey);
    },

    async snapshotVersion(applicationId, documentKey, content, source) {
      const encrypted = await crypto.encrypt(content);
      await insertResponseDocVersion(sql, {
        id: globalThis.crypto.randomUUID(),
        applicationId,
        documentKey,
        content: encrypted,
        encrypted: true,
        source,
      });
      await pruneResponseDocVersions(
        sql,
        applicationId,
        documentKey,
        RESPONSE_DOC_VERSION_LIMIT,
      );
    },

    async listVersions(applicationId, documentKey) {
      const rows = await listResponseDocVersions(
        sql,
        applicationId,
        documentKey,
        RESPONSE_DOC_VERSION_LIMIT,
      );
      const entries = await Promise.all(
        rows.map(async (row) => ({
          id: row.id,
          content: row.encrypted
            ? await crypto.decrypt(row.content)
            : row.content,
          source: row.source,
          createdAt: row.created_at,
        })),
      );
      return entries;
    },

    async enqueueSave(applicationId, documentKey, content) {
      const payload = await crypto.encrypt(
        JSON.stringify({ applicationId, documentKey, content }),
      );
      await upsertSyncOperation(sql, {
        id: globalThis.crypto.randomUUID(),
        idempotencyKey: `${RESPONSE_DOC_SAVE_IDEMPOTENCY_PREFIX}:${applicationId}:${documentKey}`,
        entityType: RESPONSE_DOC_ENTITY_TYPE,
        entityId: `${applicationId}:${documentKey}`,
        operationType: RESPONSE_DOC_SAVE_OPERATION,
        payload,
      });
    },

    async listPendingSaveKeys(applicationId) {
      const ops = (await listPendingSyncOperations(sql)).filter(
        (op) =>
          op.entity_type === RESPONSE_DOC_ENTITY_TYPE &&
          op.operation_type === RESPONSE_DOC_SAVE_OPERATION,
      );
      const keys = new Set<string>();
      for (const op of ops) {
        try {
          const parsed = JSON.parse(await crypto.decrypt(op.payload)) as {
            applicationId?: string;
            documentKey?: string;
          };
          if (parsed.applicationId === applicationId && parsed.documentKey) {
            keys.add(parsed.documentKey);
          }
        } catch {
          // Corrupt payloads are skipped; they surface as 'failed' on replay.
        }
      }
      return [...keys];
    },

    async replayPendingSaves(save) {
      const ops = (await listPendingSyncOperations(sql)).filter(
        (op) =>
          op.entity_type === RESPONSE_DOC_ENTITY_TYPE &&
          op.operation_type === RESPONSE_DOC_SAVE_OPERATION,
      );
      let replayed = 0;
      for (const op of ops) {
        let parsed: {
          applicationId: string;
          documentKey: string;
          content: string;
        };
        try {
          parsed = JSON.parse(
            await crypto.decrypt(op.payload),
          ) as typeof parsed;
        } catch {
          await updateSyncOperationStatus(sql, op.id, "failed", {
            lastError: "Corrupt queued save payload",
          });
          continue;
        }
        await updateSyncOperationStatus(sql, op.id, "syncing");
        try {
          await save(parsed.applicationId, parsed.documentKey, parsed.content);
        } catch (cause) {
          const transient = cause instanceof ApiError && cause.isTransient;
          await updateSyncOperationStatus(
            sql,
            op.id,
            transient ? "pending" : "failed",
            {
              attemptCount: op.attempt_count + 1,
              lastError:
                cause instanceof Error ? cause.message : "Unknown error",
            },
          );
          continue;
        }
        await updateSyncOperationStatus(sql, op.id, "complete");
        await deleteResponseDocDraft(
          sql,
          parsed.applicationId,
          parsed.documentKey,
        );
        replayed += 1;
      }
      return replayed;
    },
  };
}

/**
 * Production wiring: the single local database and the native
 * encryption boundary, both established at startup. Injectable so
 * screen tests can substitute fakes.
 */
export function createTauriResponseDocStore(): ResponseDocLocalStore {
  return createResponseDocStore(tauriSqlExecutor, tauriNativeCrypto);
}
