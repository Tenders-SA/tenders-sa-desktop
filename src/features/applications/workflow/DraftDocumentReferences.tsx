import { useState } from "react";
import type {
  ApplicationDetail,
  ResponseBlueprintDoc,
} from "../../../services/api/endpoints/applications";
import type { DownloadResult } from "../../../services/api/transport";
import type { DocumentActionPort } from "../../../services/storage/document-actions";
import type { SaveDownloadPort } from "../../../services/storage/save-download";
import { DocumentDownloadButton } from "../../tenders/DocumentDownloadButton";

type TenderDocument = NonNullable<
  ApplicationDetail["tender"]["documents"]
>[number];

interface DraftDocumentReferencesProps {
  selected: ResponseBlueprintDoc;
  tenderDocuments?: TenderDocument[];
  documentsEndpoint?: {
    downloadTenderDocument: (
      id: string,
      signal?: AbortSignal,
    ) => Promise<DownloadResult>;
  };
  savePort?: SaveDownloadPort;
  documentActionPort?: DocumentActionPort;
}

interface ReferencesBodyProps {
  selected: ResponseBlueprintDoc;
  tenderDocuments: TenderDocument[];
  documentsEndpoint?: {
    downloadTenderDocument: (
      id: string,
      signal?: AbortSignal,
    ) => Promise<DownloadResult>;
  };
  savePort?: SaveDownloadPort;
  documentActionPort?: DocumentActionPort;
}

/**
 * Reference pane for the full-screen editor. Related files are the
 * server-provided tender documents — no desktop keyword table or taxonomy
 * (RH-7, conforms REQ-6A). Reachable below `lg` as a labelled drawer rather
 * than disappearing (RH-6).
 */
export function DraftDocumentReferences({
  selected,
  tenderDocuments = [],
  documentsEndpoint,
  savePort,
  documentActionPort,
}: DraftDocumentReferencesProps) {
  const [open, setOpen] = useState(false);
  const documents = tenderDocuments ?? [];

  return (
    <>
      <aside
        className="hidden min-h-0 overflow-y-auto border-l border-border bg-card p-5 lg:block"
        aria-label="Document references"
      >
        <ReferencesBody
          selected={selected}
          tenderDocuments={documents}
          documentsEndpoint={documentsEndpoint}
          savePort={savePort}
          documentActionPort={documentActionPort}
        />
      </aside>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow lg:hidden"
      >
        References
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/30"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <aside
            className="absolute right-0 top-0 flex h-full w-80 max-w-[85vw] flex-col border-l border-border bg-card"
            aria-label="Document references"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Document references</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-border px-2 py-1 text-sm"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <ReferencesBody
                selected={selected}
                tenderDocuments={documents}
                documentsEndpoint={documentsEndpoint}
                savePort={savePort}
                documentActionPort={documentActionPort}
              />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function ReferencesBody({
  selected,
  tenderDocuments,
  documentsEndpoint,
  savePort,
  documentActionPort,
}: ReferencesBodyProps) {
  const isStructuredDraft = selected.kind === "pricing";

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        {isStructuredDraft ? "Working draft" : "Drafting brief"}
      </p>
      <h3 className="mt-1 text-sm font-semibold">
        {selected.title ?? "Response document"}
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {selected.brief ?? "No document-specific brief is recorded."}
      </p>
      {selected.requiredBy && (
        <p className="mt-4 text-sm">
          <span className="font-medium">Required by:</span>{" "}
          {selected.requiredBy}
        </p>
      )}

      {isStructuredDraft && (
        <div className="mt-5 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <p className="text-sm font-medium">
            Complete the official returnable
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            This editor prepares working content. It does not alter the buyer's
            original spreadsheet, bill of quantities or PDF form. Transfer and
            verify the final values in the official file before submission.
          </p>
        </div>
      )}

      <section className="mt-5" aria-labelledby="official-files-heading">
        <h3 id="official-files-heading" className="text-sm font-semibold">
          Official tender files
        </h3>
        {tenderDocuments.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            No related tender files identified.
          </p>
        ) : (
          <div className="mt-2 space-y-3">
            {tenderDocuments.map((document) =>
              documentsEndpoint ? (
                <DocumentDownloadButton
                  key={document.id}
                  endpoint={documentsEndpoint}
                  documentId={document.id}
                  documentName={
                    document.fileName ??
                    document.documentCategory ??
                    "Tender document"
                  }
                  savePort={savePort}
                  documentActionPort={documentActionPort}
                />
              ) : (
                <p key={document.id} className="text-xs text-muted-foreground">
                  {document.fileName ??
                    document.documentCategory ??
                    "Tender document"}
                </p>
              ),
            )}
          </div>
        )}
      </section>

      <p className="mt-5 text-xs leading-5 text-muted-foreground">
        Verify generated content against every official tender document before
        submission.
      </p>
    </>
  );
}
