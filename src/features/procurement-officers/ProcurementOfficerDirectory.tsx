/**
 * Procurement Officer Directory screen (TASK-1.5 shell + TASK-1.6 search +
 * TASK-1.7 detail panel).
 *
 * Renders honest sync state and the local-first search surface: debounced
 * query, province/kind/status selects plus organisation/role (server-only)
 * inputs, result rows with data-quality chips, recent searches when idle,
 * and an officer detail panel with actions when a row is selected.
 */

import { useState } from "react";
import type { SqlExecutor } from "../../db/executor";
import { tauriSqlExecutor } from "../../db/tauri-sql-executor";
import type { OfficerSyncFeed } from "../../services/sync/procurement-officers-sync";
import type { WorkspaceOwnerId } from "../../services/storage/workspace-owner";
import { useOfficerSync } from "./use-officer-sync";
import { OfficerDetailPanel } from "./OfficerDetailPanel";
import { useOfficerDetail, type OfficerDetailFeed } from "./use-officer-detail";
import {
  CorrectionDialog,
  type CorrectionFieldOption,
} from "./CorrectionDialog";
import {
  useOfficerCorrections,
  type OfficerCorrectionFeed,
} from "./use-officer-corrections";
import {
  OFFICER_PROVINCES,
  useOfficerSearch,
  hasAnyFilter,
  type OfficerSearchFeed,
  type OfficerFilters,
} from "./use-officer-search";
import { QualityLabel } from "./QualityLabel";

export interface ProcurementOfficerDirectoryProps {
  feed: OfficerSyncFeed &
    OfficerSearchFeed &
    OfficerDetailFeed &
    OfficerCorrectionFeed;
  executor?: SqlExecutor;
  ownerId?: WorkspaceOwnerId;
}

const KIND_OPTIONS = ["officer", "department"] as const;
const STATUS_OPTIONS = ["verified", "unverified"] as const;

