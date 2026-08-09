import { describe, expect, it, vi } from "vitest";
import type { DocumentActionPort } from "../services/storage/document-actions";
import {
  downloadDocumentBatch,
  uniqueFilename,
} from "../services/storage/batch-download";

function port(directory: string | null = "C:\\Downloads"): DocumentActionPort {
  return {
    chooseDirectory: vi.fn(async () => directory),
    tempDirectory: vi.fn(),
    joinPath: vi.fn(async (...parts: string[]) => parts.join("\\")),
    createDirectory: vi.fn(),
    writeBytes: vi.fn(async () => {}),
    openPath: vi.fn(),
  };
}

describe("batch document download", () => {
  it("chooses once, downloads sequentially and reports progress", async () => {
    const native = port();
    const events: string[] = [];
    const download = vi.fn(async (id: string) => {
      events.push(`download:${id}`);
      return {
        bytes: new Uint8Array([1]),
        filename: `${id}.pdf`,
        contentType: "application/pdf",
      };
    });
    const outcome = await downloadDocumentBatch(
      native,
      [{ id: "d1" }, { id: "d2" }],
      download,
      (done) => events.push(`done:${done}`),
    );

    expect(outcome).toEqual({ status: "complete", saved: 2, failed: 0 });
    expect(events).toEqual(["download:d1", "done:1", "download:d2", "done:2"]);
    expect(native.chooseDirectory).toHaveBeenCalledTimes(1);
  });

  it("does nothing when directory selection is cancelled", async () => {
    const native = port(null);
    const download = vi.fn();
    expect(
      await downloadDocumentBatch(native, [{ id: "d1" }], download),
    ).toEqual({ status: "cancelled" });
    expect(download).not.toHaveBeenCalled();
  });

  it("continues after an item fails and never overwrites duplicate names", async () => {
    const native = port();
    const download = vi.fn(async (id: string) => {
      if (id === "bad") throw new Error("failed");
      return {
        bytes: new Uint8Array([1]),
        filename: "Advert.pdf",
        contentType: "application/pdf",
      };
    });
    const outcome = await downloadDocumentBatch(
      native,
      [{ id: "d1" }, { id: "bad" }, { id: "d2" }],
      download,
    );
    expect(outcome).toEqual({ status: "complete", saved: 2, failed: 1 });
    expect(native.writeBytes).toHaveBeenNthCalledWith(
      1,
      "C:\\Downloads\\Advert.pdf",
      new Uint8Array([1]),
    );
    expect(native.writeBytes).toHaveBeenNthCalledWith(
      2,
      "C:\\Downloads\\Advert-2.pdf",
      new Uint8Array([1]),
    );
  });

  it("treats filename collisions case-insensitively", () => {
    const used = new Set<string>();
    expect(uniqueFilename("Bid.PDF", used)).toBe("Bid.PDF");
    expect(uniqueFilename("bid.pdf", used)).toBe("bid-2.pdf");
  });
});
