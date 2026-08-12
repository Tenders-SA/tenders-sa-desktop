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

function SnapshotItem({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 rounded-lg border border-border/80 bg-background/80 px-4 py-3 ${className}`}
    >
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground">
        {children}
      </dd>
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
          <header className="mt-4 overflow-hidden rounded-xl border border-primary/25 bg-card shadow-sm">
            <div className="border-b border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 max-w-4xl">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Tender opportunity
                  </p>
                  <h1
                    id="tender-detail-heading"
                    className="mt-1 text-2xl font-semibold leading-tight text-foreground"
                  >
                    {tender.title}
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Issued by {tender.sourceOrganization}
                  </p>
                </div>
                {tender.status && (
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                    {tender.status}
                  </span>
                )}
              </div>
            </div>

            <dl className="grid gap-3 bg-muted/25 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <SnapshotItem label="Closing">
                <ClosingLabel closingDate={tender.closingDate} />
              </SnapshotItem>
              {tender.province && (
                <SnapshotItem label="Province">{tender.province}</SnapshotItem>
              )}
              {tender.type && (
                <SnapshotItem label="Procurement type">
                  {tender.type}
                </SnapshotItem>
              )}
              {tender.industryCategories &&
                tender.industryCategories.length > 0 && (
                  <SnapshotItem label="Industry">
                    {tender.industryCategories.join(", ")}
                  </SnapshotItem>
                )}
              {typeof tender.estimatedValue === "number" && (
                <SnapshotItem label="Estimated value">
                  {ZAR.format(tender.estimatedValue)}
                </SnapshotItem>
              )}
              <SnapshotItem
                label="Tender reference"
                className="sm:col-span-2 lg:col-span-3"
              >
                <span className="font-mono text-xs sm:text-sm">
                  {tender.referenceNumber}
                </span>
              </SnapshotItem>
              {tender.sourceUrl && (
                <SnapshotItem
                  label="Official source"
                  className="sm:col-span-2 lg:col-span-4"
                >
                  <span className="break-all font-normal">
                    {tender.sourceUrl}
                  </span>
                </SnapshotItem>
              )}
            </dl>
          </header>

          <TenderIntelligenceOverview tender={tender} />

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

function TenderIntelligenceOverview({ tender }: { tender: TenderDetailData }) {
  const summaries = (tender.documents ?? []).flatMap((document) => {
    const summary = document.summary?.trim();
    return summary ? [summary] : [];
  });
  const requirements = (tender.documents ?? [])
    .flatMap((document) => describeJsonField(document.keyPoints) ?? [])
    .filter(
      (requirement, index, all) =>
        all.findIndex(
          (candidate) => candidate.toLowerCase() === requirement.toLowerCase(),
        ) === index,
    );

  if (summaries.length === 0 && requirements.length === 0) return null;

  return (
    <section
      aria-labelledby="tender-intelligence-heading"
      className="mt-5 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-5 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
            AI-generated tender intelligence
          </p>
          <h2
            id="tender-intelligence-heading"
            className="mt-0.5 text-base font-semibold text-card-foreground"
          >
            Understand the opportunity at a glance
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">
          Verify against official documents
        </span>
      </header>
      <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        {summaries.length > 0 && (
          <div className="px-5 py-4 lg:border-r lg:border-border">
            <h3 className="text-sm font-semibold text-primary">AI Summary</h3>
            <div className="mt-2 space-y-2">
              {summaries.map((summary, index) => (
                <p
                  key={`${index}-${summary}`}
                  className="text-sm leading-6 text-foreground"
                >
                  {summary}
                </p>
              ))}
            </div>
          </div>
        )}
        {requirements.length > 0 && (
          <div className="border-t border-border px-5 py-4 lg:border-t-0">
            <h3 className="text-sm font-semibold text-foreground">
              Key Requirements
            </h3>
            <ul className="mt-2 space-y-2">
              {requirements.map((requirement, index) => (
                <li
                  key={`${index}-${requirement}`}
                  className="flex gap-2.5 text-sm leading-5 text-foreground"
                >
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-warning"
                  />
                  <span>{requirement}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
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
