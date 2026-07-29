import { useId, useState } from "react";
import { AsyncSection } from "../../components/common/AsyncSection";
import { useAsync } from "../../hooks/use-async";
import {
  formatAwardValue,
  type IntelligenceCompany,
  type SupplierIntelligenceEndpoint,
} from "../../services/api/endpoints/supplier-intelligence";
import { PROVINCES } from "../tenders/tender-filter-options";

export interface SupplierIntelligenceProps {
  endpoint: SupplierIntelligenceEndpoint;
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
export function SupplierIntelligence({ endpoint }: SupplierIntelligenceProps) {
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

              <ul className="mt-3 flex flex-col gap-3">
                {result.companies.map((company) => (
                  <CompanyRow key={company.slug} company={company} />
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

function CompanyRow({ company }: { company: IntelligenceCompany }) {
  const enrichment = company.enrichment;

  return (
    <li className="rounded border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate font-medium text-card-foreground">
            {company.name}
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
            {" — verify before relying on it"}
          </p>
        </div>
      )}
    </li>
  );
}
