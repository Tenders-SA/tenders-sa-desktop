/**
 * Match-factor rows, separate from the component so they stay testable
 * without rendering.
 */

import type { ScoreFactors } from "../../services/api/endpoints/recommendations";

export interface FactorRow {
  label: string;
  score: number;
  maxScore: number;
  percentage: number;
}

/**
 * Turns the factor object into display rows.
 *
 * Every factor is optional in the parent type, and an absent factor is **not
 * a zero** -- it means matching did not evaluate it. Rendering it as `0/10`
 * would tell the user they failed a check that never ran, so absent factors
 * are omitted. A factor with `maxScore: 0` is skipped rather than divided by.
 */
export function collectFactorRows(factors: ScoreFactors): FactorRow[] {
  const labels: Array<[keyof ScoreFactors, string]> = [
    ["eligibility", "Eligibility"],
    ["industry", "Industry"],
    ["province", "Province"],
    ["bbbee", "B-BBEE"],
    ["value", "Tender value"],
    ["documentReadiness", "Document readiness"],
    ["userPreferences", "Your preferences"],
  ];

  const rows: FactorRow[] = [];
  for (const [key, label] of labels) {
    const factor = factors[key];
    if (!factor) continue;
    if (factor.maxScore <= 0) continue;
    const ratio = factor.score / factor.maxScore;
    rows.push({
      label,
      score: factor.score,
      maxScore: factor.maxScore,
      // Clamped: a parent that ever returns score > maxScore must not push a
      // bar outside its track.
      percentage: Math.max(0, Math.min(100, Math.round(ratio * 100))),
    });
  }
  return rows;
}
