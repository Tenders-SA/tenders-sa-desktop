import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { AsyncSection } from "../../components/common/AsyncSection";
import {
  describeMatchCategory,
  type RecommendationsEndpoint,
  type RecommendedTender,
  radarResultSchema,
} from "../../services/api/endpoints/recommendations";
import { ClosingLabel } from "../tenders/ClosingLabel";
import { MatchFactors } from "./MatchFactors";
import { useWorkspaceAsync } from "../../hooks/use-workspace-async";
import { workspaceQueryKey } from "../../services/storage/cache-key";
import { WorkspaceDataStatus } from "../../components/common/WorkspaceDataStatus";
import type { SavedTendersEndpoint } from "../../services/api/endpoints/saved-tenders";
import type { CompanyEndpoint } from "../../services/api/endpoints/company";
import type { SubscriptionEndpoint } from "../../services/api/endpoints/subscription";
import {
  capRadarMatches,
  countRadarBands,
  filterRadarMatches,
  normalizeRadarMatches,
  RADAR_REVEAL_SIZE,
  revealRadarMatches,
  sortRadarMatches,
  type RadarAccess,
  type RadarFilters,
  type RadarSort,
  type RadarWorkspaceMatch,
} from "./radar-workspace-model";
import { RadarHeader } from "./RadarHeader";
import { RadarControls } from "./RadarControls";
import { RadarCard } from "./RadarCard";

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

type FullTenderRadarProps = {
  embedded?: false;
  recommendations: RecommendationsEndpoint;
  savedTenders: SavedTendersEndpoint;
  company: CompanyEndpoint;
  subscription: SubscriptionEndpoint;
};

type EmbeddedTenderRadarProps = {
  embedded: true;
  recommendations: RecommendationsEndpoint;
};

/** Removed in TASK-3.7 after the two existing consumers are rewired. */
type TransitionalTenderRadarProps = {
  endpoint: RecommendationsEndpoint;
  embedded?: boolean;
};

export type TenderRadarProps =
  | FullTenderRadarProps
  | EmbeddedTenderRadarProps
  | TransitionalTenderRadarProps;

interface RadarWorkspaceSnapshot {
  access: RadarAccess;
  matches: RadarWorkspaceMatch[];
  profileState: "ready" | "missing" | "unavailable";
  savedState: "ready" | "unavailable";
  lastUpdated: string | null;
}

const radarWorkspaceSnapshotSchema = z.custom<RadarWorkspaceSnapshot>(
  (value) => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<RadarWorkspaceSnapshot>;
    return (
      ["free", "starter", "professional", "enterprise"].includes(
        String(candidate.access),
      ) &&
      Array.isArray(candidate.matches) &&
      ["ready", "missing", "unavailable"].includes(
        String(candidate.profileState),
      ) &&
      ["ready", "unavailable"].includes(String(candidate.savedState)) &&
      (candidate.lastUpdated === null ||
        typeof candidate.lastUpdated === "string")
    );
  },
  { message: "Invalid cached Radar workspace" },
);

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
export function TenderRadar(props: TenderRadarProps) {
  if ("endpoint" in props) {
    return (
      <CompactRadar endpoint={props.endpoint} embedded={props.embedded ?? false} />
    );
  }
  if (props.embedded) {
    return <CompactRadar endpoint={props.recommendations} embedded />;
  }
  return <FullRadarController {...props} />;
}

function normalizeAccess(tier: string | undefined): RadarAccess {
  if (tier === "starter") return "starter";
  if (tier === "professional" || tier === "pro") return "professional";
  if (tier === "enterprise") return "enterprise";
  return "free";
}

function latestCalculation(matches: readonly RadarWorkspaceMatch[]): string | null {
  let latest: { value: string; time: number } | null = null;
  for (const match of matches) {
    const time = Date.parse(match.calculatedAt);
    if (Number.isFinite(time) && (!latest || time > latest.time)) {
      latest = { value: match.calculatedAt, time };
    }
  }
  return latest?.value ?? null;
}

