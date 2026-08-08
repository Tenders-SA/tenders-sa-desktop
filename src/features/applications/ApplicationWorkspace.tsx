import { useState } from "react";
import { Link } from "react-router-dom";
import { AsyncSection, Panel } from "../../components/common/AsyncSection";
import { useAsync, type AsyncState } from "../../hooks/use-async";
import {
  describeApplicationStatus,
  type ApplicationDetail,
  type ApplicationsEndpoint,
  type CockpitPayload,
  type SubmissionReadiness,
} from "../../services/api/endpoints/applications";
import { describeApiError } from "../../services/api/describe-error";
import { ClosingLabel } from "../tenders/ClosingLabel";
import { describeJsonField } from "../tenders/tender-fields";
import { StageBar } from "./workspace/StageBar";
import { UrgencyBanner } from "./workspace/UrgencyBanner";
import { AnalysisStatusPanel } from "./workspace/AnalysisStatusPanel";
import { ValueEstimatePanel } from "./workspace/ValueEstimatePanel";
import { ChecklistPanel } from "./workspace/ChecklistPanel";
import { EventsPanel } from "./workspace/EventsPanel";
import { ComplianceGapsPanel } from "./workspace/ComplianceGapsPanel";
import { ResearchPanel } from "./workspace/ResearchPanel";
import { AdditionalInfoPanel } from "./workspace/AdditionalInfoPanel";

export interface ApplicationWorkspaceProps {
  endpoint: ApplicationsEndpoint;
  applicationId: string;
}

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

/**
 * Application workspace (brief §4.1, §6).
 *
 * One parent response carries both sides of the comparison the brief calls
 * for: the tender's requirements, eligibility criteria and required documents,
 * *and* the company's B-BBEE level, industry codes, operating provinces and
 * turnover. Putting them on one screen is the point — steps 4 and 5 of the
 * brief's workflow are "compare the tender requirements against the company
 * profile" and "identify gaps".
 *
 * **Nothing here submits anything.** Brief §4.3 requires human approval for
 * bid decisions, pricing, proposal completion and final submission packs.
 * Readiness is *reported* on request and never acted on, and the button that
 * triggers it says "Check" rather than anything that implies submission.
 */
export function ApplicationWorkspace({
  endpoint,
  applicationId,
}: ApplicationWorkspaceProps) {
  const state = useAsync(
    (signal) => endpoint.get(applicationId, signal),
    [endpoint, applicationId],
  );

  // One cockpit request shared by every panel that renders the assist
  // payload (R-W-5): a changed parent shape then degrades one panel to its
  // own error state instead of failing the whole workspace.
  const cockpitState = useAsync(
    (signal) => endpoint.getCockpit(applicationId, signal),
    [endpoint, applicationId],
  );

  return (
    <section aria-labelledby="workspace-heading" className="max-w-4xl">
      <Link
        to="/applications"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Back to applications
      </Link>

      <div className="mt-4">
        <AsyncSection
          state={state}
          subject="this application"
          onRetry={state.reload}
        >
          {(application) => (
            <WorkspaceBody
              application={application}
              endpoint={endpoint}
              applicationId={applicationId}
              cockpitState={cockpitState}
              onDetailReload={state.reload}
            />
          )}
        </AsyncSection>
      </div>
    </section>
  );
}

