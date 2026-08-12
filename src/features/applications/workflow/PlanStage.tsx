import { useNavigate } from "react-router-dom";
import type { ApplicationsEndpoint } from "../../../services/api/endpoints/applications";
import { AdditionalInfoPanel } from "../workspace/AdditionalInfoPanel";
import { ResearchPanel } from "../workspace/ResearchPanel";
import { ResponseBlueprintPanel } from "../workspace/ResponseBlueprintPanel";

export interface PlanStageProps {
  applicationId: string;
  endpoint: ApplicationsEndpoint;
}

/** Turns the existing blueprint capabilities into a preparation-first plan. */
export function PlanStage({ applicationId, endpoint }: PlanStageProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      <section aria-labelledby="plan-information-heading">
        <div className="mb-3">
          <h3
            id="plan-information-heading"
            className="text-base font-semibold text-foreground"
          >
            Complete the information needed for drafting
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Required answers are saved deliberately and may unlock response
            document generation.
          </p>
        </div>
        <AdditionalInfoPanel
          endpoint={endpoint}
          applicationId={applicationId}
        />
      </section>

      <section aria-labelledby="response-plan-heading">
        <div className="mb-3">
          <h3
            id="response-plan-heading"
            className="text-base font-semibold text-foreground"
          >
            Response plan and document coverage
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Review required evidence, preparation steps, submission details and
            risks. Edit opens the full-screen drafting workbench.
          </p>
        </div>
        <ResponseBlueprintPanel
          endpoint={endpoint}
          applicationId={applicationId}
          onEditDocument={(key) =>
            navigate(
              `/applications/${encodeURIComponent(applicationId)}/draft/${encodeURIComponent(key)}`,
            )
          }
        />
      </section>

      <ResearchPanel endpoint={endpoint} applicationId={applicationId} />
    </div>
  );
}
