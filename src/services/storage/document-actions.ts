/**
 * Native document actions for Slice 8.
 *
 * Opening is deliberately limited to a disposable copy under
 * `$TEMP/tenders-sa/**`. The Tauri capability enforces the same boundary, so
 * the webview never receives permission to open arbitrary paths or URLs.
 */

import type { DownloadResult } from "../api/transport";

export interface DocumentActionPort {
  chooseDirectory(): Promise<string | null>;
  tempDirectory(): Promise<string>;
  joinPath(...parts: string[]): Promise<string>;
  createDirectory(path: string): Promise<void>;
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
  openPath(path: string): Promise<void>;
}

/** Write a downloaded document to the scoped temp folder and open it. */
export async function openDownloadedDocument(
  port: DocumentActionPort,
  documentId: string,
  result: DownloadResult,
): Promise<string> {
  const root = await port.joinPath(await port.tempDirectory(), "tenders-sa");
  await port.createDirectory(root);
  const path = await port.joinPath(
    root,
    `${safeFileSegment(documentId)}-${safeFilename(result.filename)}`,
  );
  await port.writeBytes(path, result.bytes);
  await port.openPath(path);
  return path;
}

/** Filename-only sanitisation; path separators and Windows-reserved chars go. */
export function safeFilename(value: string): string {
  const withoutControls = Array.from(value, (character) =>
    character.charCodeAt(0) <= 31 ? "-" : character,
  ).join("");
  const cleaned = withoutControls
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/[. ]+$/g, "")
    .trim();
  return cleaned || "document";
}

function safeFileSegment(value: string): string {
  return safeFilename(value).replace(/\s+/g, "-");
}

/** Build the real native adapter; dynamic imports keep browser tests injectable. */
export function createTauriDocumentActionPort(): DocumentActionPort {
  return {
    async chooseDirectory() {
      const { open } = await import("@tauri-apps/plugin-dialog");
      return open({
        title: "Choose download folder",
        directory: true,
        multiple: false,
        recursive: false,
      });
    },
    async tempDirectory() {
      const { tempDir } = await import("@tauri-apps/api/path");
      return tempDir();
    },
    async joinPath(...parts) {
      const { join } = await import("@tauri-apps/api/path");
      return join(...parts);
    },
    async createDirectory(path) {
      const { mkdir } = await import("@tauri-apps/plugin-fs");
      await mkdir(path, { recursive: true });
    },
    async writeBytes(path, bytes) {
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      await writeFile(path, bytes);
    },
    async openPath(path) {
      const { openPath } = await import("@tauri-apps/plugin-opener");
      await openPath(path);
    },
  };
}
