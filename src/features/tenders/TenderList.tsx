import { useEffect, useId, useState } from "react";
import { ApiError } from "../../services/api/errors";
import type {
  TenderListItem,
  TenderListResult,
  TendersEndpoint,
} from "../../services/api/endpoints/tenders";
import { ClosingLabel } from "./ClosingLabel";
import { describeTenderError } from "./tender-errors";

export interface TenderListProps {
  endpoint: TendersEndpoint;
  onOpenTender?: (id: string) => void;
}

type State =
  | { status: "loading" }
  | { status: "ready"; result: TenderListResult }
  | { status: "error"; message: string; kind: string };

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

function TenderRow({
  tender,
  onOpen,
}: {
  tender: TenderListItem;
  onOpen?: (id: string) => void;
}) {
  return (
    <li className="rounded border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate font-medium text-card-foreground">
            {onOpen ? (
              <button
                type="button"
                onClick={() => onOpen(tender.id)}
                className="text-left hover:underline"
              >
                {tender.title}
              </button>
            ) : (
              tender.title
            )}
          </h3>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {tender.sourceOrganization}
            {tender.province ? ` · ${tender.province}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ref {tender.referenceNumber}
          </p>
        </div>
        <div className="shrink-0 text-right text-sm">
          <ClosingLabel closingDate={tender.closingDate} />
          {typeof tender.estimatedValue === "number" && (
            <p className="mt-1 text-muted-foreground">
              {ZAR.format(tender.estimatedValue)}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Tender discovery — the first product screen with real domain data.
 *
 * Pagination is `page`/`limit`, which is what `/api/tenders` implements. An
 * explicit `limit` is always sent (PERF-3).
 */
export function TenderList({ endpoint, onOpenTender }: TenderListProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const searchId = useId();

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ status: "loading" });

    endpoint
      .list({ page, limit: 20, search: submittedSearch }, controller.signal)
      .then((result) => {
        if (active) setState({ status: "ready", result });
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.kind === "cancelled") return;
        if (active) {
          setState({
            status: "error",
            ...describeTenderError(error, "tenders"),
          });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [endpoint, page, submittedSearch]);

  const result = state.status === "ready" ? state.result : undefined;

  return (
    <section aria-labelledby="tenders-heading">
      <h1
        id="tenders-heading"
        className="text-xl font-semibold text-foreground"
      >
        Tenders
      </h1>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSubmittedSearch(search.trim());
        }}
      >
        <label htmlFor={searchId} className="sr-only">
          Search tenders
        </label>
        <input
          id={searchId}
          type="search"
          value={search}
          placeholder="Search by title or reference"
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

      {state.status === "loading" && (
        <p role="status" className="mt-6 text-sm text-muted-foreground">
          Loading tenders…
        </p>
      )}

      {state.status === "error" && (
        <p
          role="alert"
          data-error-kind={state.kind}
          className="mt-6 text-sm text-destructive"
        >
          {state.message}
        </p>
      )}

      {result && result.tenders.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          {submittedSearch
            ? `No tenders match “${submittedSearch}”.`
            : "No tenders are available."}
        </p>
      )}

      {result && result.tenders.length > 0 && (
        <>
          <p className="mt-6 text-sm text-muted-foreground">
            {result.total} {result.total === 1 ? "tender" : "tenders"} found
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {result.tenders.map((tender) => (
              <TenderRow
                key={tender.id}
                tender={tender}
                onOpen={onOpenTender}
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
              Page {result.page} of {result.pages}
            </span>
            <button
              type="button"
              disabled={result.page >= result.pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
            >
              Next
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
