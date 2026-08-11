/**
 * Number and date formatting for the market visuals (Slice 8).
 *
 * Its own module so the components export only components, the arrangement
 * React Fast Refresh needs and the one `activity-format.ts` already follows.
 */

/**
 * Compact ZAR — `R8.4bn`, `R1.2m`, `R840k`.
 *
 * Mirrors the web dashboard's `formatCompactZar` so the same award value
 * does not read as `R8.4bn` in one client and `R8,412,900,000` in the other.
 */
export function formatCompactZar(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `R${(amount / 1_000_000_000).toFixed(1)}bn`;
  }
  if (amount >= 1_000_000) return `R${(amount / 1_000_000).toFixed(1)}m`;
  if (amount >= 1_000) return `R${Math.round(amount / 1_000)}k`;
  return `R${Math.round(amount)}`;
}

/** `YYYY-MM-DD` from the pulse trend, as `12 Aug`. */
export function formatTrendDate(dateKey: string): string {
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

/** A count, or an em dash when the parent omitted the figure entirely. */
export function formatCount(value: number | undefined): string {
  return value === undefined ? "—" : value.toLocaleString("en-ZA");
}

/** Money, or an em dash. A missing total is not zero. */
export function formatMoney(value: number | undefined): string {
  return value === undefined ? "—" : formatCompactZar(value);
}