function WorkspaceBody({
  application,
  endpoint,
  applicationId,
  cockpitState,
  onDetailReload,
}: {
  application: ApplicationDetail;
  endpoint: ApplicationsEndpoint;
  applicationId: string;
  cockpitState: AsyncState<CockpitPayload>;
  onDetailReload: () => void;
}) {
  const { tender, company } = application;

  return (
    <>
      <h1
        id="workspace-heading"
        className="text-xl font-semibold text-foreground"
      >
        {tender.title}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {tender.sourceOrganization ?? "Buyer not recorded"}
      </p>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="font-medium text-foreground">
          {describeApplicationStatus(application.status)}
        </span>
        {tender.closingDate ? (
          <ClosingLabel closingDate={tender.closingDate} />
        ) : (
          <span className="text-muted-foreground">No closing date</span>
        )}
        {typeof tender.estimatedValue === "number" && (
          <span className="text-muted-foreground">
            {ZAR.format(tender.estimatedValue)}
          </span>
        )}
        {tender.referenceNumber && (
          <span className="text-muted-foreground">
            Ref {tender.referenceNumber}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <Panel title="Workspace stage">
          <StageBar
            endpoint={endpoint}
            applicationId={applicationId}
            applicationStatus={application.status}
            onChanged={onDetailReload}
          />
        </Panel>
        <UrgencyBanner state={cockpitState} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="What the tender requires">
          <FieldList heading="Requirements" value={tender.requirements} />
          <FieldList
            heading="Eligibility criteria"
            value={tender.eligibilityCriteria}
          />
          <FieldList
            heading="B-BBEE requirements"
            value={tender.bbbeeRequirements}
          />
          <FieldList
            heading="Required documents"
            value={tender.requiredDocuments}
          />
          {!hasAnyField([
            tender.requirements,
            tender.eligibilityCriteria,
            tender.bbbeeRequirements,
            tender.requiredDocuments,
          ]) && (
            // Distinguishes "not extracted" from "none required". The parent
            // defaults these to null when parsing fails, so an empty panel
            // must not read as "this tender asks for nothing".
            <p className="text-sm text-muted-foreground">
              No requirements have been extracted from this tender's documents
              yet.
            </p>
          )}
        </Panel>

        <Panel title="What your company has">
          {company ? (
            <dl className="flex flex-col gap-2">
              <Row label="Company">{company.name}</Row>
              {company.registrationNumber && (
                <Row label="Registration">{company.registrationNumber}</Row>
              )}
              <Row label="B-BBEE level">
                {company.bbbeeLevel === null ||
                company.bbbeeLevel === undefined ? (
                  <span className="text-muted-foreground">Not recorded</span>
                ) : (
                  String(company.bbbeeLevel)
                )}
              </Row>
              <Row label="Annual turnover">
                {company.annualTurnover === null ||
                company.annualTurnover === undefined ? (
                  <span className="text-muted-foreground">Not recorded</span>
                ) : typeof company.annualTurnover === "number" ? (
                  ZAR.format(company.annualTurnover)
                ) : (
                  company.annualTurnover
                )}
              </Row>
              <InlineFieldRow
                label="Industry codes"
                value={company.industryCodes}
              />
              <InlineFieldRow
                label="Operating provinces"
                value={company.provincesOperating}
              />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              No company profile is attached to this application.
            </p>
          )}
          <Link
            to="/company"
            className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
          >
            View full company profile
          </Link>
        </Panel>
      </div>

      <div className="mt-4">
        <ReadinessPanel endpoint={endpoint} applicationId={applicationId} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AnalysisStatusPanel state={cockpitState} />
        <ValueEstimatePanel state={cockpitState} />
        <ChecklistPanel state={cockpitState} />
        <EventsPanel state={cockpitState} />
        <ComplianceGapsPanel
          endpoint={endpoint}
          applicationId={applicationId}
        />
        <ResearchPanel endpoint={endpoint} applicationId={applicationId} />
        <AdditionalInfoPanel
          endpoint={endpoint}
          applicationId={applicationId}
        />
      </div>

      {application.notes && (
        <div className="mt-4">
          <Panel title="Notes">
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {application.notes}
            </p>
          </Panel>
        </div>
      )}

      <div className="mt-4">
        <Panel
          title={`Tender documents${
            tender.documents?.length ? ` (${tender.documents.length})` : ""
          }`}
        >
          {tender.documents && tender.documents.length > 0 ? (
            <>
              <ul className="flex flex-col gap-1">
                {tender.documents.map((document) => (
                  <li
                    key={document.id}
                    className="text-sm text-muted-foreground"
                  >
                    {document.fileName ?? "Unnamed document"}
                    {document.documentCategory
                      ? ` · ${document.documentCategory}`
                      : ""}
                  </li>
                ))}
              </ul>
              {/* INT-4: downloads go through the parent's R2 download-url
                  route. Not wired here, and saying so beats a dead control. */}
              <p className="mt-2 text-sm text-muted-foreground">
                Opening tender documents is not available in this build.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No documents are attached to this tender.
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}

/**
 * Submission readiness — reported, never acted on (brief §4.3).
 *
 * Deliberately **not** loaded on mount. It is a POST that recomputes
 * validation server-side, and running it automatically on every visit would
 * spend server work the user did not ask for and imply the app is checking
 * continuously when it is not.
 */
function ReadinessPanel({
  endpoint,
  applicationId,
}: {
  endpoint: ApplicationsEndpoint;
  applicationId: string;
}) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "checking" }
    | { status: "done"; readiness: SubmissionReadiness }
    | { status: "error"; message: string; kind: string }
  >({ status: "idle" });

  return (
    <Panel
      title="Submission readiness"
      aside={
        <button
          type="button"
          disabled={state.status === "checking"}
          onClick={() => {
            setState({ status: "checking" });
            endpoint
              .validate(applicationId)
              .then((readiness) => setState({ status: "done", readiness }))
              .catch((error: unknown) =>
                setState({
                  status: "error",
                  ...describeApiError(error, "the readiness check"),
                }),
              );
          }}
          className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
        >
          {state.status === "checking" ? "Checking…" : "Check readiness"}
        </button>
      }
    >
      {state.status === "idle" && (
        <p className="text-sm text-muted-foreground">
          Check what is still outstanding before this bid can be submitted.
        </p>
      )}

      {state.status === "checking" && (
        <p role="status" className="text-sm text-muted-foreground">
          Checking submission readiness…
        </p>
      )}

      {state.status === "error" && (
        <p
          role="alert"
          data-error-kind={state.kind}
          className="text-sm text-destructive"
        >
          {state.message}
        </p>
      )}

      {state.status === "done" && (
        <div>
          <p
            className={
              state.readiness.ready
                ? "text-sm font-medium text-success"
                : "text-sm font-medium text-warning"
            }
          >
            {state.readiness.ready
              ? "No outstanding items were found."
              : "This bid is not ready to submit."}
          </p>
          {/* Even when ready, the app never submits. A human decides. */}
          {state.readiness.ready && (
            <p className="mt-1 text-sm text-muted-foreground">
              Submitting remains a manual step you take on the Tenders-SA
              website.
            </p>
          )}
          <ProblemList heading="Blocking" items={state.readiness.blockers} />
          <ProblemList
            heading="Worth checking"
            items={state.readiness.warnings}
          />
        </div>
      )}
    </Panel>
  );
}

function ProblemList({ heading, items }: { heading: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {heading}
      </h3>
      <ul className="mt-1 flex flex-col gap-0.5">
        {items.map((item, index) => (
          <li
            key={`${index}-${item}`}
            className="text-sm text-muted-foreground"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A section for one unknown-shaped field, omitted when unreadable (E-11). */
function FieldList({ heading, value }: { heading: string; value: unknown }) {
  const lines = describeJsonField(value);
  if (lines === null) return null;
  return (
    <div className="mb-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {heading}
      </h3>
      <ul className="mt-1 flex flex-col gap-0.5">
        {lines.map((line, index) => (
          <li
            key={`${index}-${line}`}
            className="text-sm text-muted-foreground"
          >
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InlineFieldRow({ label, value }: { label: string; value: unknown }) {
  const lines = describeJsonField(value);
  return (
    <Row label={label}>
      {lines === null ? (
        <span className="text-muted-foreground">Not recorded</span>
      ) : (
        lines.join(", ")
      )}
    </Row>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-40 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

function hasAnyField(values: unknown[]): boolean {
  return values.some((value) => describeJsonField(value) !== null);
}
