import { useId, useState } from "react";
import { AsyncSection } from "../../components/common/AsyncSection";
import { useAsync } from "../../hooks/use-async";
import {
  formatAwardValue,
  type IntelligenceCompany,
  type SupplierIntelligenceEndpoint,
} from "../../services/api/endpoints/supplier-intelligence";
import type {
  ForensicOverlayPort,
  ForensicRow,
} from "../../services/api/endpoints/supplier-profile";
import { TIER } from "./supplier-profile-copy";
import { PROVINCES } from "../tenders/tender-filter-options";

export interface SupplierIntelligenceProps {
  endpoint: SupplierIntelligenceEndpoint;
  /**
   * Opens the supplier's vetting record (Slice 12, R-S2).
   *
   * Optional so the screen stays usable — and testable — without a router.
   * When it is absent **no control is rendered at all**: a disabled or
   * no-op button would be exactly the dishonest affordance REQ-16 forbids.
   */
  onOpenSupplier?: (slug: string) => void;
  /**
   * Optional risk/B-BBEE/OCPO overlay from the forensic workbench (R-S13).
   *
   * A narrow port rather than the whole profile client: the list calls one
   * method, so it depends on one method. Omitted, the list behaves exactly as
   * it did before this slice.
   */
  forensic?: ForensicOverlayPort;
}

/**
 * Supplier Intelligence (brief §6).
 *
 * Answers "which companies have previously won similar tenders?" from the
 * award history the platform already holds — brief §4.4 treats that as
 * foundational to partner selection rather than a later enhancement.
 *
 * **This is evidence, not advice.** Nothing here is scored against the user's
 * own company, so the screen presents award counts and values for
 * interpretation and makes no recommendation. Presenting a leaderboard as a
 * suggested partner list would imply a judgement the data does not support.
 */
export function SupplierIntelligence({
  endpoint,
  onOpenSupplier,
  forensic,
}: SupplierIntelligenceProps) {
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [province, setProvince] = useState("");
  const [page, setPage] = useState(1);
  const searchId = useId();
  const provinceId = useId();

  const state = useAsync(
    (signal) =>
      endpoint.search({ q: submitted, province, page, perPage: 20 }, signal),
    [endpoint, submitted, province, page],
  );

  /**
   * The optional forensic overlay (R-S13).
   *
   * A **failure here renders nothing at all** rather than an error banner:
   * the overlay is additive, the list's own content is unaffected, and its
   * absence makes no claim about any company. An error banner for an optional
   * enhancement would be noise on a screen whose primary data loaded fine.
   */
  const overlay = useAsync(
    async (signal) =>
      forensic
        ? await forensic
            .searchForensicSuppliers(
              { q: submitted, province, page, perPage: 20 },
              signal,
            )
            .catch(() => null)
        : null,
    [forensic, submitted, province, page],
  );

  const overlayPage = overlay.status === "ready" ? overlay.value : null;
  /*
    Under preview the workbench returns at most 8 rows forced onto page 1
    (H6), so merging it into a 20-row page would enrich a handful of rows and
    leave the rest bare — which reads as "these companies have no risk data"
    when the real cause is the plan. One honest line replaces it.
  */
  const overlayLocked = overlayPage?.preview === true;
  const overlayBySlug = new Map<string, ForensicRow>(
    overlayLocked || !overlayPage
      ? []
      : overlayPage.rows.map((row) => [row.slug, row]),
  );

  return (
    <section aria-labelledby="suppliers-heading" className="max-w-4xl">
      <h1
        id="suppliers-heading"
        className="text-xl font-semibold text-foreground"
      >
        Supplier Intelligence
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Companies ranked by the public tender awards Tenders-SA has recorded.
      </p>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSubmitted(search.trim());
        }}
      >
        <label htmlFor={searchId} className="sr-only">
          Search companies
        </label>
        <input
          id={searchId}
          type="search"
          value={search}
          placeholder="Search by company name"
          onChange={(event) => setSearch(event.target.value)}
          className="flex-1 rounded border border-input bg-background px-3 py-2 text-foreground"
        />
        <button
          type="submit"
          className="rounded bg-primary px-4 py-2 font-medium text-primary-foreground"
        >
          Search
        </button>
      </form>

      <div className="mt-3 flex items-center gap-2">
        <label htmlFor={provinceId} className="text-sm text-muted-foreground">
          Province
        </label>
        <select
          id={provinceId}
          value={province}
          onChange={(event) => {
            setPage(1);
            setProvince(event.target.value);
          }}
          className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
        >
          <option value="">All provinces</option>
          {PROVINCES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        <AsyncSection
          state={state}
          subject="award history"
          onRetry={state.reload}
          isEmpty={(result) => result.companies.length === 0}
          empty={
            <p className="text-sm text-muted-foreground">
              {submitted || province
                ? "No companies match this search."
                : "No award history is available."}
            </p>
          }
        >
          {(result) => (
            <>
              <p className="text-sm text-muted-foreground">
                {result.total.toLocaleString("en-ZA")}{" "}
                {result.total === 1 ? "company" : "companies"}
              </p>

              {overlayLocked && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {TIER.listOverlayLocked}
                </p>
              )}

              <ul className="mt-3 flex flex-col gap-3">
                {result.companies.map((company) => (
                  <CompanyRow
                    key={company.slug}
                    company={company}
                    onOpen={onOpenSupplier}
                    overlay={overlayBySlug.get(company.slug)}
                  />
                ))}
              </ul>

              <nav
                aria-label="Pagination"
                className="mt-6 flex items-center justify-between"
              >
                <button
                  type="button"
                  disabled={result.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-muted-foreground">
                  Page {result.page} of {result.totalPages}
                </span>
                <button
                  type="button"
                  disabled={!result.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            </>
          )}
        </AsyncSection>
      </div>
    </section>
  );
}

