/**
 * One value against a capacity (R-V6).
 *
 * Used for application slots. A 270° arc rather than a full ring, because
 * the gap at the bottom is what makes "there is a maximum" legible — a full
 * ring reads as a proportion of nothing in particular.
 */

import { ChartFrame } from "./ChartFrame";
import { chartColor, surfaceColor, type ChartToken } from "./chart-tokens";
import { arcPath } from "./scale";

const SIZE = 160;
const CENTRE = SIZE / 2;
const OUTER = 66;
const INNER = 48;
const SWEEP = (Math.PI * 3) / 2; // 270°
const START = Math.PI * 1.25; // bottom-left, running clockwise

export interface GaugeProps {
  label: string;
  value: number;
  max: number;
  /** Big number in the middle; defaults to `value`. */
  display?: string;
  caption: string;
  token?: ChartToken;
  height?: number;
}

export function Gauge({
  label,
  value,
  max,
  display,
  caption,
  token = 1,
  height = 160,
}: GaugeProps) {
  // A capacity of zero is not a division-by-zero bug to guard against and
  // forget: it is the unlimited plan. Showing a full arc there would claim
  // the user is at their limit, so the arc stays empty and the number in the
  // middle carries the meaning.
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

  return (
    <ChartFrame
      label={label}
      rows={[
        { label: "Used", value: value.toLocaleString("en-ZA") },
        {
          label: "Total",
          value: max > 0 ? max.toLocaleString("en-ZA") : "Unlimited",
        },
      ]}
      columns={["Measure", "Value"]}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      height={height}
    >
      <path
        d={arcPath(CENTRE, CENTRE, OUTER, INNER, START, START + SWEEP)}
        fill={surfaceColor("muted")}
      />
      {fraction > 0 && (
        <path
          d={arcPath(
            CENTRE,
            CENTRE,
            OUTER,
            INNER,
            START,
            START + SWEEP * fraction,
          )}
          fill={chartColor(token)}
        />
      )}
      <text
        x={CENTRE}
        y={CENTRE + 2}
        fontSize={22}
        fontWeight={600}
        textAnchor="middle"
        fill={surfaceColor("card-foreground")}
      >
        {display ?? value.toLocaleString("en-ZA")}
      </text>
      <text
        x={CENTRE}
        y={CENTRE + 18}
        fontSize={9}
        textAnchor="middle"
        fill={surfaceColor("muted-foreground")}
      >
        {caption}
      </text>
    </ChartFrame>
  );
}
