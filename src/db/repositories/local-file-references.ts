import type { SqlExecutor } from "../executor";
import type { LocalFileReferenceRow } from "../schema/types";

export async function getLocalFileReference(
  executor: SqlExecutor,
  ownerId: string,
  documentId: string,
): Promise<LocalFileReferenceRow | undefined> {
  const rows = await executor.select<LocalFileReferenceRow[]>(
    `SELECT * FROM local_file_references
     WHERE owner_id = $1 AND entity_type = 'tender-document' AND entity_id = $2
     LIMIT 1`,
    [ownerId, documentId],
  );
  return rows[0];
}

export function upsertLocalFileReference(
  executor: SqlExecutor,
  input: {
    ownerId: string;
    tenderId: string;
    documentId: string;
    path: string;
    filename: string;
    contentType: string;
    fingerprint: string;
  },
  now = new Date().toISOString(),
) {
  return executor.execute(
    `INSERT INTO local_file_references
      (id, owner_id, entity_type, entity_id, tender_id, local_path, file_name,
       content_type, fingerprint, cache_state, created_at, updated_at)
     VALUES ($1, $2, 'tender-document', $3, $4, $5, $6, $7, $8, 'ready', $9, $9)
     ON CONFLICT(id) DO UPDATE SET
       local_path = excluded.local_path,
       file_name = excluded.file_name,
       content_type = excluded.content_type,
       fingerprint = excluded.fingerprint,
       cache_state = 'ready',
       updated_at = excluded.updated_at`,
    [
      `${input.ownerId}:${input.documentId}`,
      input.ownerId,
      input.documentId,
      input.tenderId,
      input.path,
      input.filename,
      input.contentType,
      input.fingerprint,
      now,
    ],
  );
}

export function markLocalFileStale(
  executor: SqlExecutor,
  ownerId: string,
  documentId: string,
) {
  return executor.execute(
    `UPDATE local_file_references SET cache_state = 'stale'
     WHERE owner_id = $1 AND entity_type = 'tender-document' AND entity_id = $2`,
    [ownerId, documentId],
  );
}
