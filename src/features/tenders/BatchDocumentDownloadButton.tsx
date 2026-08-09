import { useState } from "react";
import type { DownloadResult } from "../../services/api/transport";
import {
  createTauriDocumentActionPort,
  type DocumentActionPort,
} from "../../services/storage/document-actions";
import { downloadDocumentBatch } from "../../services/storage/batch-download";

interface BatchDocumentDownloadButtonProps {
  endpoint: {
    downloadTenderDocument: (id: string) => Promise<DownloadResult>;
  };
  documents: ReadonlyArray<{ id: string }>;
  documentActionPort?: DocumentActionPort;
}

type State =
  | { status: "idle" }
  | { status: "downloading"; completed: number; total: number }
  | { status: "result"; message: string; failed: boolean };

export function BatchDocumentDownloadButton({
  endpoint,
  documents,
  documentActionPort = createTauriDocumentActionPort(),
}: BatchDocumentDownloadButtonProps) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function downloadAll() {
    setState({ status: "downloading", completed: 0, total: documents.length });
    try {
      const outcome = await downloadDocumentBatch(
        documentActionPort,
        documents,
        (id) => endpoint.downloadTenderDocument(id),
        (completed, total) =>
          setState({ status: "downloading", completed, total }),
      );
      if (outcome.status === "cancelled") {
        setState({ status: "idle" });
        return;
      }
      const message =
        outcome.failed === 0
          ? `Downloaded ${outcome.saved} ${outcome.saved === 1 ? "document" : "documents"}.`
          : `Downloaded ${outcome.saved} of ${outcome.saved + outcome.failed} documents; ${outcome.failed} failed.`;
      setState({ status: "result", message, failed: outcome.failed > 0 });
    } catch {
      setState({
        status: "result",
        message: "Could not start the batch download. Try again.",
        failed: true,
      });
    }
  }

  const downloading = state.status === "downloading";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={downloading || documents.length === 0}
        onClick={downloadAll}
        className="rounded border border-border px-2.5 py-1 text-xs text-foreground disabled:opacity-50"
      >
        {downloading
          ? `Downloading ${state.completed} of ${state.total}…`
          : "Download all"}
      </button>
      {state.status === "result" && (
        <p
          role={state.failed ? "alert" : "status"}
          className={
            state.failed
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
