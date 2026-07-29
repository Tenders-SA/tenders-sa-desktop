import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { AsyncSection } from "../../components/common/AsyncSection";
import { useAsync } from "../../hooks/use-async";
import {
  describeApplicationStatus,
  type ApplicationsEndpoint,
} from "../../services/api/endpoints/applications";
import { ClosingLabel } from "../tenders/ClosingLabel";

export interface ApplicationListProps {
  endpoint: ApplicationsEndpoint;
}

/**
 * Statuses the parent's `ApplicationStatus` enum uses for live work.
 *
 * `/api/v1/applications` upper-cases whatever it is given, so these are sent
 * as-is. An unknown value would simply match nothing rather than error, which
 * is why the list is confined to values read from the parent schema.
 */
const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "AWARDED", label: "Awarded" },
  { value: "REJECTED", label: "Unsuccessful" },
] as const;

/**
 * Application Workspaces (brief §5, §6).
 *
 * Pagination here is offset-based (`{total, limit, offset, hasMore}`), unlike
 * the page-based saved-tenders route. Both shapes are the parent's and are
 * handled per endpoint rather than normalised into one, because a wrong guess
 * silently pages through the wrong records.
 */
export function ApplicationList({ endpoint }: ApplicationListProps) {
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const searchId = useId();
  const statusId = useId();

  const state = useAsync(
    (signal) =>
      endpoint.list(
        { offset, limit: 20, status, search: submittedSearch, archived },
        signal,
      ),
    [endpoint, offset, status, submittedSearch, archived],
  );

  return (
    <section aria-labelledby="applications-heading" className="max-w-4xl">
      <h1
        id="applications-heading"
        className="text-xl font-semibold text-foreground"
      >
        Application Workspaces
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tenders you are preparing a bid for.
      </p>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setOffset(0);
          setSubmittedSearch(search.trim());
        }}
      >
        <label htmlFor={searchId} className="sr-only">
          Search applications
        </label>
        <input
          id={searchId}
          type="search"
          value={search}
          placeholder="Search by tender title, reference or buyer"
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

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor={statusId} className="text-sm text-muted-foreground">
            Status
          </label>
          <select
            id={statusId}
            value={status}
            onChange={(event) => {
              setOffset(0);
              setStatus(event.target.value);
            }}
            className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          >
            {STATUS_FILTERS.map((filter) => (
              <option key={filter.label} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={archived}
            onChange={(event) => {
              setOffset(0);
              setArchived(event.target.checked);
            }}
            className="size-4"
          />
          Show archived
        </label>
      </div>

      <div className="mt-6">
        <AsyncSection
          state={state}
          subject="your applications"
          onRetry={state.reload}
          isEmpty={(result) => result.applications.length === 0}
          empty={
            <div className="rounded border border-border bg-card p-6">
              <h2 className="text-sm font-medium text-card-foreground">
                No applications here
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Open a tender and start an application to build a workspace for
                it.
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
                {result.total}{" "}
                {result.total === 1 ? "application" : "applications"}
              </p>

              <ul className="mt-3 flex flex-col gap-3">
                {result.applications.map((application) => (
                  <li
                    key={application.id}
                    className="rounded border border-border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate font-medium text-card-foreground">
                          <Link
                            to={`/applications/${encodeURIComponent(application.id)}`}
                            className="hover:underline"
                          >
                            {application.tender.title}
                          </Link>
                        </h3>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {application.tender.sourceOrganization ??
                            "Buyer not recorded"}
                          {application.tender.province
                            ? ` · ${application.tender.province}`
                            : ""}
                        </p>
                        {application.tender.referenceNumber && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Ref {application.tender.referenceNumber}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right text-sm">
                        <p className="font-medium text-foreground">
                          {describeApplicationStatus(application.status)}
                        </p>
                        {application.tender.closingDate ? (
                          <ClosingLabel
                            closingDate={application.tender.closingDate}
                          />
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

              <nav
                aria-label="Pagination"
                className="mt-6 flex items-center justify-between"
              >
                <button
                  type="button"
                  disabled={offset === 0}
                  onClick={() => setOffset((o) => Math.max(0, o - 20))}
                  className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!result.hasMore}
                  onClick={() => setOffset((o) => o + 20)}
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
