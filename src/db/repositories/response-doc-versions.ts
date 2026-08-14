import type { SqlExecutor } from "../executor";
import type {
  ResponseDocVersionRow,
  ResponseDocVersionSource,
} from "../schema/types";

export interface NewResponseDocVersion {
  ownerId: string;
  id: string;
  applicationId: string;
  documentKey: string;
  /** Encrypted payload when the caller encrypts through the native boundary. */
  content: string;
  encrypted: boolean;
  source: ResponseDocVersionSource;
}

export async function insertResponseDocVersion(
  executor: SqlExecutor,
  version: NewResponseDocVersion,
  now: string = new Date().toISOString(),
): Promise<void> {
  await executor.execute(
    `INSERT INTO response_doc_versions
       (id, application_id, document_key, content, encrypted, source, created_at, owner_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      version.id,
      version.applicationId,
      version.documentKey,
      version.content,
      version.encrypted ? 1 : 0,
      version.source,
      now,
      version.ownerId,
    ],
  );
}

export async function listResponseDocVersions(
  executor: SqlExecutor,
  ownerId: string,
  applicationId: string,
  documentKey: string,
  limit = 20,
): Promise<ResponseDocVersionRow[]> {
  return executor.select<ResponseDocVersionRow[]>(
    `SELECT * FROM response_doc_versions
     WHERE owner_id = $1 AND application_id = $2 AND document_key = $3
     ORDER BY created_at DESC
     LIMIT $4`,
    [ownerId, applicationId, documentKey, limit],
  );
}

export async function pruneResponseDocVersions(
  executor: SqlExecutor,
  ownerId: string,
  applicationId: string,
  documentKey: string,
  keep = 20,
): Promise<number> {
  const result = await executor.execute(
    `DELETE FROM response_doc_versions
     WHERE owner_id = $1 AND application_id = $2 AND document_key = $3
       AND id NOT IN (
         SELECT id FROM response_doc_versions
         WHERE owner_id = $1 AND application_id = $2 AND document_key = $3
         ORDER BY created_at DESC
         LIMIT $4
       )`,
    [ownerId, applicationId, documentKey, keep],
  );
  return result.rowsAffected;
}
