import { invoke } from "@tauri-apps/api/core";
import type { SqlExecutor } from "../../db/executor";
import {
  getLocalFileReference,
  markLocalFileStale,
  upsertLocalFileReference,
} from "../../db/repositories/local-file-references";
import type { TenderDetail } from "../api/endpoints/tenders";
import type { DownloadResult } from "../api/transport";
import type { WorkspaceOwnerId } from "./workspace-owner";

type TenderDocument = NonNullable<TenderDetail["documents"]>[number];

export interface WorkspaceFilePort {
  read(input: {
    ownerId: string;
    tenderId: string;
    documentId: string;
  }): Promise<number[] | null>;
  write(input: {
    ownerId: string;
    tenderId: string;
    documentId: string;
    bytes: number[];
  }): Promise<string>;
}

export const tauriWorkspaceFilePort: WorkspaceFilePort = {
  read: (input) => invoke<number[] | null>("workspace_document_read", input),
  write: (input) => invoke<string>("workspace_document_write", input),
};

export function tenderDocumentFingerprint(document: TenderDocument): string {
  return [
    document.id,
    document.processedAt ?? "",
    document.fileSize ?? "",
    document.mimeType ?? "",
    document.fileName ?? "",
  ].join("|");
}

export class DocumentWorkspace {
  constructor(
    private readonly sql: SqlExecutor,
    private readonly files: WorkspaceFilePort,
    private readonly ownerId: WorkspaceOwnerId,
  ) {}

  async open(
    tenderId: string,
    document: TenderDocument,
    download: () => Promise<DownloadResult>,
  ): Promise<DownloadResult> {
    const fingerprint = tenderDocumentFingerprint(document);
    const reference = await getLocalFileReference(
      this.sql,
      this.ownerId,
      document.id,
    );
    if (
      reference?.fingerprint === fingerprint &&
      reference.cache_state === "ready"
    ) {
      const bytes = await this.files.read({
        ownerId: this.ownerId,
        tenderId,
        documentId: document.id,
      });
      if (bytes) {
        return {
          bytes: Uint8Array.from(bytes),
          filename: reference.file_name,
          contentType: reference.content_type ?? "application/octet-stream",
        };
      }
    }

    if (reference) {
      await markLocalFileStale(this.sql, this.ownerId, document.id);
    }
    const result = await download();
    const path = await this.files.write({
      ownerId: this.ownerId,
      tenderId,
      documentId: document.id,
      bytes: Array.from(result.bytes),
    });
    await upsertLocalFileReference(this.sql, {
      ownerId: this.ownerId,
      tenderId,
      documentId: document.id,
      path,
      filename: result.filename,
      contentType: result.contentType,
      fingerprint,
    });
    return result;
  }
}
