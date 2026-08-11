/**
 * The two market charts (R-V10, R-V12).
 *
 * `view="trend"` draws 30 days of tenders against awards; `view="provinces"`
 * ranks where the open work is. Both read the shared pulse state, so the two
 * panels and the KPI strip cost one request between them, and both still
 * render their own loading, error and retry — a failure shows up as a
 * failure in each place it affects, not as a blank screen.
 */

import { AsyncSection, Panel } from "../../components/common/AsyncSection";
import { AreaTrend } from "../../components/charts/AreaTrend";
import { BarRow } from "../../components/charts/BarRow";
import { ChartEmpty } from "../../components/charts/ChartFrame";
import { formatTrendDate } from "./market-format";
import type { PlatformPulse } from "../../services/api/endpoints/pulse";
import type { PulseState } from "./use-pulse";

/**
 * Rank is the point of the province chart; past eight rows it stops being a
 * ranking and becomes a table, which the hidden data table already is.
 */
const PROVINCE_LIMIT = 8;

export function MarketPanel({
  state,
  view,
}: {
  state: PulseState;
  view: "trend" | "provinces";
}) {
  const title =
    view === "trend" ? "Market activity — 30 days" : "Tenders by province";

  return (
    <Panel title={title}>
      <AsyncSection
        state={state}
        subject={
          view === "trend" ? "market activity" : "the province breakdown"
        }
        onRetry={state.reload}
      >
        {(pulse) =>
          view === "trend" ? (
            <TrendView pulse={pulse} />
          ) : (
            <ProvinceView pulse={pulse} />
          )
        }
      </AsyncSection>
    </Panel>
  );
}

function TrendView({ pulse }: { pulse: PlatformPulse }) {
  const { trend } = pulse;

  if (trend.length === 0) {
    return <ChartEmpty>No activity recorded in this window.</ChartEmpty>;
  }

  const anyActivity = trend.some(
    (point) => point.tenders > 0 || point.awards > 0,
  );

  return (
    <div className="flex flex-col gap-2">
      <AreaTrend
        label="Tenders and awards published over the last 30 days"
        xLabels={trend.map((point) => formatTrendDate(point.date))}
        series={[
          {
            label: "Tenders",
            token: 1,
            values: trend.map((point) => point.tenders),
          },
          {
            label: "Awards",
            token: 2,
            values: trend.map((point) => point.awards),
          },
        ]}
      />
      {/* A flat line at zero and a chart of small numbers look alike at a
          glance; saying which one this is costs a sentence. */}
      {!anyActivity && (
        <ChartEmpty>No activity recorded in this window.</ChartEmpty>
      )}
    </div>
  );
}

function ProvinceView({ pulse }: { pulse: PlatformPulse }) {
  const provinces = [...pulse.tendersByProvince]
    .sort((a, b) => b.count - a.count)
    .slice(0, PROVINCE_LIMIT);

  if (provinces.length === 0) {
    return (
      <ChartEmpty>Province breakdown is unavailable right now.</ChartEmpty>
    );
  }

  return (
    <BarRow
      label="Open tenders by province"
      data={provinces.map((entry) => ({
        label: entry.province,
        value: entry.count,
      }))}
      columns={["Province", "Tenders"]}
    />
  );
}
