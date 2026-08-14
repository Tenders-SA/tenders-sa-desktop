import type { RadarExtendedProfile } from "../../services/api/endpoints/company";
import type {
  RadarScenarioResult,
  RecommendedTender,
  ScoreFactors,
} from "../../services/api/endpoints/recommendations";

export type RadarAccess = "free" | "starter" | "professional" | "enterprise";
export type RadarBand =
  "highly_qualified" | "potential" | "near_miss" | "not_fit";
export type RadarSort =
  "best_match" | "closing_soon" | "newest" | "highest_value";

export interface RadarWorkspaceMatch {
  matchingScoreId: string;
  tenderId: string;
  title: string;
  referenceNumber: string | null;
  buyer: string | null;
  province: string | null;
  closingDate: string | null;
  estimatedValue: number | null;
  score: number;
  band: RadarBand;
  factors: ScoreFactors | null;
  reasoning: string | null;
  gaps: string[];
  actions: string[];
  aiRecommendation: RecommendedTender["aiRecommendation"];
  calculatedAt: string;
  isSaved: boolean;
  scenarioScore?: number;
  scenarioDelta?: number;
}

export interface RadarProfileSignal {
  key:
    | "registrationNumber"
    | "cidbGrading"
    | "bbbeeLevel"
    | "annualTurnover"
    | "industryCodes"
    | "companyType";
  label: string;
  weight: number;
  complete: boolean;
}

export interface RadarProfileProjection {
  score: number;
  signals: RadarProfileSignal[];
}

export interface RadarCounts {
  all: number;
  highly_qualified: number;
  potential: number;
  near_miss: number;
}

export interface RadarFilters {
  band: "all" | Exclude<RadarBand, "not_fit">;
  closingSoon: boolean;
  newThisWeek: boolean;
}

export const RADAR_REVEAL_SIZE = 15;

export function classifyRadarScore(score: number): RadarBand {
  if (score >= 70) return "highly_qualified";
  if (score >= 50) return "potential";
  if (score >= 30) return "near_miss";
  return "not_fit";
}

export function radarTierLimit(access: RadarAccess): number {
  if (access === "free") return 0;
  if (access === "starter") return 10;
  return 50;
}

export function normalizeRadarMatches(
  recommendations: RecommendedTender[],
  savedIds: readonly string[] = [],
): RadarWorkspaceMatch[] {
  const saved = new Set(savedIds);
  return recommendations.map((recommendation) => {
    const aiAreas = recommendation.aiRecommendation?.improvementAreas;
    return {
      matchingScoreId: recommendation.id,
      tenderId: recommendation.tenderId,
      title: recommendation.tender.title,
      referenceNumber: recommendation.tender.referenceNumber,
      buyer: recommendation.tender.sourceOrganization,
      province: recommendation.tender.province,
      closingDate: recommendation.tender.closingDate,
      estimatedValue: recommendation.tender.estimatedValue,
      score: recommendation.score,
      band: classifyRadarScore(recommendation.score),
      factors: recommendation.factors,
      reasoning: recommendation.reasoning,
      gaps: aiAreas?.gaps ?? recommendation.improvementAreas ?? [],
      actions: aiAreas?.actions ?? [],
      aiRecommendation: recommendation.aiRecommendation,
      calculatedAt: recommendation.calculatedAt,
      isSaved: saved.has(recommendation.tenderId),
    };
  });
}

export function capRadarMatches(
  matches: readonly RadarWorkspaceMatch[],
  access: RadarAccess,
): RadarWorkspaceMatch[] {
  return matches.slice(0, radarTierLimit(access));
}

export function countRadarBands(
  matches: readonly RadarWorkspaceMatch[],
): RadarCounts {
  const counts: RadarCounts = {
    all: matches.length,
    highly_qualified: 0,
    potential: 0,
    near_miss: 0,
  };
  for (const match of matches) {
    if (match.band !== "not_fit") counts[match.band] += 1;
  }
  return counts;
}

function hasValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  return value !== null && value !== undefined;
}

