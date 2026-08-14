/**
 * Native document actions for Slice 8.
 *
 * Directory selection and filesystem writes support explicit batch downloads.
 * Tender-document viewing is route-based and does not launch OS paths.
 */

export interface DocumentActionPort {
  chooseDirectory(): Promise<string | null>;
  joinPath(...parts: string[]): Promise<string>;
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
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
    async joinPath(...parts) {
      const { join } = await import("@tauri-apps/api/path");
      return join(...parts);
    },
    async writeBytes(path, bytes) {
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      await writeFile(path, bytes);
    },
  };
}
