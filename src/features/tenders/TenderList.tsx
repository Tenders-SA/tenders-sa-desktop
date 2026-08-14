import { useEffect, useId, useState } from "react";
import { ApiError } from "../../services/api/errors";
import type {
  TenderListItem,
  TenderListResult,
  TendersEndpoint,
} from "../../services/api/endpoints/tenders";
import { ClosingLabel } from "./ClosingLabel";
import { describeTenderError } from "./tender-errors";
import { PROVINCES, PUBLICATION_FILTERS } from "./tender-filter-options";
import type { RecommendationsEndpoint } from "../../services/api/endpoints/recommendations";
import { TenderRadar } from "../radar/TenderRadar";
import { tenderListResultSchema } from "../../services/api/endpoints/tenders";
import { workspaceQueryKey } from "../../services/storage/cache-key";
import { useWorkspaceRuntime } from "../../services/storage/workspace-runtime-context";
import { WorkspaceDataStatus } from "../../components/common/WorkspaceDataStatus";

export interface TenderListProps {
  endpoint: TendersEndpoint;
  recommendations?: RecommendationsEndpoint;
  onOpenTender?: (id: string) => void;
}

type TenderView = "matched" | "all";

type State =
  | { status: "loading" }
  | { status: "ready"; result: TenderListResult; stale?: boolean }
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
    <li className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/50">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              {tender.publicationType?.replace(/_/g, " ") ?? "Tender notice"}
            </span>
            {tender.province && (
              <span className="text-xs text-muted-foreground">
                {tender.province}
              </span>
            )}
          </div>
          <h3 className="font-semibold leading-snug text-card-foreground">
            {onOpen ? (
              <button
                type="button"
                onClick={() => onOpen(tender.id)}
                className="line-clamp-2 text-left group-hover:text-primary"
              >
                {tender.title}
              </button>
            ) : (
              tender.title
            )}
          </h3>
          <p className="mt-2 truncate text-sm text-muted-foreground">
            {tender.sourceOrganization}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Ref {tender.referenceNumber}</span>
            {tender.industryCategories?.[0] && (
              <span>{tender.industryCategories[0]}</span>
            )}
            {typeof tender.documentCount === "number" && (
              <span>
                {tender.documentCount}{" "}
                {tender.documentCount === 1 ? "document" : "documents"}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 rounded border border-border bg-background/40 p-3 text-right text-sm">
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
export function TenderList({
  endpoint,
  recommendations,
  onOpenTender,
}: TenderListProps) {
  const [view, setView] = useState<TenderView>(
    recommendations ? "matched" : "all",
  );
  const [state, setState] = useState<State>({ status: "loading" });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [province, setProvince] = useState("");
  // Empty string is the route's no-parameter default: open tenders.
  const [publicationType, setPublicationType] = useState("");
  const searchId = useId();
  const provinceId = useId();
  const publicationId = useId();
  const workspace = useWorkspaceRuntime();

  useEffect(() => {
    if (view !== "all") return;
    const controller = new AbortController();
    let active = true;
    setState({ status: "loading" });

    const query = {
      page,
      limit: 20,
      search: submittedSearch,
      province,
      publicationType,
    };
    const fetcher = () => endpoint.list(query, controller.signal);
    const request = workspace
      ? workspace.queries
          .load({
            key: workspaceQueryKey("tenders", query),
            schema: tenderListResultSchema,
            entity: "tender-list" as const,
            fetcher,
            onUpdate: (result) => {
              if (active) setState({ status: "ready", result, stale: false });
            },
          })
          .then((loaded) => ({
            value: loaded.value,
            stale: loaded.cached?.stale ?? false,
          }))
      : fetcher().then((value) => ({ value, stale: false }));

    request
      .then(({ value: result, stale }) => {
        if (active)
          setState({
            status: "ready",
            result,
            stale,
          });
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
  }, [
    endpoint,
    page,
    submittedSearch,
    province,
    publicationType,
    view,
    workspace,
  ]);

  const result = state.status === "ready" ? state.result : undefined;
  /** Whether a selection, rather than the corpus, could explain an empty page. */
  const narrowed = province !== "" || publicationType !== "";

  return (
    <section aria-labelledby="tenders-heading" className="max-w-6xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">
        Company opportunity desk
      </p>
      <h1
        id="tenders-heading"
        className="mt-1 text-2xl font-semibold tracking-tight text-foreground"
      >
        Find the right tender to prepare
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Start with opportunities scored for your company, or search the complete
        tender market when you need to investigate beyond your current matches.
      </p>
      <div className="mt-2">
        <WorkspaceDataStatus
          stale={state.status === "ready" && state.stale}
          refreshing={state.status === "ready" && state.stale}
          subject="saved tender results"
        />
      </div>

      {recommendations && (
        <div
          role="tablist"
          aria-label="Tender views"
          className="mt-6 inline-flex rounded border border-border bg-card p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === "matched"}
            onClick={() => setView("matched")}
            className={`rounded px-4 py-2 text-sm font-medium ${
              view === "matched"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Matched for your company
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "all"}
            onClick={() => setView("all")}
            className={`rounded px-4 py-2 text-sm font-medium ${
              view === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All tenders
          </button>
        </div>
      )}

      {view === "matched" && recommendations && (
        <div role="tabpanel" className="mt-6">
          <TenderRadar endpoint={recommendations} embedded />
        </div>
      )}

      {view === "all" && (
        <AllTenders
          state={state}
          result={result}
          search={search}
          submittedSearch={submittedSearch}
          province={province}
          publicationType={publicationType}
          searchId={searchId}
          provinceId={provinceId}
          publicationId={publicationId}
          narrowed={narrowed}
          onSearchChange={setSearch}
          onSearchSubmit={(value) => {
            setPage(1);
            setSubmittedSearch(value);
          }}
          onProvinceChange={(value) => {
            setPage(1);
            setProvince(value);
          }}
          onPublicationChange={(value) => {
            setPage(1);
            setPublicationType(value);
          }}
          onPageChange={setPage}
          onOpenTender={onOpenTender}
        />
      )}
    </section>
  );
}

interface AllTendersProps {
  state: State;
  result?: TenderListResult;
  search: string;
  submittedSearch: string;
  province: string;
  publicationType: string;
  searchId: string;
  provinceId: string;
  publicationId: string;
  narrowed: boolean;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (value: string) => void;
  onProvinceChange: (value: string) => void;
  onPublicationChange: (value: string) => void;
  onPageChange: (value: number | ((page: number) => number)) => void;
  onOpenTender?: (id: string) => void;
}

function AllTenders({
  state,
  result,
  search,
  submittedSearch,
  province,
  publicationType,
  searchId,
  provinceId,
  publicationId,
  narrowed,
  onSearchChange,
  onSearchSubmit,
  onProvinceChange,
  onPublicationChange,
  onPageChange,
  onOpenTender,
}: AllTendersProps) {
  return (
    <div role="tabpanel" className="mt-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-card-foreground">
            Search the complete tender market
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These results are not company-scored until they appear in Tender
            Radar.
          </p>
        </div>

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSearchSubmit(search.trim());
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
            onChange={(event) => onSearchChange(event.target.value)}
            className="flex-1 rounded border border-input bg-background px-3 py-2 text-foreground"
          />
          <button
            type="submit"
            className="rounded bg-primary px-4 py-2 font-medium text-primary-foreground"
          >
            Search
          </button>
        </form>

        {/*
        Filters apply immediately rather than on submit, because a select has
        no ambiguity about when the user is finished with it. Each change
        resets to page 1: staying on page 4 of a narrower result set would
        show an empty page and read as "no tenders match".
      */}
        <div className="mt-3 flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <label
              htmlFor={provinceId}
              className="text-sm text-muted-foreground"
            >
              Province
            </label>
            <select
              id={provinceId}
              value={province}
              onChange={(event) => {
                onProvinceChange(event.target.value);
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

          <div className="flex items-center gap-2">
            <label
              htmlFor={publicationId}
              className="text-sm text-muted-foreground"
            >
              Show
            </label>
            <select
              id={publicationId}
              value={publicationType}
              onChange={(event) => {
                onPublicationChange(event.target.value);
              }}
              className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
            >
              {PUBLICATION_FILTERS.map((filter) => (
                <option key={filter.label} value={filter.value ?? ""}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

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
          {/*
            The distinction matters: "none available" when a filter is
            narrowing the corpus would tell the user the platform is empty
            when in fact their own selection is.
          */}
          {submittedSearch && narrowed
            ? `No tenders match “${submittedSearch}” with the current filters.`
            : submittedSearch
              ? `No tenders match “${submittedSearch}”.`
              : narrowed
                ? "No tenders match the current filters."
                : "No open tenders are available right now."}
        </p>
      )}

      {result && result.tenders.length > 0 && (
        <>
          <p className="mt-6 text-sm text-muted-foreground">
            {result.total} {result.total === 1 ? "tender" : "tenders"} found
          </p>
          <ul className="mt-3 grid gap-3 xl:grid-cols-2">
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
              onClick={() => onPageChange((p) => Math.max(1, p - 1))}
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
              onClick={() => onPageChange((p) => p + 1)}
              className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
            >
              Next
            </button>
          </nav>
        </>
      )}
    </div>
  );
}
