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

const REFERENCE_TERMS: Record<string, string[]> = {
  pricing: ["pricing", "price", "rates", "boq", "bill of quantities"],
  technical: ["technical", "scope", "specification", "works"],
  quality: ["quality"],
  sheq: ["sheq", "safety", "health", "environment"],
  declaration: ["declaration", "sbd"],
  undertaking: ["undertaking", "local content", "sbd"],
  acknowledgement: ["acknowledgement", "conditions", "returnable"],
};

function relatedDocuments(
  selected: ResponseBlueprintDoc,
  documents: TenderDocument[],
) {
  const kindTerms = selected.kind ? (REFERENCE_TERMS[selected.kind] ?? []) : [];
  const titleTerms = [selected.title, selected.requiredBy]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/))
    .filter((value) => value.length >= 4);
  const terms = [...new Set([...kindTerms, ...titleTerms])];
  if (terms.length === 0) return documents;
  const matches = documents.filter((document) => {
    const name =
      `${document.fileName ?? ""} ${document.documentCategory ?? ""}`.toLowerCase();
    return terms.some((term) => name.includes(term));
  });
  return matches.length > 0 ? matches : documents;
}

export function DraftDocumentReferences({
  selected,
  tenderDocuments = [],
  documentsEndpoint,
  savePort,
  documentActionPort,
}: {
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
}) {
  const sources = relatedDocuments(selected, tenderDocuments);
  const isStructuredDraft = selected.kind === "pricing";

  return (
    <aside
      className="min-h-0 overflow-y-auto border-l border-border bg-card p-5 max-lg:hidden"
      aria-label="Document references"
    >
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

      {sources.length > 0 && (
        <section className="mt-5" aria-labelledby="official-files-heading">
          <h3 id="official-files-heading" className="text-sm font-semibold">
            {sources.length === tenderDocuments.length
              ? "Official tender files"
              : "Likely related tender files"}
          </h3>
          <div className="mt-2 space-y-3">
            {sources.map((document) =>
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
        </section>
      )}

      <p className="mt-5 text-xs leading-5 text-muted-foreground">
        Verify generated content against every official tender document before
        submission.
      </p>
    </aside>
  );
}
