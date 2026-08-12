import { NavLink } from "react-router-dom";
import type { WorkflowStage, WorkflowStageSummary } from "./workflow-state";

export interface WorkflowNavigationProps {
  applicationId: string;
  activeStage: WorkflowStage;
  stages: WorkflowStageSummary[];
}

export function WorkflowNavigation({
  applicationId,
  activeStage,
  stages,
}: WorkflowNavigationProps) {
  return (
    <nav aria-label="Tender preparation workflow">
      <ol className="grid gap-2 sm:grid-cols-5 xl:grid-cols-1">
        {stages.map((stage, index) => {
          const active = stage.stage === activeStage;
          return (
            <li key={stage.stage}>
              <NavLink
                to={`/applications/${encodeURIComponent(applicationId)}/${stage.stage}`}
                aria-current={active ? "step" : undefined}
                className={`flex min-h-16 items-start gap-3 rounded-lg border px-3 py-3 transition-colors ${
                  active
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    {stage.label}
                  </span>
                  <span className="mt-0.5 block text-xs">
                    {active ? "Current stage" : stage.stateLabel}
                  </span>
                </span>
              </NavLink>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
