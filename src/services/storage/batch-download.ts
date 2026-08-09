import type { DownloadResult } from "../api/transport";
import { safeFilename, type DocumentActionPort } from "./document-actions";

export interface BatchDocument {
  id: string;
}

export type BatchDownloadOutcome =
  | { status: "cancelled" }
  | { status: "complete"; saved: number; failed: number };

/**
 * Download sequentially into one user-selected directory. A failed item never
 * prevents the remaining documents from being attempted, and duplicate names
 * receive a suffix instead of overwriting an earlier file.
 */
export async function downloadDocumentBatch(
  port: DocumentActionPort,
  documents: readonly BatchDocument[],
  download: (id: string) => Promise<DownloadResult>,
  onProgress?: (completed: number, total: number) => void,
): Promise<BatchDownloadOutcome> {
  const directory = await port.chooseDirectory();
  if (!directory) return { status: "cancelled" };

  const usedNames = new Set<string>();
  let saved = 0;
  let failed = 0;

  for (const document of documents) {
    try {
      const result = await download(document.id);
      const filename = uniqueFilename(result.filename, usedNames);
      await port.writeBytes(
        await port.joinPath(directory, filename),
        result.bytes,
      );
      saved += 1;
    } catch {
      failed += 1;
    }
    onProgress?.(saved + failed, documents.length);
  }

  return { status: "complete", saved, failed };
}

export function uniqueFilename(
  filename: string,
  usedNames: Set<string>,
): string {
  const safe = safeFilename(filename);
  let candidate = safe;
  let suffix = 2;
  while (usedNames.has(candidate.toLocaleLowerCase("en-ZA"))) {
    const dot = safe.lastIndexOf(".");
    const stem = dot > 0 ? safe.slice(0, dot) : safe;
    const extension = dot > 0 ? safe.slice(dot) : "";
    candidate = `${stem}-${suffix}${extension}`;
    suffix += 1;
  }
  usedNames.add(candidate.toLocaleLowerCase("en-ZA"));
  return candidate;
}
