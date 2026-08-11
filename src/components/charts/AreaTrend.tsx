/**
 * One or two series over a date axis (R-V6).
 *
 * Used for the Command Centre's 30-day market activity chart: tenders
 * published against awards published, the same pair the web dashboard's
 * `platform-pulse.tsx` draws from the same route, so the two cannot
 * disagree.
 */

import { ChartFrame, ChartLegend } from "./ChartFrame";
import { chartColor, surfaceColor, type ChartToken } from "./chart-tokens";
import { areaPath, bandScale, linePath, linearScale, niceMax } from "./scale";

const WIDTH = 480;
const HEIGHT = 160;
const PAD_LEFT = 4;
const PAD_RIGHT = 4;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;

export interface TrendSeries {
  label: string;
  token: ChartToken;
  /** One value per x position. Must match `xLabels.length`. */
  values: number[];
}

export interface AreaTrendProps {
  label: string;
  xLabels: string[];
  series: TrendSeries[];
  /** Height in CSS pixels. The coordinate system is fixed regardless. */
  height?: number;
  /** How many x labels to render. The rest are drawn as ticks only. */
  labelEvery?: number;
}

export function AreaTrend({
  label,
  xLabels,
  series,
  height = 180,
  labelEvery = 6,
}: AreaTrendProps) {
  const count = xLabels.length;
  const band = bandScale(count, [PAD_LEFT, WIDTH - PAD_RIGHT], 0);

  // One shared y scale across every series: two series drawn against
  // separate scales would put a series of 3 and a series of 300 at the same
  // height, which reads as "the same amount" and is simply untrue.
  const peak = niceMax(Math.max(0, ...series.flatMap((entry) => entry.values)));
  const y = linearScale([0, peak], [HEIGHT - PAD_BOTTOM, PAD_TOP]);
  const baseline = y(0);

  const rows = xLabels.map((xLabel, index) => ({
    label: xLabel,
    value: series
      .map((entry) => `${entry.label}: ${entry.values[index] ?? 0}`)
      .join(", "),
  }));

  return (
    <ChartFrame
      label={label}
      rows={rows}
      columns={["Date", "Published"]}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      height={height}
      footer={<ChartLegend series={series} />}
    >
      {/* Baseline and peak hairlines. Two lines, not a full grid: at 30
          points a grid competes with the data it is meant to support. */}
      <line
        x1={PAD_LEFT}
        y1={baseline}
        x2={WIDTH - PAD_RIGHT}
        y2={baseline}
        stroke={surfaceColor("border")}
        strokeWidth={1}
      />
      <line
        x1={PAD_LEFT}
        y1={y(peak)}
        x2={WIDTH - PAD_RIGHT}
        y2={y(peak)}
        stroke={surfaceColor("border")}
        strokeWidth={1}
        strokeDasharray="2 4"
      />
      <text
        x={PAD_LEFT}
        y={y(peak) - 3}
        fontSize={9}
        fill={surfaceColor("muted-foreground")}
      >
        {peak.toLocaleString("en-ZA")}
      </text>

      {series.map((entry) => {
        const points = entry.values.map((value, index) => ({
          x: band.centre(index),
          y: y(value),
        }));
        return (
          <g key={entry.label}>
            <path
              d={areaPath(points, baseline)}
              fill={chartColor(entry.token, 0.16)}
              stroke="none"
            />
            <path
              d={linePath(points)}
              fill="none"
              stroke={chartColor(entry.token)}
              strokeWidth={1.75}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        );
      })}

      {xLabels.map((xLabel, index) =>
        index % labelEvery === 0 ? (
          <text
            key={xLabel + String(index)}
            x={band.centre(index)}
            y={HEIGHT - 6}
            fontSize={9}
            textAnchor="middle"
            fill={surfaceColor("muted-foreground")}
          >
            {xLabel}
          </text>
        ) : null,
      )}
    </ChartFrame>
  );
}
