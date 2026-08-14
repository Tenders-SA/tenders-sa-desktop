import { describe, expect, it } from "vitest";
import {
  createTauriDocumentActionPort,
  safeFilename,
} from "../services/storage/document-actions";

describe("document action filenames", () => {
  it("sanitises path separators, control characters and trailing dots", () => {
    expect(safeFilename("../SBD\\4\u0000.pdf. ")).toBe("..-SBD-4-.pdf");
  });
});

describe("createTauriDocumentActionPort", () => {
  it("exposes only the native primitives needed by batch downloads", () => {
    const native = createTauriDocumentActionPort();
    expect(Object.keys(native).sort()).toEqual([
      "chooseDirectory",
      "joinPath",
      "writeBytes",
    ]);
  });
});
