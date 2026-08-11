/**
 * Chart geometry (Slice 8, R-V6).
 *
 * Pure functions over numbers: no DOM, no measurement, no React. Everything
 * a chart needs to place a mark is computed from a fixed `viewBox`, which is
 * what lets the primitives render identically in jsdom and in the webview
 * and be asserted directly in tests.
 *
 * A charting library was considered and rejected — see
 * `docs/specifications/desktop-visual-command-centre/design.md` §2. The
 * short version: `ResponsiveContainer` measures the DOM, jsdom reports zero,
 * and every chart test would then assert against a shim rather than against
 * output.
 */

/** An inclusive numeric interval. */
export type Domain = [min: number, max: number];

/**
 * Maps a value from `domain` onto `range`.
 *
 * A zero-width domain maps everything to the range's start rather than
 * dividing by zero: a flat series (every value identical, including all
 * zeroes) is a real and common case — a new account has no activity — and it
 * must draw a flat line, not `NaN` coordinates that silently vanish.
 */
export function linearScale(
  domain: Domain,
  range: Domain,
): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  if (span === 0) return () => r0;
  return (value) => r0 + ((value - d0) / span) * (r1 - r0);
}

export interface Band {
  /** Distance between the starts of adjacent bands. */
  step: number;
  /** Drawable width of one band, once padding is removed. */
  bandWidth: number;
  /** Left edge of band `index`. */
  at: (index: number) => number;
  /** Centre of band `index` — where a point mark or a label sits. */
  centre: (index: number) => number;
}

/**
 * Divides `[start, end]` into `count` evenly spaced bands.
 *
 * `padding` is the fraction of each step left empty (0.2 = 20% gap). A count
 * of zero yields a band of zero width rather than an error, so an empty
 * series renders an empty plot instead of throwing on the way to one.
 */
export function bandScale(
  count: number,
  [start, end]: Domain,
  padding = 0.2,
): Band {
  const step = count > 0 ? (end - start) / count : 0;
  const bandWidth = step * (1 - padding);
  const offset = (step - bandWidth) / 2;
  return {
    step,
    bandWidth,
    at: (index) => start + index * step + offset,
    centre: (index) => start + index * step + step / 2,
  };
}

/**
 * Rounds a maximum up to a readable axis bound (10, 25, 50, 100, 250…).
 *
 * Charts here have no axis labels beyond the top value, so this exists to
 * stop the tallest bar touching the frame rather than to produce a full tick
 * ladder. Zero (and anything negative — no series in this product is
 * negative) yields 1, which keeps every scale invertible.
 */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const rounded =
    normalised <= 1 ? 1 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10;
  return rounded * magnitude;
}

export interface Point {
  x: number;
  y: number;
}

/** A point on a circle, with 0 radians at twelve o'clock, running clockwise. */
export function polarPoint(
  cx: number,
  cy: number,
  radius: number,
  angle: number,
): Point {
  return {
    x: cx + radius * Math.sin(angle),
    y: cy - radius * Math.cos(angle),
  };
}

/** `M…L…` through every point. Empty input yields an empty string. */
export function linePath(points: Point[]): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)} ${round(p.y)}`)
    .join(" ");
}

/** The same line, closed down to `baselineY`, for a filled area. */
export function areaPath(points: Point[], baselineY: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath(points)} L${round(last.x)} ${round(baselineY)} L${round(
    first.x,
  )} ${round(baselineY)} Z`;
}

/**
 * A donut segment between two angles (radians, clockwise from twelve).
 *
 * A full circle cannot be expressed as a single arc — start and end
 * coincide, and the renderer draws nothing — so a segment covering the whole
 * circle is emitted as two half arcs. That is the single-category case: one
 * application, one slice, and without this the donut would silently render
 * empty for the user who has just started their first bid.
 */
export function arcPath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle;
  if (sweep <= 0) return "";
  if (sweep >= Math.PI * 2) {
    const mid = startAngle + Math.PI;
    return `${arcPath(cx, cy, outerRadius, innerRadius, startAngle, mid)} ${arcPath(
      cx,
      cy,
      outerRadius,
      innerRadius,
      mid,
      startAngle + Math.PI * 2,
    )}`;
  }

  const largeArc = sweep > Math.PI ? 1 : 0;
  const o0 = polarPoint(cx, cy, outerRadius, startAngle);
  const o1 = polarPoint(cx, cy, outerRadius, endAngle);
  const i1 = polarPoint(cx, cy, innerRadius, endAngle);
  const i0 = polarPoint(cx, cy, innerRadius, startAngle);

  return [
    `M${round(o0.x)} ${round(o0.y)}`,
    `A${round(outerRadius)} ${round(outerRadius)} 0 ${largeArc} 1 ${round(o1.x)} ${round(o1.y)}`,
    `L${round(i1.x)} ${round(i1.y)}`,
    `A${round(innerRadius)} ${round(innerRadius)} 0 ${largeArc} 0 ${round(i0.x)} ${round(i0.y)}`,
    "Z",
  ].join(" ");
}

/** Two decimals is below one device pixel at these sizes and keeps paths short. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
