/**
 * Per-document download control (Slice 7, R-D5).
 *
 * One resolution + one fetch per press through the parent's
 * `download-url?requireR2=1` route, then the OS save dialog via the shared
 * Slice 6 `saveDownload` port. Dialog cancel is a silent no-op; errors are
 * described by the shared `describeApiError` copy (an entitlement 403
 * already reads "Your plan does not include…"). No auto-retry, no preview,
 * no direct fetch of any non-serving origin (INT-4). Slice 8 adds Open via
 * the same resolver, writing only a scoped temporary copy before asking the
 * operating system to launch its registered viewer.
 */

import { useState } from "react";
import { ApiError } from "../../services/api/errors";
import { describeApiError } from "../../services/api/describe-error";
import type { DownloadResult } from "../../services/api/transport";
import {
  createTauriSavePort,
  saveDownload,
  type SaveDownloadPort,
} from "../../services/storage/save-download";
import {
  createTauriDocumentActionPort,
  openDownloadedDocument,
  type DocumentActionPort,
} from "../../services/storage/document-actions";

export interface DocumentDownloadButtonProps {
  endpoint: {
    downloadTenderDocument: (
      id: string,
      signal?: AbortSignal,
    ) => Promise<DownloadResult>;
  };
  documentId: string;
  /** Shown beside the button as the readable file name (may be absent). */
  documentName?: string;
  /**
   * Where the downloaded file lands. Defaults to the real Tauri save-dialog
   * port; injectable so screens can drive the whole flow without a Tauri
   * runtime (mirrors ResponseBlueprintPanel, R-Ex-3).
   */
  savePort?: SaveDownloadPort;
  documentActionPort?: DocumentActionPort;
  showOpen?: boolean;
}

type DownloadState =
  | { status: "idle" }
  | { status: "downloading" }
  | { status: "opening" }
  | { status: "error"; message: string };

export function DocumentDownloadButton({
  endpoint,
  documentId,
  documentName,
  savePort = createTauriSavePort(),
  documentActionPort = createTauriDocumentActionPort(),
  showOpen = true,
}: DocumentDownloadButtonProps) {
  const [state, setState] = useState<DownloadState>({ status: "idle" });

  async function download() {
    setState({ status: "downloading" });
    try {
      const result = await endpoint.downloadTenderDocument(documentId);
      // "cancelled" means the user dismissed the dialog — never an error.
      await saveDownload(savePort, result);
      setState({ status: "idle" });
    } catch (error) {
      if (error instanceof ApiError && error.kind === "cancelled") {
        setState({ status: "idle" });
        return;
      }
      setState({
        status: "error",
        message: describeApiError(error, "this document").message,
      });
    }
  }

  async function openDocument() {
    setState({ status: "opening" });
    try {
      const result = await endpoint.downloadTenderDocument(documentId);
      await openDownloadedDocument(documentActionPort, documentId, result);
      setState({ status: "idle" });
    } catch (error) {
      if (error instanceof ApiError && error.kind === "cancelled") {
        setState({ status: "idle" });
        return;
      }
      setState({
        status: "error",
        message: describeApiError(error, "this document").message,
      });
    }
  }

  const busy = state.status === "downloading" || state.status === "opening";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={download}
        className="rounded border border-border px-2.5 py-1 text-xs text-foreground disabled:opacity-50"
      >
        {state.status === "downloading" ? "Downloading…" : "Download"}
      </button>
      {showOpen && (
        <button
          type="button"
          disabled={busy}
          onClick={openDocument}
          className="rounded border border-border px-2.5 py-1 text-xs text-foreground disabled:opacity-50"
        >
          {state.status === "opening" ? "Opening…" : "Open"}
        </button>
      )}
      {documentName && (
        <span className="text-sm text-muted-foreground">{documentName}</span>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
    </div>
  );
}
