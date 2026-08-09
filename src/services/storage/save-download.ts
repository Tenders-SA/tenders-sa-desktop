/**
 * Save a downloaded package to disk through the OS save dialog
 * (Slice 6: desktop-workspace-export-response-package R-Ex-3).
 *
 * The user picking a destination is the only way a path is written. The
 * dialog plugin extends the fs scope at runtime to exactly the picked path
 * (`tauri_scope.allow_file` in the plugin's `save` command), so the
 * capability needs no static fs scope — see
 * `src-tauri/capabilities/default.json` and `capability-scope.test.ts`.
 *
 * The Tauri plugin functions throw outside a Tauri runtime, so nothing here
 * imports them at module scope: the caller injects the port (real build from
 * the plugins, fakes in tests), mirroring how `tauri-http-transport.ts`
 * keeps `fetchImpl` injectable.
 */

import type { ExportPackageResult } from "../api/endpoints/applications";

export interface SaveDialogOptions {
  suggestedName: string;
  filterName: string;
  extensions: string[];
}

export interface SaveDownloadPort {
  /** Resolves the picked path, or null when the user cancels the dialog. */
  saveDialog(options: SaveDialogOptions): Promise<string | null>;
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
}

export type SaveOutcome =
  { status: "saved"; path: string } | { status: "cancelled" };

/** The one filter the parent produces: branded PDF and DOCX packages. */
const FORMAT_FILTERS: Record<string, SaveDialogOptions> = {
  "application/pdf": {
    suggestedName: "proposal.pdf",
    filterName: "PDF document",
    extensions: ["pdf"],
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    suggestedName: "proposal.docx",
    filterName: "Word document",
    extensions: ["docx"],
  },
};

/**
 * Saves a downloaded package via the save dialog. `"cancelled"` when the
 * user dismisses the dialog — never an error, the caller must stay silent.
 */
export async function saveDownload(
  port: SaveDownloadPort,
  result: ExportPackageResult,
): Promise<SaveOutcome> {
  const format = FORMAT_FILTERS[result.contentType];
  const options: SaveDialogOptions = format
    ? { ...format, suggestedName: result.filename }
    : {
        suggestedName: result.filename,
        filterName: "All files",
        extensions: [],
      };

  const path = await port.saveDialog(options);
  if (!path) return { status: "cancelled" };

  await port.writeBytes(path, result.bytes);
  return { status: "saved", path };
}

/** Builds the real port from the Tauri plugins. */
export function createTauriSavePort(): SaveDownloadPort {
  return {
    async saveDialog(options) {
      const { save } = await import("@tauri-apps/plugin-dialog");
      return save({
        title: "Export package",
        defaultPath: options.suggestedName,
        filters: [
          {
            name: options.filterName,
            extensions: options.extensions,
          },
        ],
      });
    },
    async writeBytes(path, bytes) {
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      await writeFile(path, bytes);
    },
  };
}
