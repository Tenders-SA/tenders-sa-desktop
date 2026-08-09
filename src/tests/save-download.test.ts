/**
 * Unit tests for the export save path (Slice 6: R-Ex-3).
 *
 * The Tauri plugin functions throw outside a Tauri runtime, so the service
 * is exercised through the injectable `SaveDownloadPort`; the real port is
 * only a thin import pair over the plugins (asserted here by contract).
 */

import { describe, expect, it, vi } from "vitest";
import {
  saveDownload,
  createTauriSavePort,
  type SaveDownloadPort,
} from "../services/storage/save-download";

function pdfResult() {
  return {
    bytes: new Uint8Array([37, 80, 68, 70]),
    filename: "proposal-RFQ-001.pdf",
    contentType: "application/pdf",
  };
}

function fakePort(overrides: Partial<SaveDownloadPort> = {}): SaveDownloadPort {
  return {
    saveDialog: vi.fn(async () => "C:\\Exports\\proposal-RFQ-001.pdf"),
    writeBytes: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("saveDownload", () => {
  it("offers the parsed filename with the matching format filter", async () => {
    const port = fakePort();
    await saveDownload(port, pdfResult());

    expect(port.saveDialog).toHaveBeenCalledWith({
      suggestedName: "proposal-RFQ-001.pdf",
      filterName: "PDF document",
      extensions: ["pdf"],
    });
  });

  it("writes the bytes to the picked path and reports saved", async () => {
    const port = fakePort();
    const outcome = await saveDownload(port, pdfResult());

    expect(port.writeBytes).toHaveBeenCalledWith(
      "C:\\Exports\\proposal-RFQ-001.pdf",
      pdfResult().bytes,
    );
    expect(outcome).toBe("saved");
  });

  it("maps the docx content type to the Word filter", async () => {
    const port = fakePort();
    await saveDownload(port, {
      ...pdfResult(),
      filename: "proposal-RFQ-001.docx",
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    expect(port.saveDialog).toHaveBeenCalledWith({
      suggestedName: "proposal-RFQ-001.docx",
      filterName: "Word document",
      extensions: ["docx"],
    });
  });

  it("falls back to an all-files filter for an unknown content type", async () => {
    const port = fakePort();
    await saveDownload(port, {
      ...pdfResult(),
      contentType: "application/octet-stream",
    });

    expect(port.saveDialog).toHaveBeenCalledWith({
      suggestedName: "proposal-RFQ-001.pdf",
      filterName: "All files",
      extensions: [],
    });
  });

  it("treats a cancelled dialog as a silent no-op", async () => {
    const port = fakePort({ saveDialog: vi.fn(async () => null) });
    const outcome = await saveDownload(port, pdfResult());

    expect(outcome).toBe("cancelled");
    expect(port.writeBytes).not.toHaveBeenCalled();
  });
});

describe("createTauriSavePort", () => {
  it("is the real plugin-backed port, injectable only at the wiring point", () => {
    const port = createTauriSavePort();
    expect(typeof port.saveDialog).toBe("function");
    expect(typeof port.writeBytes).toBe("function");
  });
});