export function ProcurementOfficerDirectory({
  feed,
  executor = tauriSqlExecutor,
  ownerId,
}: ProcurementOfficerDirectoryProps) {
  const sync = useOfficerSync(feed, executor, ownerId);
  const search = useOfficerSearch(feed, executor, ownerId);
  const [refreshing, setRefreshing] = useState(false);
  const [offRecheckAt, setOffRecheckAt] = useState<string | null>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState<string | null>(
    null,
  );
  const detail = useOfficerDetail(feed, executor, ownerId, selectedOfficerId);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionField, setCorrectionField] =
    useState<CorrectionFieldOption | null>(null);

  const currentValues =
    selectedOfficerId && detail.data
      ? {
          email:
            detail.data.contactPoints.find((c) => c.type === "email")?.value ??
            null,
          telephone:
            detail.data.contactPoints.find((c) => c.type === "telephone")
              ?.value ?? null,
          mobile:
            detail.data.contactPoints.find((c) => c.type === "mobile")?.value ??
            null,
          title: detail.data.headlineAssignment?.title ?? null,
          organisation: detail.data.organisationName ?? null,
          officer: detail.data.canonicalName ?? null,
        }
      : null;
  const corrections = useOfficerCorrections(
    feed,
    executor,
    ownerId,
    selectedOfficerId,
    currentValues,
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const outcome = await sync.refresh();
      if (outcome.featureState === "off") {
        setOffRecheckAt(new Date().toISOString());
      } else {
        setOffRecheckAt(null);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const updateFilters = (patch: Partial<OfficerFilters>) => {
    search.setFilters({ ...search.filters, ...patch });
  };

  const statusLine =
    sync.phase === "syncing"
      ? "Syncing the local directory…"
      : sync.phase === "failed"
        ? "Sync failed — showing the last synced directory."
        : sync.lastSyncAt
          ? `Last synced ${formatSyncTime(sync.lastSyncAt)}.`
          : "No sync has run yet.";

  if (sync.featureState === "off") {
    return (
      <section
        aria-labelledby="procurement-officers-heading"
        className="max-w-6xl"
      >
        <Heading
          onRefresh={() => void handleRefresh()}
          refreshing={refreshing || sync.phase === "syncing"}
        />
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-5 text-sm shadow-sm">
          <p className="font-medium text-warning">Directory not enabled</p>
          <p className="mt-1 text-foreground/70">
            The Procurement Officers directory is not enabled for your workspace
            yet. Check back later.
          </p>
          {offRecheckAt && (
            <p className="mt-2 text-xs text-muted-foreground" role="status">
              Rechecked just now — the directory is still not enabled.
            </p>
          )}
        </div>
      </section>
    );
  }

  const entitlementBanner = sync.featureState === "entitlement-missing" && (
    <div className="mb-5 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm shadow-sm">
      <p className="font-medium text-warning">Not included in your plan</p>
      <p className="mt-1 text-foreground/70">
        Procurement officer data is not part of your current plan. Your last
        synced directory remains available in read-only form — search still
        works against the server directory.
      </p>
    </div>
  );

  return (
    <section
      aria-labelledby="procurement-officers-heading"
      className="max-w-6xl"
    >
      <Heading
        onRefresh={() => void handleRefresh()}
        refreshing={refreshing || sync.phase === "syncing"}
      />

      {entitlementBanner}

      <div className="mb-5 flex items-center gap-2 text-sm text-muted-foreground">
        <span
          className="size-2 rounded-full bg-muted-foreground"
          aria-hidden="true"
        />
        {statusLine}
      </div>

      <section
        aria-label="Directory search and filters"
        className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1">
            <span className="mb-1.5 block text-sm font-medium text-card-foreground">
              Search the directory
            </span>
            <input
              type="search"
              aria-label="Search officers"
              placeholder="Search officers by name, organisation, title…"
              value={search.query}
              onChange={(event) => search.setQuery(event.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </label>
          <label className="min-w-36">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Province
            </span>
            <select
              aria-label="Filter by province"
              value={search.filters.province ?? ""}
              onChange={(event) =>
                updateFilters({ province: event.target.value || undefined })
              }
              className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm text-foreground"
            >
              <option value="">All provinces</option>
              {OFFICER_PROVINCES.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-32">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Contact type
            </span>
            <select
              aria-label="Filter by kind"
              value={search.filters.kind ?? ""}
              onChange={(event) =>
                updateFilters({ kind: event.target.value || undefined })
              }
              className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm text-foreground"
            >
              <option value="">All kinds</option>
              {KIND_OPTIONS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind === "officer" ? "Officers" : "Departments"}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-32">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Verification
            </span>
            <select
              aria-label="Filter by status"
              value={search.filters.status ?? ""}
              onChange={(event) =>
                updateFilters({ status: event.target.value || undefined })
              }
              className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm text-foreground"
            >
              <option value="">Any status</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status === "verified" ? "Verified" : "Unverified"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
          <label className="w-48">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Organisation
            </span>
            <input
              type="text"
              aria-label="Filter by organisation"
              placeholder="Organisation"
              value={search.filters.organisation ?? ""}
              onChange={(event) =>
                updateFilters({ organisation: event.target.value || undefined })
              }
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="w-40">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Role
            </span>
            <input
              type="text"
              aria-label="Filter by role"
              placeholder="Role"
              value={search.filters.role ?? ""}
              onChange={(event) =>
                updateFilters({ role: event.target.value || undefined })
              }
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <button
            type="button"
            aria-pressed={search.filters.saved ?? false}
            onClick={() =>
              updateFilters({ saved: search.filters.saved ? undefined : true })
            }
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 aria-pressed:border-primary aria-pressed:bg-primary/10"
          >
            Saved only
          </button>
        </div>
      </section>

      {search.phase === "error" && (
        <p className="mb-3 text-sm text-destructive" role="alert">
          The server refresh failed. Showing locally synced results only
          {sync.lastSyncAt
            ? ` (last synced ${formatSyncTime(sync.lastSyncAt)}).`
            : "."}
        </p>
      )}

      {!search.query &&
      !hasAnyFilter(search.filters) &&
      !search.filters.saved ? (
        search.recentSearches.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-2 text-sm font-medium">Recent searches</p>
            <div className="flex flex-wrap gap-2">
              {search.recentSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => search.setQuery(term)}
                  className="rounded-full border border-border bg-background px-3 py-1 text-sm text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Search the directory to see procurement contacts. Results appear
            instantly from the local index and refresh from the server.
          </div>
        )
      ) : selectedOfficerId ? (
        <OfficerDetailPanel
          view={detail}
          suppressed={corrections.suppressed}
          onReportCorrection={(field, label, value) => {
            setCorrectionField({ field, label, value });
            setCorrectionOpen(true);
          }}
          onClose={() => setSelectedOfficerId(null)}
        />
      ) : search.results.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {search.phase === "searching-local" || search.phase === "refreshing"
            ? "Searching…"
            : search.filters.saved
              ? "No saved officers yet — save one from its details."
              : "No officers match your search."}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {search.results.map((row) => (
            <li
              key={row.id}
              className="group rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/50"
            >
              <button
                type="button"
                onClick={() => setSelectedOfficerId(row.id)}
                className="min-w-0 w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="block truncate font-medium">
                  <span className="group-hover:text-primary">
                    {row.canonicalName}
                  </span>
                </span>
                <span className="mt-1 block truncate text-sm text-muted-foreground">
                  {[row.currentTitle, row.organisationName, row.province]
                    .filter(Boolean)
                    .join(" · ") || "Details pending"}
                </span>
              </button>
              <div className="mt-3 flex items-center gap-2">
                <QualityLabel status={row.status} lastSeenAt={row.lastSeenAt} />
                {row.saved && (
                  <span className="text-xs font-medium text-success">
                    Saved
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <CorrectionDialog
        open={correctionOpen}
        officerName={detail.data?.canonicalName ?? "This officer"}
        fields={correctionField ? [correctionField] : []}
        phase={corrections.phase}
        status={corrections.status}
        errorMessage={corrections.errorMessage}
        onSubmit={(field, value, reason) => {
          void corrections.submitCorrection(field, value, reason);
        }}
        onClose={() => {
          setCorrectionOpen(false);
          corrections.reset();
        }}
      />
    </section>
  );
}

function Heading({
  onRefresh,
  refreshing = false,
}: {
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-4 overflow-hidden rounded-xl border border-primary/25 bg-card p-5 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Procurement intelligence
        </p>
        <h1
          id="procurement-officers-heading"
          className="mt-1 text-2xl font-bold tracking-tight text-foreground"
        >
          Procurement Officers
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Official procurement contacts, compiled from published tender
          documents.
        </p>
      </div>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {refreshing ? "Syncing…" : "Sync now"}
        </button>
      )}
    </header>
  );
}

function formatSyncTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}
