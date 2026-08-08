/**
 * Analysis status and quality checks for the workspace (cockpit payload).
 *
 * The parent completes analysis asynchronously; `analysisStatus` tells the
 * user whether that work has finished, and `qualityChecks` are the individual
 * checks behind it. Unknown states render as plain text rather than failing.
 */

import { Panel } from "../../../components/common/AsyncSection";
import type { AsyncState } from "../../../hooks/use-async";
import { AsyncSection } from "../../../components/common/AsyncSection";
import type { CockpitPayload } from "../../../services/api/endpoints/applications";

export interface AnalysisStatusPanelProps {
  state: AsyncState<CockpitPayload>;
}

const CHECK_CLASS: Record<string, string> = {
  pass: "text-success",
  passed: "text-success",
  fail: "text-destructive",
  failed: "text-destructive",
  warn: "text-warning",
};

export function AnalysisStatusPanel({ state }: AnalysisStatusPanelProps) {
  return (
    <AsyncSection
      state={state}
      subject="the analysis status"
      isEmpty={(cockpit) =>
        !cockpit.analysisStatus && !cockpit.qualityChecks?.length
      }
      empty={null}
    >
      {(cockpit) => {
        const status = cockpit.analysisStatus;
        const checks = cockpit.qualityChecks ?? [];
        if (!status && checks.length === 0) return null;
        return (
          <Panel title="Analysis">
            {status ? (
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-foreground">
                  {status.message ?? "Analysis is in progress."}
                </p>
                {typeof status.progress === "number" && (
                  <span className="text-sm text-muted-foreground">
                    {status.progress}%
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Analysis status unavailable.
              </p>
            )}
            {checks.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1">
                {checks.map((check) => {
                  const statusClass =
                    CHECK_CLASS[String(check.status ?? "").toLowerCase()] ??
                    "text-muted-foreground";
                  return (
                    <li
                      key={
                        check.id ?? check.category ?? check.message ?? "check"
                      }
                      className="flex items-baseline gap-2 text-sm"
                    >
                      <span className={statusClass}>
                        {check.status === "pass" || check.status === "passed"
                          ? "✓"
                          : check.status === "fail" || check.status === "failed"
                            ? "✕"
                            : "·"}
                      </span>
                      <span className="text-foreground">{check.message}</span>
                      {check.category && (
                        <span className="text-muted-foreground">
                          {check.category}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        );
      }}
    </AsyncSection>
  );
}
