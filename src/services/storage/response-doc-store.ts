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
import type { WorkspaceOwnerId } from "./workspace-owner";
import {
  listUnresolvedConflicts,
  markConflictResolved,
  recordConflict,
} from "../sync/conflicts";

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

function redactedSyncError(cause: unknown): string {
  if (cause instanceof ApiError) return `Sync ${cause.kind}`.slice(0, 80);
  return "Sync failed";
}

export interface ResponseDocVersionEntry {
  id: string;
  content: string;
  source: ResponseDocVersionSource;
  createdAt: string;
}

export interface ResponseDocConflictEntry {
  id: string;
  applicationId: string;
  documentKey: string;
  localContent: string;
  remoteContent: string;
  createdAt: string;
}

export type ResponseDocConflictResolution = "local" | "remote" | "merged";

interface ResponseDocSyncPayload {
  applicationId: string;
  documentKey: string;
  content: string;
  baseContent?: string;
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
    baseContent?: string,
  ): Promise<void>;
  /** Mark the owner-scoped queued save complete after the remote accepted it. */
  markSaveSynced(applicationId: string, documentKey: string): Promise<void>;
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
    readRemote?: (
      applicationId: string,
      documentKey: string,
    ) => Promise<string | undefined>,
  ): Promise<number>;
  listConflicts(
    applicationId: string,
    documentKey: string,
  ): Promise<ResponseDocConflictEntry[]>;
  resolveConflict(
    conflictId: string,
    resolution: ResponseDocConflictResolution,
    mergedContent: string | undefined,
    save: (
      applicationId: string,
      documentKey: string,
      content: string,
    ) => Promise<void>,
  ): Promise<string>;
}

