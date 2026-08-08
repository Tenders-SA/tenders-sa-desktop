/**
 * Compliance gaps for the workspace (own route, R-W-2).
 *
 * Severity maps to the semantic status tokens: blocking is destructive,
 * important is a warning, strengths are calm success and info is muted. The
 * parent also returns a summary; both are rendered.
 */

import { Panel } from "../../../components/common/AsyncSection";
import { useAsync } from "../../../hooks/use-async";
import { AsyncSection } from "../../../components/common/AsyncSection";
import type {
  ComplianceGaps,
  ComplianceGap,
} from "../../../services/api/endpoints/applications";

export interface ComplianceGapsPanelProps {
  endpoint: {
    getComplianceGaps: (
      id: string,
      signal?: AbortSignal,
    ) => Promise<ComplianceGaps>;
  };
  applicationId: string;
}

const SEVERITY_CLASS: Record<string, string> = {
  blocking: "border-destructive/40",
  important: "border-warning/40",
  strengths: "border-success/40",
  info: "border-border",
};

const SEVERITY_LABEL: Record<string, string> = {
  blocking: "Blocking",
  important: "Important",
  strengths: "Strength",
  info: "Info",
};

export function ComplianceGapsPanel({
  endpoint,
  applicationId,
}: ComplianceGapsPanelProps) {
  const state = useAsync(
    (signal) => endpoint.getComplianceGaps(applicationId, signal),
    [endpoint, applicationId],
  );

  return (
    <AsyncSection
      state={state}
      subject="the compliance gaps"
      onRetry={state.reload}
      isEmpty={(gaps) => !gaps.gaps?.length}
      empty={
        <Panel title="Compliance">
          <p className="text-sm text-muted-foreground">
            No compliance gaps were found.
          </p>
        </Panel>
      }
    >
      {(gaps) => (
        <Panel
          title="Compliance"
          aside={
            gaps.summary ? (
              <span className="text-xs text-muted-foreground">
                {gaps.summary.blocking ?? 0} blocking ·{" "}
                {gaps.summary.important ?? 0} important ·{" "}
                {gaps.summary.strengths ?? 0} strengths
              </span>
            ) : undefined
          }
        >
          <ul className="flex flex-col gap-2">
            {(gaps.gaps ?? []).map((gap) => (
              <GapRow key={gap.id ?? gap.label ?? "gap"} gap={gap} />
            ))}
          </ul>
        </Panel>
      )}
    </AsyncSection>
  );
}

function GapRow({ gap }: { gap: ComplianceGap }) {
  const severity = String(gap.severity ?? "").toLowerCase();
  const borderClass = SEVERITY_CLASS[severity] ?? "border-border";
  return (
    <li className={`rounded border-l-2 ${borderClass} pl-3`}>
      <p className="text-sm font-medium text-foreground">
        {gap.label}
        {SEVERITY_LABEL[severity] && (
          <span className="ml-2 text-xs text-muted-foreground">
            {SEVERITY_LABEL[severity]}
          </span>
        )}
      </p>
      {gap.detail && (
        <p className="mt-0.5 text-sm text-muted-foreground">{gap.detail}</p>
      )}
      {gap.tenderRequirement && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          Tender requires: {gap.tenderRequirement}
        </p>
      )}
    </li>
  );
}
