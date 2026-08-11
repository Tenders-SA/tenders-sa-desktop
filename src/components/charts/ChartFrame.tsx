/**
 * The wrapper every chart in this application renders through (R-V7).
 *
 * A chart is a picture of numbers. To a screen reader an `<svg>` full of
 * `<path>` elements is nothing at all, so `ChartFrame` makes the accessible
 * form *structural* rather than a thing each chart has to remember: it
 * requires a `label` and the underlying `rows`, and emits both the
 * `role="img"` name and a visually hidden table carrying the same numbers.
 * A primitive cannot ship without them because it cannot render without
 * this component.
 *
 * It also owns the sizing contract: a fixed `viewBox`, `width="100%"`, and
 * no measurement of anything. See design.md §2 for why no charting library
 * is used.
 */

import { useId, type ReactNode } from "react";
import { chartColor, type ChartToken } from "./chart-tokens";

/** One row of the hidden table: the chart's data in words and numbers. */
export interface ChartRow {
  label: string;
  /** Rendered as given — already formatted (ZAR, counts, dates). */
  value: string;
}

export interface ChartFrameProps {
  /** What the chart shows, as a sentence fragment: "Tenders by province". */
  label: string;
  /** The same data the marks encode. Never a subset. */
  rows: ChartRow[];
  /** Column headings for the hidden table. */
  columns?: [string, string];
  /** The SVG coordinate system the primitive draws in. */
  viewBox: string;
  /** Rendered height. Width is always 100% of the container. */
  height: number;
  /** Legend, caption or footnote rendered below the plot. */
  footer?: ReactNode;
  children: ReactNode;
}

export function ChartFrame({
  label,
  rows,
  columns = ["Item", "Value"],
  viewBox,
  height,
  footer,
  children,
}: ChartFrameProps) {
  const tableId = useId();

  return (
    <figure className="m-0">
      <svg
        role="img"
        aria-label={label}
        // The table is the long description. A screen reader user gets the
        // headline from the label and the actual figures from the table,
        // which is the part a sighted user reads off the marks.
        aria-describedby={rows.length > 0 ? tableId : undefined}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height={height}
        style={{ display: "block" }}
      >
        {children}
      </svg>

      {rows.length > 0 && (
        <table id={tableId} className="sr-only">
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">{columns[0]}</th>
              <th scope="col">{columns[1]}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {footer && <figcaption className="mt-2">{footer}</figcaption>}
    </figure>
  );
}

/**
 * The legend used by the multi-series charts.
 *
 * A swatch alone would make colour the only carrier of the series identity
 * (WCAG 1.4.1), so the name always sits beside it.
 */
export function ChartLegend({
  series,
}: {
  series: { label: string; token: ChartToken }[];
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {series.map((entry) => (
        <li
          key={entry.label}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: chartColor(entry.token) }}
          />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * The copy shown in place of a chart that has nothing to draw (R-V12).
 *
 * Deliberately a component rather than a convention: an empty axis or a
 * zero-radius donut looks like a broken chart, and "you have no applications
 * yet" is information the empty chart cannot convey.
 */
export function ChartEmpty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