function FullRadarController({
  recommendations,
  savedTenders,
  company,
  subscription,
}: FullTenderRadarProps) {
  const [filters, setFilters] = useState<RadarFilters>({
    band: "all",
    closingSoon: false,
    newThisWeek: false,
  });
  const [sort, setSort] = useState<RadarSort>("best_match");
  const [revealCount, setRevealCount] = useState(RADAR_REVEAL_SIZE);
  const [savedOverrides, setSavedOverrides] = useState<Record<string, boolean>>({});
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const [saveNotice, setSaveNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const state = useWorkspaceAsync({
    key: workspaceQueryKey("radar-workspace-v2", { minScore: 30, limit: 50 }),
    schema: radarWorkspaceSnapshotSchema,
    entity: "radar-list",
    load: async (signal): Promise<RadarWorkspaceSnapshot> => {
      const [recommendationResult, entitlementResult, profileResult, savedResult] =
        await Promise.allSettled([
          recommendations.list({ minScore: 30, limit: 50 }, signal),
          subscription.getStatus(signal),
          company.getExtendedProfile(signal),
          savedTenders.listAllIds(signal),
        ]);

      if (recommendationResult.status === "rejected") {
        throw recommendationResult.reason;
      }
      if (entitlementResult.status === "rejected") {
        throw entitlementResult.reason;
      }

      const entitlement = entitlementResult.value;
      const access = normalizeAccess(
        entitlement.kind === "none" ? undefined : entitlement.subscription.tier,
      );
      const savedIds =
        savedResult.status === "fulfilled" ? savedResult.value : [];
      const normalized = normalizeRadarMatches(
        recommendationResult.value.recommendations,
        savedIds,
      );
      const matches = capRadarMatches(normalized, access);
      const noProfile =
        recommendationResult.value.state === "no_company_profile" ||
        (profileResult.status === "fulfilled" && profileResult.value === undefined);

      return {
        access,
        matches,
        profileState:
          profileResult.status === "rejected"
            ? "unavailable"
            : noProfile
              ? "missing"
              : "ready",
        savedState: savedResult.status === "fulfilled" ? "ready" : "unavailable",
        lastUpdated: latestCalculation(matches),
      };
    },
    deps: [recommendations, savedTenders, company, subscription],
  });

  return (
    <section aria-labelledby="radar-heading" className="max-w-6xl">
      <div className="mt-2">
        <WorkspaceDataStatus
          stale={state.stale}
          refreshing={state.refreshing}
          refreshFailed={state.refreshFailed}
          subject="saved Radar workspace"
        />
      </div>
      <div className="mt-6">
        <AsyncSection state={state} subject="your Radar" onRetry={state.reload}>
          {(snapshot) => {
            if (snapshot.access === "free") {
              return (
                <div className="rounded-xl border border-border bg-card p-6">
                  <h1 id="radar-heading" className="text-xl font-semibold text-foreground">
                    Tender Radar is available on Starter and above
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Explore all tenders now, or review plan details in Settings.
                    Subscription changes are completed on tenders-sa.org.
                  </p>
                  <div className="mt-4 flex gap-4 text-sm font-medium">
                    <Link to="/tenders" className="text-primary hover:underline">
                      Browse tenders
                    </Link>
                    <Link to="/settings" className="text-primary hover:underline">
                      View plan details
                    </Link>
                  </div>
                </div>
              );
            }
            if (snapshot.profileState === "missing") return <NoProfileNotice />;
            const displayedMatches = snapshot.matches.map((match) => ({
              ...match,
              isSaved: savedOverrides[match.tenderId] ?? match.isSaved,
            }));
            const filteredMatches = filterRadarMatches(displayedMatches, filters);
            return (
              <div>
                <RadarHeader
                  access={snapshot.access}
                  counts={countRadarBands(displayedMatches)}
                  lastUpdated={snapshot.lastUpdated}
                />
                <RadarControls
                  counts={countRadarBands(snapshot.matches)}
                  filters={filters}
                  sort={sort}
                  onFiltersChange={(next) => {
                    setFilters(next);
                    setRevealCount(RADAR_REVEAL_SIZE);
                  }}
                  onSortChange={(next) => {
                    setSort(next);
                    setRevealCount(RADAR_REVEAL_SIZE);
                  }}
                  onReset={() => {
                    setFilters({ band: "all", closingSoon: false, newThisWeek: false });
                    setRevealCount(RADAR_REVEAL_SIZE);
                  }}
                />
                {snapshot.savedState === "unavailable" && (
                  <p role="status" className="mb-3 mt-4 text-sm text-muted-foreground">
                    Saved status is temporarily unavailable.
                  </p>
                )}
                {snapshot.profileState === "unavailable" && (
                  <p role="status" className="mb-3 text-sm text-muted-foreground">
                    Profile guidance is temporarily unavailable.
                  </p>
                )}
                {saveNotice && (
                  <p
                    role={saveNotice.kind === "error" ? "alert" : "status"}
                    aria-live="polite"
                    className={`mb-3 text-sm ${saveNotice.kind === "error" ? "text-destructive" : "text-foreground"}`}
                  >
                    {saveNotice.message}
                  </p>
                )}
                {snapshot.matches.length === 0 && (
                  <p className="mt-6 text-sm text-muted-foreground">
                    No current Radar matches are available.
                  </p>
                )}
                {displayedMatches.length > 0 && filteredMatches.length === 0 && (
                  <div className="mt-6 rounded border border-border p-5">
                    <p className="text-sm text-muted-foreground">
                      No matches meet these filters.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setFilters({ band: "all", closingSoon: false, newThisWeek: false });
                        setRevealCount(RADAR_REVEAL_SIZE);
                      }}
                      className="mt-2 text-sm font-medium text-primary hover:underline"
                    >
                      Reset filters
                    </button>
                  </div>
                )}
                <ul className="flex flex-col gap-3">
                  {revealRadarMatches(
                    sortRadarMatches(filteredMatches, sort),
                    revealCount,
                  ).map((match) => (
                    <RadarCard
                      key={match.matchingScoreId}
                      match={match}
                      saveDisabled={snapshot.savedState !== "ready"}
                      saving={savingIds.includes(match.tenderId)}
                      onToggleSave={async (selected) => {
                        if (
                          snapshot.savedState !== "ready" ||
                          savingIds.includes(selected.tenderId)
                        ) {
                          return;
                        }
                        setSavingIds((ids) => [...ids, selected.tenderId]);
                        setSaveNotice(null);
                        try {
                          const saved = await savedTenders.toggleSave(selected.tenderId);
                          setSavedOverrides((current) => ({
                            ...current,
                            [selected.tenderId]: saved,
                          }));
                          setSaveNotice({
                            kind: "success",
                            message: saved
                              ? `${selected.title} saved.`
                              : `${selected.title} removed from saved tenders.`,
                          });
                          state.reload();
                        } catch {
                          setSaveNotice({
                            kind: "error",
                            message: `Could not update saved state for ${selected.title}.`,
                          });
                        } finally {
                          setSavingIds((ids) =>
                            ids.filter((id) => id !== selected.tenderId),
                          );
                        }
                      }}
                    />
                  ))}
                </ul>
                {filteredMatches.length > revealCount && (
                  <button
                    type="button"
                    onClick={() => setRevealCount((count) => count + RADAR_REVEAL_SIZE)}
                    className="mt-5 rounded border border-border px-4 py-2 text-sm font-medium text-foreground"
                  >
                    Load 15 more
                  </button>
                )}
              </div>
            );
          }}
        </AsyncSection>
      </div>
    </section>
  );
}

function CompactRadar({
  endpoint,
  embedded = false,
}: {
  endpoint: RecommendationsEndpoint;
  embedded?: boolean;
}) {
  const [minScore, setMinScore] = useState(60);
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const query = { minScore, offset, limit: 20 };
  const state = useWorkspaceAsync({
    key: workspaceQueryKey("radar", query),
    schema: radarResultSchema,
    entity: "radar-list",
    load: (signal) => endpoint.list(query, signal),
    deps: [endpoint, minScore, offset],
  });

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
      <div className="mt-2">
        <WorkspaceDataStatus
          stale={state.stale}
          refreshing={state.refreshing}
          refreshFailed={state.refreshFailed}
          subject="saved matches"
        />
      </div>

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
