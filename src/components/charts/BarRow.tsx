/**
 * Horizontal labelled bars — a ranked list with magnitude (R-V6).
 *
 * Used for tenders by province, and for the 14-day deadline runway (which
 * is the same shape rotated in the reader's head: one row per day). Rows are
 * drawn in the order given; sorting is the caller's decision, because
 * "biggest first" is right for provinces and wrong for a calendar.
 */

import { ChartFrame } from "./ChartFrame";
import { chartColor, surfaceColor, type ChartToken } from "./chart-tokens";
import { linearScale, niceMax } from "./scale";

const WIDTH = 480;
const ROW_HEIGHT = 22;
const BAR_HEIGHT = 10;
const LABEL_WIDTH = 150;
const VALUE_WIDTH = 62;

export interface BarDatum {
  label: string;
  value: number;
  /** Overrides the chart-wide token — used to mark "this week" differently. */
  token?: ChartToken;
}

export interface BarRowProps {
  label: string;
  data: BarDatum[];
  token?: ChartToken;
  /** Formats the number at the end of each bar and in the hidden table. */
  format?: (value: number) => string;
  columns?: [string, string];
}

export function BarRow({
  label,
  data,
  token = 1,
  format = (value) => value.toLocaleString("en-ZA"),
  columns = ["Item", "Count"],
}: BarRowProps) {
  const height = Math.max(ROW_HEIGHT, data.length * ROW_HEIGHT);
  const trackStart = LABEL_WIDTH + 8;
  const trackEnd = WIDTH - VALUE_WIDTH;
  const peak = niceMax(Math.max(0, ...data.map((datum) => datum.value)));
  const x = linearScale([0, peak], [trackStart, trackEnd]);

  return (
    <ChartFrame
      label={label}
      rows={data.map((datum) => ({
        label: datum.label,
        value: format(datum.value),
      }))}
      columns={columns}
      viewBox={`0 0 ${WIDTH} ${height}`}
      height={height}
    >
      {data.map((datum, index) => {
        const centreY = index * ROW_HEIGHT + ROW_HEIGHT / 2;
        const barY = centreY - BAR_HEIGHT / 2;
        // A zero-width rect is invisible, which reads as a missing row
        // rather than as "none". A 2px stub keeps the row present.
        const width = Math.max(2, x(datum.value) - trackStart);
        return (
          <g key={datum.label}>
            <text
              x={LABEL_WIDTH}
              y={centreY + 3.5}
              fontSize={10}
              textAnchor="end"
              fill={surfaceColor("foreground")}
            >
              {datum.label}
            </text>
            <rect
              x={trackStart}
              y={barY}
              width={trackEnd - trackStart}
              height={BAR_HEIGHT}
              rx={2}
              fill={surfaceColor("muted")}
            />
            <rect
              x={trackStart}
              y={barY}
              width={width}
              height={BAR_HEIGHT}
              rx={2}
              fill={chartColor(datum.token ?? token)}
            />
            <text
              x={WIDTH - 4}
              y={centreY + 3.5}
              fontSize={10}
              textAnchor="end"
              fill={surfaceColor("muted-foreground")}
            >
              {format(datum.value)}
            </text>
          </g>
        );
      })}
    </ChartFrame>
  );
}