export function projectRadarProfile(
  extended: RadarExtendedProfile,
): RadarProfileProjection {
  const signals: RadarProfileSignal[] = [
    {
      key: "registrationNumber",
      label: "Registration number",
      weight: 20,
      complete: hasValue(extended.company.registrationNumber),
    },
    {
      key: "cidbGrading",
      label: "CIDB grading",
      weight: 20,
      complete: hasValue(extended.profile?.cidbGrading),
    },
    {
      key: "bbbeeLevel",
      label: "B-BBEE level",
      weight: 20,
      complete: hasValue(extended.company.bbbeeLevel),
    },
    {
      key: "annualTurnover",
      label: "Annual turnover",
      weight: 20,
      complete: hasValue(extended.company.annualTurnover),
    },
    {
      key: "industryCodes",
      label: "Industry codes",
      weight: 10,
      complete: extended.company.industryCodes.length > 0,
    },
    {
      key: "companyType",
      label: "Company type",
      weight: 10,
      complete: hasValue(extended.profile?.companyType),
    },
  ];
  return {
    score: signals.reduce(
      (total, signal) => total + (signal.complete ? signal.weight : 0),
      0,
    ),
    signals,
  };
}

export function findTopRadarGap(
  matches: readonly RadarWorkspaceMatch[],
): string | null {
  const entries = new Map<
    string,
    { label: string; count: number; first: number }
  >();
  let position = 0;
  for (const match of matches) {
    for (const raw of match.gaps) {
      const label = raw.trim();
      if (!label) continue;
      const key = label.toLocaleLowerCase("en-ZA");
      const current = entries.get(key);
      if (current) current.count += 1;
      else entries.set(key, { label, count: 1, first: position });
      position += 1;
    }
  }
  return (
    [...entries.values()].sort(
      (left, right) => right.count - left.count || left.first - right.first,
    )[0]?.label ?? null
  );
}

function timestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function effectiveRadarScore(match: RadarWorkspaceMatch): number {
  return match.scenarioScore ?? match.score;
}

export function filterRadarMatches(
  matches: readonly RadarWorkspaceMatch[],
  filters: RadarFilters,
  now = new Date(),
): RadarWorkspaceMatch[] {
  const nowMs = now.getTime();
  const weekAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
  const closingLimit = nowMs + 14 * 24 * 60 * 60 * 1000;
  return matches.filter((match) => {
    if (
      filters.band !== "all" &&
      classifyRadarScore(effectiveRadarScore(match)) !== filters.band
    ) {
      return false;
    }
    const closing = timestamp(match.closingDate);
    if (
      filters.closingSoon &&
      (closing === null || closing < nowMs || closing > closingLimit)
    ) {
      return false;
    }
    const calculated = timestamp(match.calculatedAt);
    if (
      filters.newThisWeek &&
      (calculated === null || calculated < weekAgo || calculated > nowMs)
    ) {
      return false;
    }
    return true;
  });
}

function compareNullable(
  left: number | null,
  right: number | null,
  direction: "asc" | "desc",
): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return direction === "asc" ? left - right : right - left;
}

export function sortRadarMatches(
  matches: readonly RadarWorkspaceMatch[],
  sort: RadarSort,
): RadarWorkspaceMatch[] {
  return [...matches].sort((left, right) => {
    if (sort === "best_match") {
      return effectiveRadarScore(right) - effectiveRadarScore(left);
    }
    if (sort === "closing_soon") {
      return compareNullable(
        timestamp(left.closingDate),
        timestamp(right.closingDate),
        "asc",
      );
    }
    if (sort === "newest") {
      return compareNullable(
        timestamp(left.calculatedAt),
        timestamp(right.calculatedAt),
        "desc",
      );
    }
    return compareNullable(left.estimatedValue, right.estimatedValue, "desc");
  });
}

export function revealRadarMatches(
  matches: readonly RadarWorkspaceMatch[],
  revealCount: number,
): RadarWorkspaceMatch[] {
  return matches.slice(0, Math.max(0, revealCount));
}

export function applyRadarScenario(
  matches: readonly RadarWorkspaceMatch[],
  result: RadarScenarioResult,
): RadarWorkspaceMatch[] {
  const rows = new Map(result.rows.map((row) => [row.id, row]));
  return matches.map((match) => {
    const row = rows.get(match.matchingScoreId);
    return row
      ? {
          ...match,
          scenarioScore: row.scenarioScore,
          scenarioDelta: row.delta,
        }
      : { ...match };
  });
}
