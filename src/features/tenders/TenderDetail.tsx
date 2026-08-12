import { useEffect, useState } from "react";
import { ApiError } from "../../services/api/errors";
import type {
  TenderDetail as TenderDetailData,
  TendersEndpoint,
} from "../../services/api/endpoints/tenders";
import type { DownloadResult } from "../../services/api/transport";
import type { SaveDownloadPort } from "../../services/storage/save-download";
import type { DocumentActionPort } from "../../services/storage/document-actions";
import { ClosingLabel } from "./ClosingLabel";
import { describeJsonField } from "./tender-fields";
import { describeTenderError } from "./tender-errors";
import { DocumentDownloadButton } from "./DocumentDownloadButton";
import { BatchDocumentDownloadButton } from "./BatchDocumentDownloadButton";
import { TenderAnalysisWorkbench } from "./detail/TenderAnalysisWorkbench";

export interface TenderDetailProps {
  endpoint: TendersEndpoint;
  tenderId: string;
  onBack?: () => void;
  /**
   * The decide-and-pursue controls, injected rather than built here so this
   * screen stays a pure read and can be tested without the mutating clients.
   */
  actions?: React.ReactNode;
  /**
   * Tender-document download client (Slice 7, R-D5). Optional so the screen
   * stays a pure read without it; the route passes `clients.documents`.
   */
  documents?: {
    downloadTenderDocument: (
      id: string,
      signal?: AbortSignal,
    ) => Promise<DownloadResult>;
  };
  savePort?: SaveDownloadPort;
  documentActionPort?: DocumentActionPort;
}

type State =
  | { status: "loading" }
  | { status: "ready"; tender: TenderDetailData }
  | { status: "error"; message: string; kind: string };

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-48 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

/**
 * A field whose runtime type the contract does not pin (gap E-11).
 *
 * Renders nothing at all when there is no readable content: an empty
 * "Requirements" heading would read as "this tender has no requirements",
 * which is a claim the payload does not support.
 */
