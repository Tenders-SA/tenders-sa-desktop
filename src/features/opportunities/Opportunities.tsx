import { useState } from "react";
import { Link } from "react-router-dom";
import { AsyncSection } from "../../components/common/AsyncSection";
import { useAsync } from "../../hooks/use-async";
import type { SavedTendersEndpoint } from "../../services/api/endpoints/saved-tenders";
import { ClosingLabel } from "../tenders/ClosingLabel";

export interface OpportunitiesProps {
  endpoint: SavedTendersEndpoint;
}

/**
 * Opportunities — the shortlist awaiting a bid decision, and the queue into
 * the assessment itself.
 *
 * This screen deliberately does **not** assess anything. Brief §6.3
 * Opportunity Assessment is already built on the tender detail screen —
 * summary (`TenderDetail`), AI requirement summary (`TenderAnalysisWorkbench`),
 * internal readiness (`EligibilityPanel`) and buyer intelligence
 * (`TenderIntelligenceOverview`) — and matched tenders are already at `/radar`.
 * Each row therefore links to `/tenders/:id` rather than repeating either.
 *
 * Filtering to still-biddable work is done **server-side** via `activeOnly`
 * and `futureOnly`, not by discarding rows after they arrive. Client-side
 * filtering would make the pagination totals lie: a page of 20 could render
 * as 3 rows with the count still claiming 20.
 *
 * `openOnly` defaults to **off** because `activeOnly=true` currently returns
 * HTTP 500 from the parent: `saved-tenders/route.ts` filters the Prisma enum
 * `TenderStatus` against non-members. That is a parent defect, diagnosed in
 * `prompts/saved-tenders-activeonly-500.md`, and cannot be fixed from this
 * repository. The checkbox is kept so the capability survives and the server
 * bug stays reachable in one click rather than being hidden. Flip this default
 * back once that brief ships.
 */
export function Opportunities({ endpoint }: OpportunitiesProps) {
  const [page, setPage] = useState(1);
  const [openOnly, setOpenOnly] = useState(false);

  const state = useAsync(
    (signal) =>
      endpoint.list(
        { page, limit: 20, activeOnly: openOnly, futureOnly: openOnly },
        signal,
      ),
    [endpoint, page, openOnly],
  );

  return (
    <section aria-labelledby="opportunities-heading" className="max-w-4xl">
      <h1
        id="opportunities-heading"
        className="text-xl font-semibold text-foreground"
      >
        Opportunities
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tenders you have shortlisted, awaiting a bid decision. Open one to see
        its requirements, your readiness and the buyer's record.
      </p>

      <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={openOnly}
          onChange={(event) => {
            setPage(1);
            setOpenOnly(event.target.checked);
          }}
          className="size-4"
        />
        Show only tenders still open
      </label>

      <div className="mt-6">
        <AsyncSection
          state={state}
          subject="your saved tenders"
          onRetry={state.reload}
          isEmpty={(result) => result.tenders.length === 0}
          empty={
            <div className="rounded border border-border bg-card p-6">
              <h2 className="text-sm font-medium text-card-foreground">
                {openOnly
                  ? "No saved tenders are still open"
                  : "You have not saved any tenders yet"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Save a tender from Tender Radar or the tender list to track it
                here.
              </p>
              <Link
                to="/radar"
                className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
              >
                Open Tender Radar
              </Link>
            </div>
          }
        >
          {(result) => (
            <>
              <p className="text-sm text-muted-foreground">
                {result.total} saved
                {result.closedCount > 0 &&
                  `, ${result.closedCount} now closed or awarded`}
              </p>

              <ul className="mt-3 flex flex-col gap-3">
                {result.tenders.map((tender) => (
                  <li
                    key={tender.id}
                    className="rounded border border-border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate font-medium text-card-foreground">
                          <Link
                            to={`/tenders/${encodeURIComponent(tender.id)}`}
                            className="hover:underline"
                          >
                            {tender.title}
                          </Link>
                        </h3>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {tender.organization ?? "Buyer not recorded"}
                          {tender.province ? ` · ${tender.province}` : ""}
                        </p>
                        {tender.referenceNumber && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Ref {tender.referenceNumber}
                          </p>
                        )}
                        {tender.categories.length > 0 && (
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {tender.categories.join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right text-sm">
                        {tender.closingDate ? (
                          <ClosingLabel closingDate={tender.closingDate} />
                        ) : (
                          <span className="text-muted-foreground">
                            No closing date
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {result.totalPages > 1 && (
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
                    disabled={result.page >= result.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          )}
        </AsyncSection>
      </div>
    </section>
  );
}
