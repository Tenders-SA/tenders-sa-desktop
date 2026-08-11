/**
 * The market KPI strip (R-V10).
 *
 * Five figures about the platform, not about the user: what is open, what
 * arrived, what closes soon, what was awarded and for how much. On a screen
 * that is otherwise entirely about the user's own pipeline, this is the part
 * that still says something on the day someone signs in with no
 * applications at all.
 *
 * A total the payload omits renders `—`, never `0` (R-V12): "no awards were
 * published" and "nobody counted" are different claims, and only one of them
 * is a number.
 */

import { AsyncSection } from "../../components/common/AsyncSection";
import { formatCount, formatMoney } from "./market-format";
import type { PulseState } from "./use-pulse";
import type { PulseTotals as Totals } from "../../services/api/endpoints/pulse";

function tiles(totals: Totals) {
  return [
    {
      label: "Active tenders",
      value: formatCount(totals.activeTenders),
      caption: "open right now",
    },
    {
      label: "New tenders",
      value: formatCount(totals.newTenders30d),
      caption: "last 30 days",
    },
    {
      label: "Closing soon",
      value: formatCount(totals.closingSoon7d),
      caption: "next 7 days",
    },
    {
      label: "Awards published",
      value: formatCount(totals.awards30d),
      caption: "last 30 days",
    },
    {
      label: "Value awarded",
      value: formatMoney(totals.awardedValue30d),
      caption: "last 30 days",
    },
  ];
}

export function PulseTotals({ state }: { state: PulseState }) {
  return (
    <section
      aria-label="Platform activity"
      className="rounded border border-border bg-card p-4"
    >
      <AsyncSection
        state={state}
        subject="platform activity"
        onRetry={state.reload}
      >
        {(pulse) => (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {tiles(pulse.totals).map((tile) => (
              <div key={tile.label}>
                <dt className="text-xs text-muted-foreground">{tile.label}</dt>
                <dd
                  data-numeric
                  className="text-lg font-semibold text-card-foreground"
                >
                  {tile.value}
                </dd>
                <p className="text-xs text-muted-foreground">{tile.caption}</p>
              </div>
            ))}
          </dl>
        )}
      </AsyncSection>
    </section>
  );
}
