/**
 * Part-to-whole for a small number of categories (R-V6).
 *
 * Used for the application pipeline by status. Capped at five slices
 * because the ramp has five tokens and because a donut stops being readable
 * well before that; the caller folds the tail into "Other" (which the
 * Command Centre does with any status the parent adds later).
 */

import { ChartFrame } from "./ChartFrame";
import { chartColor, surfaceColor, type ChartToken } from "./chart-tokens";
import { arcPath } from "./scale";

const SIZE = 160;
const CENTRE = SIZE / 2;
const OUTER = 68;
const INNER = 44;

export interface DonutSlice {
  label: string;
  value: number;
  token: ChartToken;
}

export interface DonutProps {
  label: string;
  slices: DonutSlice[];
  /** Large number in the middle. Usually the total. */
  centreValue: string;
  /** Small caption under it — "applications", "documents". */
  centreLabel: string;
  height?: number;
}

export function Donut({
  label,
  slices,
  centreValue,
  centreLabel,
  height = 160,
}: DonutProps) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  // Angles accumulate around the circle; a zero-value slice contributes
  // nothing and is skipped rather than drawn as a hairline that reads as a
  // real category.
  let angle = 0;
  const drawn = slices
    .filter((slice) => slice.value > 0)
    .map((slice) => {
      const start = angle;
      const sweep = total > 0 ? (slice.value / total) * Math.PI * 2 : 0;
      angle += sweep;
      return {
        ...slice,
        d: arcPath(CENTRE, CENTRE, OUTER, INNER, start, angle),
      };
    });

  return (
    <ChartFrame
      label={label}
      rows={slices.map((slice) => ({
        label: slice.label,
        value: slice.value.toLocaleString("en-ZA"),
      }))}
      columns={["Status", "Applications"]}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      height={height}
    >
      {/* The track shows the whole even when one slice fills it, so the
          shape reads as a proportion rather than as an arbitrary ring. */}
      <circle
        cx={CENTRE}
        cy={CENTRE}
        r={(OUTER + INNER) / 2}
        fill="none"
        stroke={surfaceColor("muted")}
        strokeWidth={OUTER - INNER}
      />
      {drawn.map((slice) => (
        <path key={slice.label} d={slice.d} fill={chartColor(slice.token)} />
      ))}
      <text
        x={CENTRE}
        y={CENTRE + 2}
        fontSize={22}
        fontWeight={600}
        textAnchor="middle"
        fill={surfaceColor("card-foreground")}
      >
        {centreValue}
      </text>
      <text
        x={CENTRE}
        y={CENTRE + 18}
        fontSize={9}
        textAnchor="middle"
        fill={surfaceColor("muted-foreground")}
      >
        {centreLabel}
      </text>
    </ChartFrame>
  );
}