function CompanyRow({
  company,
  onOpen,
  overlay,
}: {
  company: IntelligenceCompany;
  onOpen?: (slug: string) => void;
  overlay?: ForensicRow;
}) {
  const enrichment = company.enrichment;

  return (
    <li className="rounded border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate font-medium text-card-foreground">
            {/*
              A real button rather than a click handler on the row: it is
              focusable and announced without hand-rolling `role`, `tabIndex`
              and `onKeyDown`, so keyboard access is the default rather than
              something that has to be remembered. Same shape as the way
              `TenderList` opens a tender.
            */}
            {onOpen ? (
              <button
                type="button"
                onClick={() => onOpen(company.slug)}
                className="max-w-full truncate text-left text-primary hover:underline"
              >
                {company.name}
              </button>
            ) : (
              company.name
            )}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {company.totalAwards.toLocaleString("en-ZA")}{" "}
            {company.totalAwards === 1 ? "award" : "awards"} ·{" "}
            {formatAwardValue(company)}
          </p>
          {company.provinces.length > 0 && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {company.provinces.join(", ")}
            </p>
          )}
          {company.lastKnownBuyer && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              Most recent buyer: {company.lastKnownBuyer}
            </p>
          )}
          {/*
            Already in the payload and previously discarded (R-S12): the
            parent has been sending `headquartersAddress` and `website` on
            every request the list has ever made.
          */}
          {enrichment?.headquartersAddress && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {enrichment.headquartersAddress}
            </p>
          )}
          {enrichment?.website && (
            // Text, not a link: opening an external URL needs a Tauri
            // permission the capability deliberately withholds.
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {enrichment.website}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right text-sm">
          <p className="font-medium text-card-foreground">#{company.rank}</p>
          <p className="text-xs text-muted-foreground">
            {/* "Not recorded" rather than a blank, and never a guessed year. */}
            {company.lastActiveYear
              ? `Last active ${company.lastActiveYear}`
              : "Last active not recorded"}
          </p>
        </div>
      </div>

      {overlay && <ForensicOverlay overlay={overlay} />}

      {enrichment?.description && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-sm text-muted-foreground">
            {enrichment.description}
          </p>
          {/*
            Provenance (brief §4.2): this description was derived by the
            platform, not filed by the company, so it is labelled as such and
            carries its confidence when one is known. Presenting it as fact
            would be exactly what §4.2 forbids.
          */}
          <p className="mt-1 text-xs text-muted-foreground">
            Automatically compiled
            {typeof enrichment.confidenceScore === "number"
              ? ` · confidence ${Math.round(enrichment.confidenceScore * 100) / 1}%`
              : ""}
            {/*
              The freshness of a derived record is part of its provenance
              (R-S12): a description compiled two years ago and one compiled
              last week carry different weight, and the payload has always
              said which this is.
            */}
            {enrichment.lastEnrichedAt
              ? ` · last compiled ${new Date(
                  enrichment.lastEnrichedAt,
                ).toLocaleDateString("en-ZA", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}`
              : ""}
            {" — verify before relying on it"}
          </p>
        </div>
      )}
    </li>
  );
}

/**
 * Risk, B-BBEE and restricted-supplier signals from the forensic workbench.
 *
 * Rendered only for rows the workbench actually returned, and only when the
 * response was not a preview — so a row without this block is a row the
 * workbench did not cover, never a company with a clean record. Nothing here
 * characterises the company: the score is labelled as the platform's
 * published figure and the counts are counts.
 */
function ForensicOverlay({ overlay }: { overlay: ForensicRow }) {
  const parts: string[] = [];
  if (typeof overlay.forensicRiskScore === "number") {
    parts.push(`Published risk indicator ${overlay.forensicRiskScore}`);
  }
  if (overlay.forensicFlagCount > 0) {
    parts.push(
      `${overlay.forensicFlagCount} ${
        overlay.forensicFlagCount === 1 ? "signal" : "signals"
      } recorded`,
    );
  }
  if (overlay.beeLevel) parts.push(`B-BBEE ${overlay.beeLevel}`);
  if (overlay.enterpriseType) parts.push(overlay.enterpriseType);
  if (overlay.ocpo && overlay.ocpo.activeCount > 0) {
    parts.push(
      `${overlay.ocpo.activeCount} active restricted-supplier record${
        overlay.ocpo.activeCount === 1 ? "" : "s"
      }`,
    );
  }

  if (parts.length === 0) return null;

  return (
    <p className="mt-2 text-xs text-muted-foreground">{parts.join(" · ")}</p>
  );
}
