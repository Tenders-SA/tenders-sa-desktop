import { AsyncSection, Panel } from "../../components/common/AsyncSection";
import { useAsync } from "../../hooks/use-async";
import type { DashboardEndpoint } from "../../services/api/endpoints/dashboard";
import { ClosingLabel } from "../tenders/ClosingLabel";

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

/**
 * Deadlines, document alerts and pipeline value (brief §6.1).
 *
 * All three come from `/api/v1/dashboard/summary` in one call, which is the
 * parent's own grouping — they are computed together from the same
 * application set, so splitting them would mean three queries for one answer.
 *
 * The deadline window is the server's seven days, not a locally chosen one.
 * The brief asks for "closing this week"; letting the client pick the window
 * would make the desktop and the web app disagree about the same number.
 */
export function DeadlinePanel({ endpoint }: { endpoint: DashboardEndpoint }) {
  const state = useAsync((signal) => endpoint.getSummary(signal), [endpoint]);

  return (
    <Panel title="Closing this week">
      <AsyncSection
        state={state}
        subject="your deadlines"
        onRetry={state.reload}
      >
        {(summary) => (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <Stat
                label={
                  summary.upcomingDeadlines.count === 1
                    ? "Application"
                    : "Applications"
                }
                value={String(summary.upcomingDeadlines.count)}
              />
              <Stat
                label="Document alerts"
                value={String(summary.documentAlerts.count)}
              />
              <Stat
                label="Pipeline value"
                value={
                  summary.pipelineValue.total > 0
                    ? ZAR.format(summary.pipelineValue.total)
                    : "—"
                }
              />
            </div>

            {summary.upcomingDeadlines.applications.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing closes in the next seven days.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {summary.upcomingDeadlines.applications.map((application) => (
                  <li
                    key={application.id}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="min-w-0 truncate text-sm text-foreground">
                      {application.title}
                    </span>
                    <span className="shrink-0 text-sm">
                      {application.closingDate ? (
                        <ClosingLabel closingDate={application.closingDate} />
                      ) : (
                        // The parent returns null when the tender has no
                        // closing date. Rendering "Closes in NaN days" would
                        // be worse than saying nothing useful is known.
                        <span className="text-muted-foreground">
                          No closing date
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </AsyncSection>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-semibold text-card-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