function UnknownShapeSection({
  heading,
  value,
}: {
  heading: string;
  value: unknown;
}) {
  const lines = describeJsonField(value);
  if (lines === null) return null;

  return (
    <section className="mt-6">
      <h2 className="text-sm font-medium text-foreground">{heading}</h2>
      <ul className="mt-2 flex flex-col gap-1">
        {lines.map((line, index) => (
          <li
            // Lines are not guaranteed unique, so the index is the only
            // stable key available here.
            key={`${index}-${line}`}
            className="text-sm text-muted-foreground"
          >
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Tender detail.
 *
 * `GET /api/tenders/[id]` returns the tender object **bare**, with no
 * wrapper — a tenth distinct top-level shape, and different from the list
 * route that got the user here. The endpoint owns that; this screen owns
 * rendering it without assuming more than the contract guarantees.
 */
export function TenderDetail({
  endpoint,
  tenderId,
  onBack,
  actions,
  documents,
  savePort,
  documentActionPort,
}: TenderDetailProps) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ status: "loading" });

    endpoint
      .get(tenderId, controller.signal)
      .then((tender) => {
        if (active) setState({ status: "ready", tender });
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.kind === "cancelled") return;
        if (active) {
          setState({
            status: "error",
            ...describeTenderError(error, "this tender"),
          });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [endpoint, tenderId]);

  const tender = state.status === "ready" ? state.tender : undefined;

  return (
    <section aria-labelledby="tender-detail-heading" className="max-w-7xl">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to tenders
        </button>
      )}

      {state.status === "loading" && (
        <p role="status" className="mt-6 text-sm text-muted-foreground">
          Loading tender…
        </p>
      )}

      {state.status === "error" && (
        <p
          role="alert"
          data-error-kind={state.kind}
          className="mt-6 text-sm text-destructive"
        >
          {state.message}
        </p>
      )}

      {tender && (
        <>
          <h1
            id="tender-detail-heading"
            className="mt-4 text-xl font-semibold text-foreground"
          >
            {tender.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tender.sourceOrganization}
          </p>

          <div className="mt-4">
            <ClosingLabel closingDate={tender.closingDate} />
          </div>

          <dl className="mt-6 flex flex-col gap-2">
            <DetailRow label="Reference">{tender.referenceNumber}</DetailRow>
            {tender.province && (
              <DetailRow label="Province">{tender.province}</DetailRow>
            )}
            {tender.type && <DetailRow label="Type">{tender.type}</DetailRow>}
            {typeof tender.estimatedValue === "number" && (
              <DetailRow label="Estimated value">
                {ZAR.format(tender.estimatedValue)}
              </DetailRow>
            )}
            {tender.status && (
              <DetailRow label="Status">{tender.status}</DetailRow>
            )}
            {tender.industryCategories &&
              tender.industryCategories.length > 0 && (
                <DetailRow label="Industry">
                  {tender.industryCategories.join(", ")}
                </DetailRow>
              )}
            {tender.sourceUrl && (
              // Shown as text, not a link. The desktop never fetches
              // government sources directly (INT-4) -- documents come from
              // the parent's Worker/R2/D1 pipeline -- and there is no
              // external-open capability in the Tauri scope.
              <DetailRow label="Source">
                <span className="break-all">{tender.sourceUrl}</span>
              </DetailRow>
            )}
          </dl>

          <TenderAnalysisWorkbench tender={tender} />

          <ApplicationFacts tender={tender} />

          {tender.description && (
            <section className="mt-6">
              <h2 className="text-sm font-medium text-foreground">
                Description
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                {tender.description}
              </p>
            </section>
          )}

          <UnknownShapeSection
            heading="Requirements"
            value={tender.requirements}
          />
          <UnknownShapeSection
            heading="Eligibility criteria"
            value={tender.eligibilityCriteria}
          />
          <UnknownShapeSection
            heading="B-BBEE requirements"
            value={tender.bbbeeRequirements}
          />

          <DocumentsSection
            tender={tender}
            documents={documents}
            savePort={savePort}
            documentActionPort={documentActionPort}
          />

          {actions}
        </>
      )}
    </section>
  );
}

function ApplicationFacts({ tender }: { tender: TenderDetailData }) {
  const requirements = tender.submissionRequirements ?? [];
  const timeline = tender.timeline ?? [];
  if (requirements.length === 0 && timeline.length === 0) return null;
  return (
    <section className="mt-6 grid gap-4 lg:grid-cols-2">
      {requirements.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-card-foreground">
            Submission checklist
          </h2>
          <ul className="mt-3 space-y-3">
            {requirements.map((item) => (
              <li key={item.id} className="flex items-start gap-3 text-sm">
                <span
                  className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    item.isMandatory
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {item.isMandatory ? "Mandatory" : "Supporting"}
                </span>
                <span>
                  <span className="text-foreground">{item.requirement}</span>
                  <span className="block text-xs text-muted-foreground">
                    {item.category}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {timeline.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-card-foreground">
            Important tender dates
          </h2>
          <ol className="mt-3 space-y-3 border-l border-border pl-4">
            {timeline.map((event) => (
              <li key={event.id} className="text-sm">
                <p className="font-medium text-foreground">{event.title}</p>
                <time className="text-xs text-muted-foreground">
                  {new Date(event.eventDate).toLocaleString("en-ZA")}
                </time>
                {event.description && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {event.description}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

/**
 * Document metadata with a per-document download control (Slice 7, R-D5).
 *
 * Downloading goes through the parent's
 * `/api/v1/documents/[id]/download-url?requireR2=1` route (INT-4) — never a
 * direct fetch of `sourceUrl`. Without the injected client the section still
 * lists the files and says downloads are unavailable, honestly.
 */
function DocumentsSection({
  tender,
  documents,
  savePort,
  documentActionPort,
}: {
  tender: TenderDetailData;
  documents?: TenderDetailProps["documents"];
  savePort?: SaveDownloadPort;
  documentActionPort?: DocumentActionPort;
}) {
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
                    documentActionPort={documentActionPort}
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
