/**
 * Pure derivations for the Supplier Profile screen.
 *
 * Spec: desktop-supplier-profile §design 5, 6.1
 *
 * Separated from the `.tsx` files so those export components only, per
 * `react-refresh/only-export-components`, and so the honesty rules that are
 * *logic* rather than *wording* can be tested without rendering anything.
 *
 * Everything here is derived from at most 10 award rows (contract C is capped
 * for any caller that does not assert `x-pro-access`, which the desktop
 * refuses to do). The screen labels these figures as derived from those rows
 * rather than as the company's whole history — a "top buyer" computed from a
 * capped sample is a fact about the sample, not about the company.
 */

import type { AwardTimelineRow } from "../../services/api/endpoints/supplier-profile";
import { VERDICT, VERDICT_DETAIL } from "./supplier-profile-copy";

export interface EvidenceVerdict {
  verdict: string;
  detail?: string;
}

/**
 * The one-line summary of how well this company is evidenced (brief §8.4).
 *
 * The order of these branches is the point. A register mismatch is checked
 * **first**: when contract C resolved the slug to a different company there is
 * nothing to be confident about, and reporting "limited public data" would
 * imply we looked this company up and found little, rather than that we could
 * not look it up at all.
 *
 * "No related award history found" is only ever said when the leaderboard
 * itself records no awards. When awards exist but the detail route returned
 * none, that is a gap in *our* view, and saying otherwise would be a false
 * statement about the company.
 */
export function describeEvidence(input: {
  registerMatched: boolean;
  hasRegisterData: boolean;
  timelineLength: number;
  totalAwards: number;
  confidenceScore: number | null | undefined;
}): EvidenceVerdict {
  if (!input.registerMatched) {
    return {
      verdict: VERDICT.requiresManualVerification,
      detail: VERDICT_DETAIL.registerMismatch,
    };
  }
  if (input.timelineLength === 0) {
    return input.totalAwards > 0
      ? {
          verdict: VERDICT.limitedPublicData,
          detail: VERDICT_DETAIL.awardsWithoutDetail,
        }
      : { verdict: VERDICT.noRelatedAwardHistory };
  }
  if (!input.hasRegisterData) {
    return { verdict: VERDICT.limitedPublicData };
  }
  if (
    typeof input.confidenceScore === "number" &&
    input.confidenceScore >= STRONG_EVIDENCE_CONFIDENCE
  ) {
    return { verdict: VERDICT.strongEvidence };
  }
  return { verdict: VERDICT.relevantAwardHistory };
}

/**
 * The enrichment confidence at which the platform's own compiled record is
 * treated as corroborating rather than merely present.
 *
 * A threshold has to be somewhere; it is named and stated so a reader can
 * disagree with the number rather than having to find it inline.
 */
export const STRONG_EVIDENCE_CONFIDENCE = 0.7;

export interface BuyerTally {
  buyer: string;
  awards: number;
  value: number;
}

export interface BuyerSummary {
  buyers: BuyerTally[];
  /** Rows whose buyer the parent did not record — counted, never guessed. */
  unattributed: number;
}

/**
 * Buyers, tallied from the award rows on screen.
 *
 * Rows with no `department` are counted separately rather than dropped or
 * bucketed as "Unknown": dropping them would make the tallies not add up to
 * the list above, and inventing a label would attribute an award to a buyer
 * the record does not name.
 */
export function summariseBuyers(rows: AwardTimelineRow[]): BuyerSummary {
  const tally = new Map<string, BuyerTally>();
  let unattributed = 0;

  for (const row of rows) {
    const buyer = row.department?.trim();
    if (!buyer) {
      unattributed += 1;
      continue;
    }
    const current = tally.get(buyer) ?? { buyer, awards: 0, value: 0 };
    current.awards += 1;
    current.value += typeof row.amount === "number" ? row.amount : 0;
    tally.set(buyer, current);
  }

  return {
    buyers: [...tally.values()].sort(
      (a, b) => b.awards - a.awards || b.value - a.value,
    ),
    unattributed,
  };
}

export interface YearTally {
  year: number;
  awards: number;
}

/**
 * Awards per calendar year, from the rows on screen.
 *
 * An undated or unparseable row is skipped rather than assigned to the
 * current year — a fabricated date would show up as a real trend.
 */
export function awardsPerYear(rows: AwardTimelineRow[]): YearTally[] {
  const tally = new Map<number, number>();
  for (const row of rows) {
    if (!row.awardDate) continue;
    const parsed = new Date(row.awardDate);
    if (Number.isNaN(parsed.getTime())) continue;
    const year = parsed.getUTCFullYear();
    tally.set(year, (tally.get(year) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([year, awards]) => ({ year, awards }))
    .sort((a, b) => b.year - a.year);
}

/**
 * True when the forensic row's richest fields were withheld by plan rather
 * than absent from the data (H5).
 *
 * `intelligence` and `provinceHealth` are computed only when
 * `capabilities.advancedFilters` is set (`forensic-search.ts:614-620`), so
 * `null` and `[]` mean two different things depending on this flag — and only
 * this flag can tell them apart.
 */
export function advancedContextLocked(
  capabilities: Record<string, boolean> | undefined,
): boolean {
  return capabilities?.advancedFilters !== true;
}

/**
 * An ISO date as South African short text, or `null` when there is nothing
 * truthful to render.
 *
 * `null` rather than a placeholder string: the caller decides how absence
 * looks, and there is exactly one place that decision lives (`NotRecorded`).
 * An unparseable date returns `null` too — echoing the raw string back would
 * present malformed data as a date.
 */
export function formatDateText(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * An amount in the currency the record declares, or `null` when absent.
 *
 * An unrecognised currency code would make `Intl` throw and blank the row, so
 * the number is shown with the code beside it instead — the same fallback
 * `formatAwardValue` already makes, for the same reason.
 */
export function formatMoneyText(
  amount: number | null | undefined,
  currency: string,
): string | null {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  const code = currency?.trim() || "ZAR";
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${code} ${Math.round(amount).toLocaleString("en-ZA")}`;
  }
}
