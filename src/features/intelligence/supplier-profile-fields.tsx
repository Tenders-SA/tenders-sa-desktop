/**
 * Display primitives for the Supplier Profile screen.
 *
 * Spec: desktop-supplier-profile §design 5.1, 9 (R-S7, R-S8)
 *
 * These exist so the honesty rules are applied by construction rather than
 * remembered panel by panel. `NotRecorded` is the load-bearing one: the house
 * rule is already settled at `SupplierIntelligence.tsx:190-194`,
 * `CompanyProfile.tsx:1091-1093` and `PulseTotals.tsx:10-12` — an absent
 * figure renders "Not recorded", never a blank and never `0`, because "no
 * awards were recorded" and "nobody counted" are different claims and only
 * one of them is a number.
 *
 * Everything exported here is a **component**. The pure text formatters live
 * in `supplier-profile-model.ts` so this file satisfies
 * `react-refresh/only-export-components`, per design §9.
 */

import type { ReactNode } from "react";
import { formatDateText, formatMoneyText } from "./supplier-profile-model";

/** The single place the absent-value wording lives. */
export function NotRecorded() {
  return <span className="text-muted-foreground">Not recorded</span>;
}

/**
 * Renders `of` when it carries content, else "Not recorded".
 *
 * `0` is deliberately **not** treated as absent — a genuine zero the parent
 * sent is a fact and is shown. Only `null`, `undefined` and blank strings
 * degrade. The inverse mistake (rendering absent as `0`) is the one the house
 * rule forbids; this keeps both directions honest.
 */
export function Value({ of }: { of: string | number | null | undefined }) {
  if (of === null || of === undefined) return <NotRecorded />;
  if (typeof of === "string" && of.trim() === "") return <NotRecorded />;
  return <>{of}</>;
}

/** An ISO date as a South African short date, or "Not recorded". */
export function DateValue({ iso }: { iso: string | null | undefined }) {
  const text = formatDateText(iso);
  return text === null ? <NotRecorded /> : <>{text}</>;
}

/**
 * An amount in the currency the record declares, or "Not recorded".
 *
 * Contract C's award timeline carries no currency of its own, so the caller
 * passes the one the leaderboard row declared rather than assuming ZAR —
 * mislabelling a foreign-currency award as rands would misstate a supplier's
 * size by an order of magnitude (the reasoning `formatAwardValue` already
 * applies).
 */
export function MoneyValue({
  amount,
  currency,
}: {
  amount: number | null | undefined;
  currency: string;
}) {
  const text = formatMoneyText(amount, currency);
  return text === null ? <NotRecorded /> : <>{text}</>;
}

export interface StatTileProps {
  label: string;
  children: ReactNode;
}

/**
 * A hero statistic, following the tender detail screen's `<dl>` tiles
 * (`TenderDetail.tsx:56-77`) so the two detail screens read as one product.
 */
export function StatTile({ label, children }: StatTileProps) {
  return (
    <div className="min-w-0 rounded-lg border border-border/80 bg-background/80 px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}

/**
 * The provenance line every panel carries (brief §4.2, §9).
 *
 * Styled after `TenderIntelligenceOverview.tsx:29-43`. It is not decoration:
 * §4.2 forbids presenting derived information as verified fact, and the only
 * way a reader can tell an award-derived figure from a company-filed one is
 * if the screen says which it is.
 */
export function ProvenanceEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

/** A label/value row inside a panel. */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border/60 py-2 last:border-b-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-card-foreground">{children}</dd>
    </div>
  );
}
