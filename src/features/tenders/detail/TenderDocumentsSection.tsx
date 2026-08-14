import type { TenderDetail } from "../../../services/api/endpoints/tenders";
import type { DownloadResult } from "../../../services/api/transport";
import type { DocumentActionPort } from "../../../services/storage/document-actions";
import type { SaveDownloadPort } from "../../../services/storage/save-download";
import { BatchDocumentDownloadButton } from "../BatchDocumentDownloadButton";
import { DocumentDownloadButton } from "../DocumentDownloadButton";

export interface TenderDocumentsSectionProps {
  tender: TenderDetail;
  documents?: {
    downloadTenderDocument: (
      id: string,
      signal?: AbortSignal,
    ) => Promise<DownloadResult>;
  };
  savePort?: SaveDownloadPort;
  documentActionPort?: DocumentActionPort;
  onOpenDocument?: (documentId: string) => void;
}

/**
 * Reusable document inventory and desktop document actions.
 *
 * Downloads always use the injected authenticated endpoint. The component
 * never reads a tender document's source URL directly.
 */
export function TenderDocumentsSection({
  tender,
  documents,
  savePort,
  documentActionPort,
  onOpenDocument,
}: TenderDocumentsSectionProps) {
  const stats = tender.documentStats;
  const count = stats?.total ?? tender.documentCount ?? 0;
  if (count === 0) return null;

  return (
    <section className="mt-6 rounded border border-border bg-card p-4">
      <h2 className="text-sm font-medium text-card-foreground">
        {count} {count === 1 ? "document" : "documents"}
      </h2>
      {stats && (
        <p className="mt-1 text-sm text-muted-foreground">
          {stats.processed} processed
          {stats.pending > 0 ? `, ${stats.pending} still processing` : ""}
          {stats.failed > 0 ? `, ${stats.failed} failed` : ""}.
        </p>
      )}
      {tender.documents && tender.documents.length > 0 ? (
        <>
          {documents && tender.documents.length >= 2 && (
            <div className="mt-2">
              <BatchDocumentDownloadButton
                endpoint={documents}
                documents={tender.documents}
                documentActionPort={documentActionPort}
              />
            </div>
          )}
          <ul className="mt-2 flex flex-col gap-2">
            {tender.documents.map((document) => (
              <li key={document.id}>
                {documents ? (
                  <DocumentDownloadButton
                    endpoint={documents}
                    documentId={document.id}
                    documentName={document.fileName ?? "Unnamed document"}
                    savePort={savePort}
                    showOpen={Boolean(onOpenDocument)}
                    onOpen={() => onOpenDocument?.(document.id)}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {document.fileName ?? "Unnamed document"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Document names are not yet processed for this tender.
        </p>
      )}
      {documents === undefined && (
        <p className="mt-2 text-sm text-muted-foreground">
          Opening tender documents is not available in this build.
        </p>
      )}
    </section>
  );
}
