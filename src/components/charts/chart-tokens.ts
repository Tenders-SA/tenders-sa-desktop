/**
 * The data-visualisation ramp, as code (R-V8).
 *
 * Lives apart from the components that consume it so each module exports one
 * kind of thing — the same reason `use-connectivity.ts` is its own file, and
 * what React Fast Refresh needs to work reliably.
 *
 * Charts take a **token**, never a colour. `--chart-1` … `--chart-5` are
 * defined in `src/styles/tokens.css` and their contrast against the surfaces
 * they sit on is verified by `src/tests/design-tokens.test.ts`. That
 * guarantee only holds for values that come from the ramp, so a literal
 * anywhere in `src/components/charts/` is a defect and is rejected by a
 * source scan in that same test file.
 */

export type ChartToken = 1 | 2 | 3 | 4 | 5;

/** `hsl(var(--chart-N))`, optionally at reduced opacity for an area fill. */
export function chartColor(token: ChartToken, alpha?: number): string {
  return alpha === undefined
    ? `hsl(var(--chart-${token}))`
    : `hsl(var(--chart-${token}) / ${alpha})`;
}

/** `hsl(var(--name))` for the semantic tokens charts borrow (grid, axis). */
export function surfaceColor(name: string, alpha?: number): string {
  return alpha === undefined
    ? `hsl(var(--${name}))`
    : `hsl(var(--${name}) / ${alpha})`;
}
