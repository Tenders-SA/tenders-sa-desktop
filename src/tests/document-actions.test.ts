import { describe, expect, it, vi } from "vitest";
import {
  createTauriDocumentActionPort,
  openDownloadedDocument,
  safeFilename,
  type DocumentActionPort,
} from "../services/storage/document-actions";

function port(): DocumentActionPort {
  return {
    chooseDirectory: vi.fn(async () => null),
    tempDirectory: vi.fn(async () => "C:\\Temp"),
    joinPath: vi.fn(async (...parts: string[]) => parts.join("\\")),
    createDirectory: vi.fn(async () => {}),
    writeBytes: vi.fn(async () => {}),
    openPath: vi.fn(async () => {}),
  };
}

describe("openDownloadedDocument", () => {
  it("writes beneath the dedicated temp folder before opening the same path", async () => {
    const native = port();
    const bytes = new Uint8Array([37, 80, 68, 70]);
    const path = await openDownloadedDocument(native, "doc/1", {
      bytes,
      filename: "Tender: Brief.pdf",
      contentType: "application/pdf",
    });

    expect(path).toBe("C:\\Temp\\tenders-sa\\doc-1-Tender- Brief.pdf");
    expect(native.createDirectory).toHaveBeenCalledWith("C:\\Temp\\tenders-sa");
    expect(native.writeBytes).toHaveBeenCalledWith(path, bytes);
    expect(native.openPath).toHaveBeenCalledWith(path);
    expect(
      vi.mocked(native.writeBytes).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(native.openPath).mock.invocationCallOrder[0]);
  });

  it("sanitises path separators, control characters and trailing dots", () => {
    expect(safeFilename("../SBD\\4\u0000.pdf. ")).toBe("..-SBD-4-.pdf");
  });
});

describe("createTauriDocumentActionPort", () => {
  it("exposes only the native primitives needed by open and batch actions", () => {
    const native = createTauriDocumentActionPort();
    expect(Object.keys(native).sort()).toEqual([
      "chooseDirectory",
      "createDirectory",
      "joinPath",
      "openPath",
      "tempDirectory",
      "writeBytes",
    ]);
  });
});
