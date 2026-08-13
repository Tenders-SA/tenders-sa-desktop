import type { SqlExecutor } from "../executor";
import type { ResponseDocDraftRow } from "../schema/types";

export interface NewResponseDocDraft {
  applicationId: string;
  documentKey: string;
  /** Encrypted payload when the caller encrypts through the native boundary. */
  content: string;
  encrypted: boolean;
}

export async function upsertResponseDocDraft(
  executor: SqlExecutor,
  draft: NewResponseDocDraft,
  now: string = new Date().toISOString(),
): Promise<void> {
  await executor.execute(
    `INSERT INTO response_doc_drafts
       (application_id, document_key, content, encrypted, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(application_id, document_key) DO UPDATE SET
       content = excluded.content,
       encrypted = excluded.encrypted,
       updated_at = excluded.updated_at`,
    [
      draft.applicationId,
      draft.documentKey,
      draft.content,
      draft.encrypted ? 1 : 0,
      now,
    ],
  );
}

export async function getResponseDocDraft(
  executor: SqlExecutor,
  applicationId: string,
  documentKey: string,
): Promise<ResponseDocDraftRow | undefined> {
  const rows = await executor.select<ResponseDocDraftRow[]>(
    "SELECT * FROM response_doc_drafts WHERE application_id = $1 AND document_key = $2",
    [applicationId, documentKey],
  );
  return rows[0];
}

export async function deleteResponseDocDraft(
  executor: SqlExecutor,
  applicationId: string,
  documentKey: string,
): Promise<void> {
  await executor.execute(
    "DELETE FROM response_doc_drafts WHERE application_id = $1 AND document_key = $2",
    [applicationId, documentKey],
  );
}