export function createResponseDocStore(
  sql: SqlExecutor,
  crypto: NativeCrypto,
  ownerId: WorkspaceOwnerId,
): ResponseDocLocalStore {
  return {
    async persistDraft(applicationId, documentKey, content) {
      const encrypted = await crypto.encrypt(content);
      await upsertResponseDocDraft(sql, {
        ownerId,
        applicationId,
        documentKey,
        content: encrypted,
        encrypted: true,
      });
    },

    async loadDraft(applicationId, documentKey) {
      const row = await getResponseDocDraft(
        sql,
        ownerId,
        applicationId,
        documentKey,
      );
      if (!row) return undefined;
      return row.encrypted ? crypto.decrypt(row.content) : row.content;
    },

    async clearDraft(applicationId, documentKey) {
      await deleteResponseDocDraft(sql, ownerId, applicationId, documentKey);
    },

    async snapshotVersion(applicationId, documentKey, content, source) {
      const encrypted = await crypto.encrypt(content);
      await insertResponseDocVersion(sql, {
        ownerId,
        id: globalThis.crypto.randomUUID(),
        applicationId,
        documentKey,
        content: encrypted,
        encrypted: true,
        source,
      });
      await pruneResponseDocVersions(
        sql,
        ownerId,
        applicationId,
        documentKey,
        RESPONSE_DOC_VERSION_LIMIT,
      );
    },

    async listVersions(applicationId, documentKey) {
      const rows = await listResponseDocVersions(
        sql,
        ownerId,
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

    async enqueueSave(applicationId, documentKey, content, baseContent) {
      const payload = await crypto.encrypt(
        JSON.stringify({
          applicationId,
          documentKey,
          content,
          baseContent,
        } satisfies ResponseDocSyncPayload),
      );
      await upsertSyncOperation(sql, {
        ownerId,
        id: globalThis.crypto.randomUUID(),
        idempotencyKey: `${RESPONSE_DOC_SAVE_IDEMPOTENCY_PREFIX}:${ownerId}:${applicationId}:${documentKey}`,
        entityType: RESPONSE_DOC_ENTITY_TYPE,
        entityId: `${applicationId}:${documentKey}`,
        operationType: RESPONSE_DOC_SAVE_OPERATION,
        payload,
      });
    },

    async markSaveSynced(applicationId, documentKey) {
      await sql.execute(
        `UPDATE sync_operations SET status = 'complete', updated_at = $1
         WHERE owner_id = $2 AND idempotency_key = $3`,
        [
          new Date().toISOString(),
          ownerId,
          `${RESPONSE_DOC_SAVE_IDEMPOTENCY_PREFIX}:${ownerId}:${applicationId}:${documentKey}`,
        ],
      );
    },

    async listPendingSaveKeys(applicationId) {
      const ops = (await listPendingSyncOperations(sql, ownerId)).filter(
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

    async replayPendingSaves(save, readRemote) {
      const ops = (await listPendingSyncOperations(sql, ownerId)).filter(
        (op) =>
          op.entity_type === RESPONSE_DOC_ENTITY_TYPE &&
          op.operation_type === RESPONSE_DOC_SAVE_OPERATION,
      );
      let replayed = 0;
      for (const op of ops) {
        let parsed: ResponseDocSyncPayload;
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
          if (readRemote && parsed.baseContent !== undefined) {
            const remoteContent =
              (await readRemote(parsed.applicationId, parsed.documentKey)) ??
              "";
            if (
              remoteContent !== parsed.baseContent &&
              remoteContent !== parsed.content
            ) {
              const [localVersion, remoteVersion] = await Promise.all([
                crypto.encrypt(
                  JSON.stringify({ ...parsed, content: parsed.content }),
                ),
                crypto.encrypt(
                  JSON.stringify({
                    applicationId: parsed.applicationId,
                    documentKey: parsed.documentKey,
                    content: remoteContent,
                  } satisfies ResponseDocSyncPayload),
                ),
              ]);
              await recordConflict(sql, ownerId, {
                id: globalThis.crypto.randomUUID(),
                syncOperationId: op.id,
                entityType: RESPONSE_DOC_ENTITY_TYPE,
                entityId: `${parsed.applicationId}:${parsed.documentKey}`,
                localVersion,
                remoteVersion,
                fieldPolicy: "human-response-document",
              });
              await updateSyncOperationStatus(sql, op.id, "conflicted");
              continue;
            }
            if (remoteContent === parsed.content) {
              await updateSyncOperationStatus(sql, op.id, "complete");
              await deleteResponseDocDraft(
                sql,
                ownerId,
                parsed.applicationId,
                parsed.documentKey,
              );
              replayed += 1;
              continue;
            }
          }
          await save(parsed.applicationId, parsed.documentKey, parsed.content);
        } catch (cause) {
          const transient = cause instanceof ApiError && cause.isTransient;
          await updateSyncOperationStatus(
            sql,
            op.id,
            transient ? "pending" : "failed",
            {
              attemptCount: op.attempt_count + 1,
              lastError: redactedSyncError(cause),
            },
          );
          continue;
        }
        await updateSyncOperationStatus(sql, op.id, "complete");
        await deleteResponseDocDraft(
          sql,
          ownerId,
          parsed.applicationId,
          parsed.documentKey,
        );
        replayed += 1;
      }
      return replayed;
    },

    async listConflicts(applicationId, documentKey) {
      const rows = await listUnresolvedConflicts(sql, ownerId);
      const matching = rows.filter(
        (row) =>
          row.entity_type === RESPONSE_DOC_ENTITY_TYPE &&
          row.entity_id === `${applicationId}:${documentKey}`,
      );
      const entries: ResponseDocConflictEntry[] = [];
      for (const row of matching) {
        try {
          const local = JSON.parse(
            await crypto.decrypt(row.local_version),
          ) as ResponseDocSyncPayload;
          const remote = JSON.parse(
            await crypto.decrypt(row.remote_version),
          ) as ResponseDocSyncPayload;
          entries.push({
            id: row.id,
            applicationId,
            documentKey,
            localContent: local.content,
            remoteContent: remote.content,
            createdAt: row.created_at,
          });
        } catch {
          // A corrupt conflict stays unresolved for diagnostics, but its
          // ciphertext is never exposed to the webview as document content.
        }
      }
      return entries;
    },

    async resolveConflict(conflictId, resolution, mergedContent, save) {
      const row = (await listUnresolvedConflicts(sql, ownerId)).find(
        (candidate) => candidate.id === conflictId,
      );
      if (!row || row.entity_type !== RESPONSE_DOC_ENTITY_TYPE) {
        throw new Error("Response document conflict is no longer available");
      }
      const [local, remote] = await Promise.all([
        crypto
          .decrypt(row.local_version)
          .then((value) => JSON.parse(value) as ResponseDocSyncPayload),
        crypto
          .decrypt(row.remote_version)
          .then((value) => JSON.parse(value) as ResponseDocSyncPayload),
      ]);
      const content =
        resolution === "remote"
          ? remote.content
          : resolution === "merged"
            ? mergedContent
            : local.content;
      if (content === undefined) {
        throw new Error("Merged response document content is required");
      }
      if (resolution !== "remote") {
        await save(local.applicationId, local.documentKey, content);
      }
      await markConflictResolved(
        sql,
        ownerId,
        conflictId,
        resolution === "local"
          ? "resolved_local"
          : resolution === "remote"
            ? "resolved_remote"
            : "resolved_merged",
      );
      await updateSyncOperationStatus(sql, row.sync_operation_id, "complete");
      await deleteResponseDocDraft(
        sql,
        ownerId,
        local.applicationId,
        local.documentKey,
      );
      return content;
    },
  };
}

/**
 * Production wiring: the single local database and the native
 * encryption boundary, both established at startup. Injectable so
 * screen tests can substitute fakes.
 */
export function createTauriResponseDocStore(
  ownerId: WorkspaceOwnerId,
): ResponseDocLocalStore {
  return createResponseDocStore(tauriSqlExecutor, tauriNativeCrypto, ownerId);
}
