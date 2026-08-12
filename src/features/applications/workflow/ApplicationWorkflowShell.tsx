import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { ClosingLabel } from "../../tenders/ClosingLabel";
import {
  deriveWorkflowStages,
  type WorkflowEvidence,
  type WorkflowStage,
} from "./workflow-state";
import { WorkflowNavigation } from "./WorkflowNavigation";

export interface ApplicationWorkflowShellProps {
  applicationId: string;
  tenderId: string;
  activeStage: WorkflowStage;
  title: string;
  buyer?: string | null;
  reference?: string | null;
  applicationStatus: string;
  closingDate?: string | null;
  evidence: WorkflowEvidence;
  children: ReactNode;
}

export function ApplicationWorkflowShell({
  applicationId,
  tenderId,
  activeStage,
  title,
  buyer,
  reference,
  applicationStatus,
  closingDate,
  evidence,
  children,
}: ApplicationWorkflowShellProps) {
  const stages = deriveWorkflowStages(evidence);
  const active = stages.find((stage) => stage.stage === activeStage)!;
  const assessed = stages.filter(
    (stage) => stage.state !== "not-assessed",
  ).length;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/applications"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          ← Back to applications
        </Link>
        <Link
          to={`/tenders/${encodeURIComponent(tenderId)}`}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          View tender detail
        </Link>
      </div>

      <header className="mt-4 overflow-hidden rounded-xl border border-primary/25 bg-card shadow-sm">
        <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Tender application workspace
              </p>
              <h1
                id="workspace-heading"
                className="mt-1 break-words text-2xl font-semibold leading-tight text-foreground"
              >
                {title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {buyer ?? "Buyer not recorded"}
              </p>
            </div>
            <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              Application: {applicationStatus}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {reference && <span className="break-all">Ref {reference}</span>}
            {closingDate ? (
              <ClosingLabel closingDate={closingDate} />
            ) : (
              <span>No closing date</span>
            )}
            <span>
              {assessed} of {stages.length} stages assessed
            </span>
          </div>
        </div>
      </header>

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="min-w-0 xl:sticky xl:top-4 xl:h-fit">
          <WorkflowNavigation
            applicationId={applicationId}
            activeStage={activeStage}
            stages={stages}
          />
        </aside>
        <main
          id={`workflow-stage-${activeStage}`}
          aria-labelledby={`workflow-stage-heading-${activeStage}`}
          className="min-w-0"
        >
          <div className="mb-4 border-b border-border pb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Current preparation stage
            </p>
            <h2
              id={`workflow-stage-heading-${activeStage}`}
              className="mt-1 text-xl font-semibold text-foreground"
            >
              {active.label}
            </h2>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
