/**
 * Market research for the workspace (own route).
 *
 * The buyer organisation, the strongest competitors, provincial activity and
 * the company's eligibility flags. Competitors are ranked by award value;
 * only the top five are shown so the panel stays scannable.
 */

import { Panel } from "../../../components/common/AsyncSection";
import { useAsync } from "../../../hooks/use-async";
import { AsyncSection } from "../../../components/common/AsyncSection";
import type { ResearchPayload } from "../../../services/api/endpoints/applications";

export interface ResearchPanelProps {
  endpoint: {
    getResearch: (id: string, signal?: AbortSignal) => Promise<ResearchPayload>;
  };
  applicationId: string;
}

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

export function ResearchPanel({ endpoint, applicationId }: ResearchPanelProps) {
  const state = useAsync(
    (signal) => endpoint.getResearch(applicationId, signal),
    [endpoint, applicationId],
  );

  return (
    <AsyncSection
      state={state}
      subject="the market research"
      onRetry={state.reload}
      isEmpty={(research) => !research.organisation}
      empty={null}
    >
      {(research) => {
        if (!research.organisation) return null;
        const topCompetitors = [...(research.competitors ?? [])]
          .sort((a, b) => (b.totalValue ?? 0) - (a.totalValue ?? 0))
          .slice(0, 5);
        const eligibility = asEligibilityRecord(research.eligibility);
        return (
          <Panel title="Market research">
            <p className="text-sm font-medium text-foreground">
              {research.organisation.name}
            </p>
            {research.organisation.organizationType && (
              <p className="text-sm text-muted-foreground">
                {research.organisation.organizationType}
              </p>
            )}
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <Fact
                label="Live tenders"
                value={research.organisation.activeTenderCount}
              />
              <Fact
                label="Tender history"
                value={research.organisation.tenderCount}
              />
              <Fact label="Awards" value={research.organisation.awardCount} />
              {research.organisation.csdNumber && (
                <Fact label="CSD" value={research.organisation.csdNumber} />
              )}
            </dl>

            {topCompetitors.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Strongest competitors
                </h3>
                <ul className="mt-1 flex flex-col gap-1">
                  {topCompetitors.map((competitor, index) => (
                    <li
                      key={`${competitor.supplierName}-${index}`}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="text-foreground">
                        {competitor.supplierName}
                      </span>
                      <span className="text-muted-foreground">
                        {typeof competitor.totalValue === "number"
                          ? ZAR.format(competitor.totalValue)
                          : ""}
                        {competitor.awardCount !== undefined &&
                          ` · ${competitor.awardCount} award${
                            competitor.awardCount === 1 ? "" : "s"
                          }`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {research.provinceHealth && (
              <p className="mt-4 text-sm text-foreground">
                <span className="font-medium">
                  {research.provinceHealth.province}
                </span>{" "}
                activity is{" "}
                <span className="text-warning">
                  {research.provinceHealth.activityLevel?.toLowerCase()}
                </span>{" "}
                ({research.provinceHealth.score}).
              </p>
            )}

            {eligibility.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Eligibility
                </h3>
                <ul className="mt-1 flex flex-col gap-1">
                  {eligibility.map(([name, state_]) => (
                    <li
                      key={name}
                      className="flex items-baseline gap-2 text-sm"
                    >
                      <span
                        className={
                          state_.status === "pass" || state_.status === "passed"
                            ? "text-success"
                            : state_.status === "fail" ||
                                state_.status === "failed"
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }
                      >
                        {state_.status === "pass" || state_.status === "passed"
                          ? "✓"
                          : state_.status === "fail" ||
                              state_.status === "failed"
                            ? "✕"
                            : "·"}
                      </span>
                      <span className="text-foreground">{name}</span>
                      {state_.detail && (
                        <span className="text-muted-foreground">
                          {state_.detail}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        );
      }}
    </AsyncSection>
  );
}

function Fact({
  label,
  value,
}: {
  label: string;
  value: number | string | undefined;
}) {
  if (value === undefined) return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function asEligibilityRecord(
  eligibility: unknown,
): [string, { status?: string; detail?: string }][] {
  if (!eligibility || typeof eligibility !== "object") return [];
  const record = eligibility as Record<string, unknown>;
  const entries: [string, { status?: string; detail?: string }][] = [];
  for (const [name, value] of Object.entries(record)) {
    if (value && typeof value === "object") {
      const state_ = value as { status?: unknown; detail?: unknown };
      entries.push([
        name,
        {
          status: typeof state_.status === "string" ? state_.status : undefined,
          detail: typeof state_.detail === "string" ? state_.detail : undefined,
        },
      ]);
    }
  }
  return entries;
}
