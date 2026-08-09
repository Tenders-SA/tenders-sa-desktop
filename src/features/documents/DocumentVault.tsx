import { useId, useState } from "react";
import { AsyncSection, Panel } from "../../components/common/AsyncSection";
import { useAsync } from "../../hooks/use-async";
import {
  describeDocumentType,
  describeExpiry,
  type CompanyDocument,
  type DocumentsEndpoint,
  type ExpiryStatus,
} from "../../services/api/endpoints/documents";
import { sortByUrgency } from "./document-order";
import { DocumentDownloadButton } from "../tenders/DocumentDownloadButton";
import type { SaveDownloadPort } from "../../services/storage/save-download";

export interface DocumentVaultProps {
  endpoint: DocumentsEndpoint;
  savePort?: SaveDownloadPort;
}

const STATUS_FILTERS: Array<{ value: "" | ExpiryStatus; label: string }> = [
  { value: "", label: "All documents" },
  { value: "expired", label: "Expired" },
  { value: "expiring", label: "Expiring soon" },
  { value: "valid", label: "In date" },
];

/**
 * Company Document Vault (brief §5).
 *
 * Expiry is the reason this screen matters: a lapsed tax clearance or B-BBEE
 * certificate disqualifies a bid outright. The parent computes `expiryStatus`
 * and `daysUntilExpiry`, and the desktop renders those rather than deriving
 * them from a local clock — a machine whose date is wrong by a day would
 * otherwise tell someone a certificate is valid when the buyer will reject it.
 *
 * Expiry is stated as **text**, never colour alone (A11Y-1), and expired
 * documents are listed first because they are the ones that block a bid.
 */
export function DocumentVault({ endpoint, savePort }: DocumentVaultProps) {
  const [status, setStatus] = useState<"" | ExpiryStatus>("");
  const [page, setPage] = useState(1);
  const statusId = useId();

  const documents = useAsync(
    (signal) =>
      endpoint.list({ page, limit: 25, status: status || undefined }, signal),
    [endpoint, page, status],
  );
  const stats = useAsync((signal) => endpoint.getStats(signal), [endpoint]);

  return (
    <section aria-labelledby="vault-heading" className="max-w-4xl">
      <h1 id="vault-heading" className="text-xl font-semibold text-foreground">
        Company Document Vault
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Compliance documents and their expiry dates.
      </p>

      <div className="mt-4">
        <Panel title="Overview">
          <AsyncSection
            state={stats}
            subject="document statistics"
            onRetry={stats.reload}
            isEmpty={() => false}
          >
            {(value) => (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Total" value={value.totalDocuments} />
                <Stat label="Expiring soon" value={value.expiringSoon} />
                <Stat label="Expired" value={value.expired} />
                <Stat label="In use" value={value.referencedDocuments} />
              </div>
            )}
          </AsyncSection>
        </Panel>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <label htmlFor={statusId} className="text-sm text-muted-foreground">
          Show
        </label>
        <select
          id={statusId}
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value as "" | ExpiryStatus);
          }}
          className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
        >
          {STATUS_FILTERS.map((filter) => (
            <option key={filter.label} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <AsyncSection
          state={documents}
          subject="your documents"
          onRetry={documents.reload}
          isEmpty={(result) => result.documents.length === 0}
          empty={
            <div className="rounded border border-border bg-card p-6">
              <h2 className="text-sm font-medium text-card-foreground">
                {status ? "No documents match this filter" : "No documents yet"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Documents are uploaded on the Tenders-SA website. Missing
                compliance documents also lower your Tender Radar scores.
              </p>
            </div>
          }
        >
          {(result) => (
            <>
              <ul className="flex flex-col gap-2">
                {sortByUrgency(result.documents).map((document) => (
                  <li
                    key={document.id}
                    className="flex items-start justify-between gap-4 rounded border border-border bg-card p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-card-foreground">
                        {describeDocumentType(document.documentType)}
                      </p>
                      {document.fileName && (
                        <p className="truncate text-sm text-muted-foreground">
                          {document.fileName}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {document.verified
                          ? "Verified"
                          : "Not verified by Tenders-SA"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2 text-right text-sm">
                      <ExpiryLabel document={document} />
                      <DocumentDownloadButton
                        endpoint={endpoint}
                        documentId={document.id}
                        savePort={savePort}
                        showOpen={false}
                      />
                    </div>
                  </li>
                ))}
              </ul>

              {result.totalPages > 1 && (
                <nav
                  aria-label="Pagination"
                  className="mt-6 flex items-center justify-between"
                >
                  <button
                    type="button"
                    disabled={result.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Page {result.page} of {result.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={result.page >= result.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              )}

              <p className="mt-4 text-sm text-muted-foreground">
                Uploading documents is done on the Tenders-SA website.
              </p>
            </>
          )}
        </AsyncSection>
      </div>
    </section>
  );
}

/** Expiry as words, with urgency carried by the text itself (A11Y-1). */
function ExpiryLabel({ document }: { document: CompanyDocument }) {
  const text = describeExpiry(document);
  if (!text) {
    // No expiry date recorded is not the same as "valid indefinitely".
    return <span className="text-muted-foreground">No expiry recorded</span>;
  }
  const tone =
    document.expiryStatus === "expired"
      ? "font-medium text-destructive"
      : document.expiryStatus === "expiring"
        ? "font-medium text-warning"
        : "text-muted-foreground";
  return <span className={tone}>{text}</span>;
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div>
      <p className="text-lg font-semibold text-card-foreground">
        {value ?? "—"}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
