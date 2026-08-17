/**
 * Procurement Officer Directory screen (TASK-1.5 shell + TASK-1.6 search).
 *
 * Renders honest sync state and the local-first search surface: debounced
 * query, province/kind/status selects plus organisation/role (server-only)
 * inputs, result rows with data-quality chips, recent searches when idle.
 */

import { useState } from "react";
import type { SqlExecutor } from "../../db/executor";
import { tauriSqlExecutor } from "../../db/tauri-sql-executor";
import type { OfficerSyncFeed } from "../../services/sync/procurement-officers-sync";
import type { WorkspaceOwnerId } from "../../services/storage/workspace-owner";
import { useOfficerSync } from "./use-officer-sync";
import {
  OFFICER_PROVINCES,
  useOfficerSearch,
  type OfficerSearchFeed,
  type OfficerFilters,
} from "./use-officer-search";
import { QualityLabel } from "./QualityLabel";

export interface ProcurementOfficerDirectoryProps {
  feed: OfficerSyncFeed & OfficerSearchFeed;
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await sync.refresh();
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
      <section aria-labelledby="procurement-officers-heading">
        <Heading
          onRefresh={() => void handleRefresh()}
          refreshing={refreshing || sync.phase === "syncing"}
        />
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">Directory not enabled</p>
          <p className="mt-1 text-foreground/70">
            The Procurement Officers directory is not enabled for your
            workspace yet. Check back later.
          </p>
        </div>
      </section>
    );
  }

  if (sync.featureState === "entitlement-missing") {
    return (
      <section aria-labelledby="procurement-officers-heading">
        <Heading
          onRefresh={() => void handleRefresh()}
          refreshing={refreshing || sync.phase === "syncing"}
        />
        <div className="rounded-md border border-orange-300 bg-orange-50 p-4 text-sm">
          <p className="font-medium">Not included in your plan</p>
          <p className="mt-1 text-foreground/70">
            Procurement officer data is not part of your current plan. Your
            last synced directory remains available in read-only form.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="procurement-officers-heading">
      <Heading
        onRefresh={() => void handleRefresh()}
        refreshing={refreshing || sync.phase === "syncing"}
      />

      <div className="mb-3 text-sm text-foreground/60">{statusLine}</div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label="Search officers"
          placeholder="Search officers by name, organisation, title…"
          value={search.query}
          onChange={(event) => search.setQuery(event.target.value)}
          className="min-w-64 flex-1 rounded-md border px-3 py-1.5 text-sm"
        />
        <select
          aria-label="Filter by province"
          value={search.filters.province ?? ""}
          onChange={(event) =>
            updateFilters({ province: event.target.value || undefined })
          }
          className="rounded-md border px-2 py-1.5 text-sm"
        >
          <option value="">All provinces</option>
          {OFFICER_PROVINCES.map((province) => (
            <option key={province} value={province}>
              {province}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by kind"
          value={search.filters.kind ?? ""}
          onChange={(event) =>
            updateFilters({ kind: event.target.value || undefined })
          }
          className="rounded-md border px-2 py-1.5 text-sm"
        >
          <option value="">All kinds</option>
          {KIND_OPTIONS.map((kind) => (
            <option key={kind} value={kind}>
              {kind === "officer" ? "Officers" : "Departments"}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          value={search.filters.status ?? ""}
          onChange={(event) =>
            updateFilters({ status: event.target.value || undefined })
          }
          className="rounded-md border px-2 py-1.5 text-sm"
        >
          <option value="">Any status</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status === "verified" ? "Verified" : "Unverified"}
            </option>
          ))}
        </select>
        <input
          type="text"
          aria-label="Filter by organisation"
          placeholder="Organisation"
          value={search.filters.organisation ?? ""}
          onChange={(event) =>
            updateFilters({ organisation: event.target.value || undefined })
          }
          className="w-40 rounded-md border px-3 py-1.5 text-sm"
        />
        <input
          type="text"
          aria-label="Filter by role"
          placeholder="Role"
          value={search.filters.role ?? ""}
          onChange={(event) =>
            updateFilters({ role: event.target.value || undefined })
          }
          className="w-32 rounded-md border px-3 py-1.5 text-sm"
        />
      </div>

      {search.phase === "error" && (
        <p className="mb-3 text-sm text-red-600" role="alert">
          The server refresh failed. Showing locally synced results only.
        </p>
      )}

      {!search.query && !hasAnyFilter(search.filters) ? (
        search.recentSearches.length > 0 ? (
          <div className="rounded-md border p-4">
            <p className="mb-2 text-sm font-medium">Recent searches</p>
            <div className="flex flex-wrap gap-2">
              {search.recentSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => search.setQuery(term)}
                  className="rounded-full border px-3 py-1 text-sm"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-md border p-6 text-center text-sm text-foreground/60">
            Search the directory to see procurement contacts. Results appear
            instantly from the local index and refresh from the server.
          </div>
        )
      ) : search.results.length === 0 ? (
        <div className="rounded-md border p-6 text-center text-sm text-foreground/60">
          {search.phase === "searching-local" || search.phase === "refreshing"
            ? "Searching…"
            : "No officers match your search."}
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {search.results.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-4 p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{row.canonicalName}</p>
                <p className="truncate text-sm text-foreground/60">
                  {[row.currentTitle, row.organisationName, row.province]
                    .filter(Boolean)
                    .join(" · ") || "Details pending"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <QualityLabel status={row.status} lastSeenAt={row.lastSeenAt} />
                {row.saved && (
                  <span className="text-xs font-medium text-emerald-700">Saved</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
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
    <header className="mb-4 flex items-center justify-between">
      <div>
        <h1 id="procurement-officers-heading" className="text-2xl font-semibold">
          Procurement Officers
        </h1>
        <p className="mt-1 text-sm text-foreground/60">
          Official procurement contacts, compiled from published tender
          documents.
        </p>
      </div>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          {refreshing ? "Syncing…" : "Sync now"}
        </button>
      )}
    </header>
  );
}

function hasAnyFilter(filters: OfficerFilters): boolean {
  return Boolean(
    filters.province || filters.kind || filters.status || filters.organisation || filters.role,
  );
}

function formatSyncTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}