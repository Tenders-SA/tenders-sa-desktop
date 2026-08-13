import type { SqlExecutor } from "../executor";
import type {
  ResponseDocVersionRow,
  ResponseDocVersionSource,
} from "../schema/types";

export interface NewResponseDocVersion {
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
       (id, application_id, document_key, content, encrypted, source, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      version.id,
      version.applicationId,
      version.documentKey,
      version.content,
      version.encrypted ? 1 : 0,
      version.source,
      now,
    ],
  );
}

export async function listResponseDocVersions(
  executor: SqlExecutor,
  applicationId: string,
  documentKey: string,
  limit = 20,
): Promise<ResponseDocVersionRow[]> {
  return executor.select<ResponseDocVersionRow[]>(
    `SELECT * FROM response_doc_versions
     WHERE application_id = $1 AND document_key = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [applicationId, documentKey, limit],
  );
}

export async function pruneResponseDocVersions(
  executor: SqlExecutor,
  applicationId: string,
  documentKey: string,
  keep = 20,
): Promise<number> {
  const result = await executor.execute(
    `DELETE FROM response_doc_versions
     WHERE application_id = $1 AND document_key = $2
       AND id NOT IN (
         SELECT id FROM response_doc_versions
         WHERE application_id = $1 AND document_key = $2
         ORDER BY created_at DESC
         LIMIT $3
       )`,
    [applicationId, documentKey, keep],
  );
  return result.rowsAffected;
}
