import { useState } from "react";
import { Link } from "react-router-dom";
import { AsyncSection } from "../../components/common/AsyncSection";
import { useAsync } from "../../hooks/use-async";
import {
  describeMatchCategory,
  type RecommendationsEndpoint,
  type RecommendedTender,
} from "../../services/api/endpoints/recommendations";
import { ClosingLabel } from "../tenders/ClosingLabel";
import { MatchFactors } from "./MatchFactors";

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

export interface TenderRadarProps {
  endpoint: RecommendationsEndpoint;
  /** Removes the route-level heading when Radar is part of Opportunity Desk. */
  embedded?: boolean;
}

/**
 * Tender Radar (brief §6.2) — tenders scored against the company profile.
 *
 * This is the radar the brief describes, as distinct from `/tenders`, which is
 * a keyword search over the whole corpus. The score, its factor breakdown and
 * the improvement areas are **all computed server-side**: matching reads award
 * history, personnel, equipment and financial capacity, none of which the
 * desktop can see, so any locally computed score would be a different number
 * wearing the same label.
 *
 * The three states are kept distinct on purpose. `no_company_profile` is not
 * "no matches" — it means matching had nothing to compare against, and the fix
 * is the company profile, not a wider search. Collapsing the two would send a
 * new user hunting for tenders that were never going to appear.
 */
export function TenderRadar({ endpoint, embedded = false }: TenderRadarProps) {
  const [minScore, setMinScore] = useState(60);
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const state = useAsync(
    (signal) => endpoint.list({ minScore, offset, limit: 20 }, signal),
    [endpoint, minScore, offset],
  );

  return (
    <section
      aria-labelledby={embedded ? "company-matches-heading" : "radar-heading"}
      className={embedded ? "" : "max-w-4xl"}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        {embedded ? (
          <div>
            <h2
              id="company-matches-heading"
              className="text-base font-semibold text-foreground"
            >
              Prioritised opportunities
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Server-calculated against your company profile and readiness.
            </p>
          </div>
        ) : (
          <h1
            id="radar-heading"
            className="text-xl font-semibold text-foreground"
          >
            Tender Radar
          </h1>
        )}
        <button
          type="button"
          disabled={refreshing}
          onClick={() => {
            setRefreshing(true);
            // Recomputing is server work that can take a while; the reload
            // shows whatever the parent has once it finishes.
            endpoint
              .refresh()
              .catch(() => undefined)
              .finally(() => {
                setRefreshing(false);
                state.reload();
              });
          }}
          className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
        >
          {refreshing ? "Recalculating…" : "Recalculate matches"}
        </button>
      </div>

      {!embedded && (
        <p className="mt-2 text-sm text-muted-foreground">
          Open tenders scored against your company profile.
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <label
          htmlFor="radar-min-score"
          className="text-sm text-muted-foreground"
        >
          Minimum match
        </label>
        <select
          id="radar-min-score"
          value={minScore}
          onChange={(event) => {
            setOffset(0);
            setMinScore(Number(event.target.value));
          }}
          className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
        >
          {[40, 50, 60, 70, 80, 90].map((value) => (
            <option key={value} value={value}>
              {value}%
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        <AsyncSection
          state={state}
          subject="your matches"
          onRetry={state.reload}
        >
          {(result) => {
            if (result.state === "no_company_profile") {
              return <NoProfileNotice />;
            }
            if (result.recommendations.length === 0) {
              return (
                <p className="text-sm text-muted-foreground">
                  No open tenders currently match at {minScore}% or above. Try
                  lowering the minimum match.
                </p>
              );
            }
            return (
              <>
                <ul className="flex flex-col gap-3">
                  {result.recommendations.map((recommendation) => (
                    <RadarRow
                      key={recommendation.id}
                      recommendation={recommendation}
                    />
                  ))}
                </ul>

                <nav
                  aria-label="Pagination"
                  className="mt-6 flex items-center justify-between"
                >
                  <button
                    type="button"
                    disabled={offset === 0}
                    onClick={() => setOffset((o) => Math.max(0, o - 20))}
                    className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={!result.hasMore}
                    onClick={() => setOffset((o) => o + 20)}
                    className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </>
            );
          }}
        </AsyncSection>
      </div>
    </section>
  );
}

/**
 * Matching needs a company profile. Saying "no matches" here would be
 * technically true and practically useless.
 */
function NoProfileNotice() {
  return (
    <div className="rounded border border-border bg-card p-6">
      <h2 className="text-sm font-medium text-card-foreground">
        Add your company profile to see matches
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tender Radar scores tenders against your industry, province, B-BBEE
        level and capacity. Without a profile there is nothing to score against.
      </p>
      <Link
        to="/company"
        className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
      >
        View company profile
      </Link>
    </div>
  );
}

function RadarRow({ recommendation }: { recommendation: RecommendedTender }) {
  const { tender, score } = recommendation;

  return (
    <li className="rounded border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate font-medium text-card-foreground">
            <Link
              to={`/tenders/${encodeURIComponent(tender.id)}`}
              className="hover:underline"
            >
              {tender.title}
            </Link>
          </h3>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {tender.sourceOrganization ?? "Buyer not recorded"}
            {tender.province ? ` · ${tender.province}` : ""}
          </p>
          {tender.referenceNumber && (
            <p className="mt-1 text-xs text-muted-foreground">
              Ref {tender.referenceNumber}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {/* Score as a number AND a band: the band is what a user should act
              on, and a bare percentage invites false precision. */}
          <p className="text-lg font-semibold text-card-foreground">{score}%</p>
          <p className="text-xs text-muted-foreground">
            {describeMatchCategory(recommendation.matchCategory)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
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
      </div>

      {recommendation.factors && (
        <MatchFactors factors={recommendation.factors} />
      )}

      {recommendation.reasoning && (
        <p className="mt-3 text-sm text-muted-foreground">
          {recommendation.reasoning}
        </p>
      )}

      <Gaps recommendation={recommendation} />
    </li>
  );
}

/**
 * What is missing, and what to do about it (brief §6.2 "Missing internal
 * requirements").
 *
 * Prefers the AI recommendation's split gaps/actions when present, because
 * "you lack X" and "do Y" are different information, and falls back to the
 * algorithmic `improvementAreas` otherwise.
 */
function Gaps({ recommendation }: { recommendation: RecommendedTender }) {
  const ai = recommendation.aiRecommendation?.improvementAreas;
  const gaps = ai?.gaps ?? recommendation.improvementAreas ?? [];
  const actions = ai?.actions ?? [];

  if (gaps.length === 0 && actions.length === 0) return null;

  return (
    <div className="mt-3 border-t border-border pt-3">
      {gaps.length > 0 && (
        <>
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Gaps
          </h4>
          <ul className="mt-1 flex flex-col gap-0.5">
            {gaps.map((gap, index) => (
              <li
                key={`${index}-${gap}`}
                className="text-sm text-muted-foreground"
              >
                {gap}
              </li>
            ))}
          </ul>
        </>
      )}
      {actions.length > 0 && (
        <>
          <h4 className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Suggested actions
          </h4>
          <ul className="mt-1 flex flex-col gap-0.5">
            {actions.map((action, index) => (
              <li
                key={`${index}-${action}`}
                className="text-sm text-muted-foreground"
              >
                {action}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
