import type { ScoreFactors } from "../../services/api/endpoints/recommendations";
import { collectFactorRows } from "./match-factor-rows";

/**
 * Why a tender scored what it scored (brief §4.2 — provenance).
 *
 * Every factor is optional in the parent type, and an absent factor is not a
 * zero: it means matching did not evaluate it. Rendering a missing factor as
 * `0/10` would tell the user they failed a check that never ran, so absent
 * factors are omitted entirely.
 *
 * Each bar carries its numbers as text alongside the visual width, so the
 * information does not depend on seeing the bar (A11Y-1).
 */
export function MatchFactors({ factors }: { factors: ScoreFactors }) {
  const rows = collectFactorRows(factors);
  if (rows.length === 0) return null;

  return (
    <div className="mt-3">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Match breakdown
      </h4>
      <ul className="mt-2 flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-3">
            <span className="w-40 shrink-0 text-sm text-muted-foreground">
              {row.label}
            </span>
            <span
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded bg-muted"
              aria-hidden="true"
            >
              <span
                className="block h-full bg-primary"
                style={{ width: `${row.percentage}%` }}
              />
            </span>
            <span className="w-20 shrink-0 text-right text-sm text-foreground">
              {row.score}/{row.maxScore}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
