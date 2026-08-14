import { describe, expect, it, vi } from "vitest";
import { FakeSqlExecutor } from "./fakes/sql-executor";
import {
  DocumentWorkspace,
  tenderDocumentFingerprint,
  type WorkspaceFilePort,
} from "../services/storage/document-workspace";
import { assertWorkspaceOwner } from "../services/storage/workspace-owner";
import type { LocalFileReferenceRow } from "../db/schema/types";

const owner = assertWorkspaceOwner(`v1-${"b".repeat(64)}`);
const document = {
  id: "doc-1",
  fileName: "Tender.pdf",
  mimeType: "application/pdf",
  fileSize: 3,
  processedAt: "2026-08-14T00:00:00.000Z",
};

function filePort(bytes: number[] | null): WorkspaceFilePort & {
  read: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
} {
  return {
    read: vi.fn(async () => bytes),
    write: vi.fn(async () => "workspace/owner/documents/tender/doc.bin"),
  };
}

describe("DocumentWorkspace", () => {
  it("reuses an unchanged local document without a network download", async () => {
    const db = new FakeSqlExecutor();
    const files = filePort([1, 2, 3]);
    const row: LocalFileReferenceRow = {
      owner_id: owner,
      id: `${owner}:doc-1`,
      entity_type: "tender-document",
      entity_id: "doc-1",
      file_name: "Tender.pdf",
      local_path: "workspace/owner/documents/tender/doc.bin",
      size_bytes: 3,
      created_at: "2026-08-14T00:00:00.000Z",
      tender_id: "tender-1",
      content_type: "application/pdf",
      fingerprint: tenderDocumentFingerprint(document),
      cache_state: "ready",
      updated_at: "2026-08-14T00:00:00.000Z",
    };
    db.selectResults = [[row]];
    const download = vi.fn();

    const result = await new DocumentWorkspace(db, files, owner).open(
      "tender-1",
      document,
      download,
    );

    expect([...result.bytes]).toEqual([1, 2, 3]);
    expect(download).not.toHaveBeenCalled();
    expect(files.write).not.toHaveBeenCalled();
  });

  it("downloads once, stores atomically through the native port and records metadata", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[]];
    const files = filePort(null);
    const download = vi.fn(async () => ({
      bytes: Uint8Array.from([4, 5, 6]),
      filename: "Tender.pdf",
      contentType: "application/pdf",
    }));

    const result = await new DocumentWorkspace(db, files, owner).open(
      "tender-1",
      document,
      download,
    );

    expect([...result.bytes]).toEqual([4, 5, 6]);
    expect(download).toHaveBeenCalledOnce();
    expect(files.write).toHaveBeenCalledWith({
      ownerId: owner,
      tenderId: "tender-1",
      documentId: "doc-1",
      bytes: [4, 5, 6],
    });
    const lastCall = db.calls[db.calls.length - 1];
    expect(lastCall?.sql).toContain("local_file_references");
    expect(lastCall?.params).toContain(owner);
  });
});
