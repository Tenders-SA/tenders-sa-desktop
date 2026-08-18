/**
 * Local-first officer search (TASK-1.6, design.md §UI).
 *
 * Pipeline per committed query: debounced (150–250 ms) → local FTS5 pass →
 * server refresh (coalesced — only the latest query wins; a stale response
 * is discarded) → merge by id. Server rows win on status/organisation/
 * tenders count; local rows contribute unmasked freshness (`lastSeenAt`).
 *
 * Honest filter split (design.md §UI, parent contract):
 * - Local pass runs only when every filter is locally answerable. The
 *   parent-only filters (organisation, role) suspend the local pass — the
 *   local index cannot answer them, so showing local rows would be lying.
 * - `kind` and `status` filter local rows AND post-filter server rows,
 *   because the parent's `role`/`verification` params are not the same
 *   axis as the local `kind`/`status` columns.
 */

import { useEffect, useRef, useState } from "react";
import type { SqlExecutor } from "../../db/executor";
import {
  getLocalPreference,
  setLocalPreference,
} from "../../db/repositories/local-preferences";
import {
  listSavedOfficers,
  searchOfficers,
  type OfficerSearchQuery as LocalSearchQuery,
} from "../../db/repositories/procurement-officers";
import type { ProcurementOfficerRow } from "../../db/schema/types";
import type {
  OfficerSearchQuery,
  OfficerSearchRow,
  OfficerSearchResult,
} from "../../services/api/endpoints/procurement-officers";

export interface OfficerSearchFeed {
  search(
    query: OfficerSearchQuery,
    signal?: AbortSignal,
  ): Promise<OfficerSearchResult>;
}

export interface OfficerFilters {
  province?: string;
  kind?: string;
  status?: string;
  organisation?: string;
  role?: string;
  /** Local-only post-filter (TASK-1.9, R-P18): keep saved rows only. */
  saved?: boolean;
}

export interface OfficerResultRow {
  id: string;
  canonicalName: string;
  currentTitle: string | null;
  organisationName: string | null;
  province: string | null;
  kind: string;
  status: string;
  /** Local freshness; the parent's search row carries no lastSeenAt. */
  lastSeenAt: string | null;
  tendersCount: number;
  contactSummary: { email: string | null; telephone: string | null } | null;
  saved: boolean;
}

export type OfficerSearchPhase =
  "idle" | "searching-local" | "refreshing" | "error";

export interface OfficerSearchState {
  query: string;
  filters: OfficerFilters;
  results: OfficerResultRow[];
  phase: OfficerSearchPhase;
  recentSearches: string[];
}

export interface OfficerSearchControls {
  setQuery: (q: string) => void;
  setFilters: (filters: OfficerFilters) => void;
}

const RECENT_SEARCHES_KEY = "officerRecentSearches";
const RECENT_SEARCHES_LIMIT = 10;
const DEFAULT_DEBOUNCE_MS = 200;
const SA_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
] as const;

export function useOfficerSearch(
  feed: OfficerSearchFeed,
  executor: SqlExecutor,
  ownerId?: string,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
): OfficerSearchState & OfficerSearchControls {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<OfficerFilters>({});
  const [results, setResults] = useState<OfficerResultRow[]>([]);
  const [phase, setPhase] = useState<OfficerSearchPhase>("idle");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const debounced = useDebounced(query, debounceMs);
  // Filters are debounced too: the organisation/role inputs change on every
  // keystroke, and each settled change re-runs the pipeline (which includes
  // a server refresh when a server-only filter is set).
  const debouncedFilters = useDebounced(filters, debounceMs);
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    void listSavedOfficers(executor, ownerId)
      .then((rows) => {
        if (active) setSavedIds(new Set(rows.map((r) => r.officer_id)));
      })
      .catch(() => undefined);
    void getLocalPreference(executor, ownerId, RECENT_SEARCHES_KEY)
      .then((value) => {
        if (active && value) setRecentSearches(JSON.parse(value) as string[]);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [executor, ownerId]);

  useEffect(() => {
    if (!ownerId) return;
    const trimmed = debounced.trim();
    const runId = ++runIdRef.current;
    const controller = new AbortController();

    // Saved-only is a local post-filter, so an empty query with it set still
    // runs the local listing pass; everything else idles without a query.
    if (
      !trimmed &&
      !hasAnyFilter(debouncedFilters) &&
      !debouncedFilters.saved
    ) {
      setPhase("idle");
      setResults([]);
      return () => controller.abort();
    }

    const localAnswerable =
      !debouncedFilters.organisation && !debouncedFilters.role;
    const localQuery: LocalSearchQuery = {
      q: trimmed,
      province: debouncedFilters.province,
      kind: debouncedFilters.kind,
      status: debouncedFilters.status,
      limit: 20,
    };

    const run = async () => {
      let localRows: ProcurementOfficerRow[] = [];
      if (localAnswerable) {
        setPhase("searching-local");
        try {
          localRows = await searchOfficers(executor, ownerId, localQuery);
        } catch {
          // A local-pass failure must not masquerade as a server failure;
          // proceed with the server refresh and report whatever it says.
          localRows = [];
        }
        if (runIdRef.current !== runId) return;
      }

      try {
        setPhase("refreshing");
        const server = await feed.search(
          {
            q: trimmed,
            province: debouncedFilters.province,
            organisation: debouncedFilters.organisation,
            role: debouncedFilters.role,
            verification:
              debouncedFilters.status === "unverified"
                ? "unverified"
                : debouncedFilters.status === "verified"
                  ? "verified"
                  : undefined,
            page: 1,
            limit: 20,
          },
          controller.signal,
        );
        if (runIdRef.current !== runId) return;

        const serverRows = server.officers.filter(
          (row) =>
            (!debouncedFilters.kind || row.kind === debouncedFilters.kind) &&
            (!debouncedFilters.status ||
              row.status === debouncedFilters.status),
        );
        setResults(
          applySavedFilter(
            mergeOfficerRows(
              localRows,
              serverRows,
              savedIds,
              trimmed,
              debouncedFilters,
            ),
            debouncedFilters,
          ),
        );
        setPhase("idle");

        if (trimmed) {
          setRecentSearches((prev) => {
            const next = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(
              0,
              RECENT_SEARCHES_LIMIT,
            );
            void setLocalPreference(
              executor,
              ownerId,
              RECENT_SEARCHES_KEY,
              JSON.stringify(next),
            ).catch(() => undefined);
            return next;
          });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (runIdRef.current !== runId) return;
        if (localAnswerable && localRows.length > 0) {
          setResults(
            applySavedFilter(
              mergeOfficerRows(
                localRows,
                [],
                savedIds,
                trimmed,
                debouncedFilters,
              ),
              debouncedFilters,
            ),
          );
          setPhase("error");
        } else {
          setPhase("error");
        }
      }
    };

    void run();
    return () => controller.abort();
  }, [debounced, debouncedFilters, executor, feed, ownerId, savedIds]);

  return {
    query,
    filters,
    results,
    phase,
    recentSearches,
    setQuery,
    setFilters,
  };
}

export function hasAnyFilter(filters: OfficerFilters): boolean {
  return Boolean(
    filters.province ||
    filters.kind ||
    filters.status ||
    filters.organisation ||
    filters.role,
  );
}

/** Local saved-only post-filter: rows are already merged; drop unsaved ones. */
function applySavedFilter(
  rows: OfficerResultRow[],
  filters: OfficerFilters,
): OfficerResultRow[] {
  if (!filters.saved) return rows;
  return rows.filter((row) => row.saved);
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Server rows win on identity, organisation, tenders count and status;
 * the local row supplies `lastSeenAt` freshness. Local-only rows (not yet
 * on the server index, or the feed unavailable) append alphabetically.
 */
export function mergeOfficerRows(
  localRows: ProcurementOfficerRow[],
  serverRows: OfficerSearchRow[],
  savedIds: Set<string>,
  query: string,
  filters: OfficerFilters,
): OfficerResultRow[] {
  const localById = new Map(localRows.map((row) => [row.id, row]));
  const merged = serverRows.map<OfficerResultRow>((row) => {
    const local = localById.get(row.id);
    localById.delete(row.id);
    return {
      id: row.id,
      canonicalName: row.canonicalName,
      currentTitle: row.currentTitle,
      organisationName: row.organisationName,
      province: row.province,
      kind: row.kind,
      status: row.status,
      lastSeenAt: local?.last_seen_at ?? null,
      tendersCount: row.tendersCount,
      contactSummary: row.contactSummary,
      saved: savedIds.has(row.id),
    };
  });

  const localOnly = [...localById.values()]
    .filter((row) => rowMatchesFilters(row, filters))
    .sort((a, b) => a.canonical_name.localeCompare(b.canonical_name))
    .map<OfficerResultRow>((row) => ({
      id: row.id,
      canonicalName: row.canonical_name,
      currentTitle: row.current_title,
      organisationName: null,
      province: row.province,
      kind: row.kind,
      status: row.status,
      lastSeenAt: row.last_seen_at,
      tendersCount: 0,
      contactSummary: null,
      saved: savedIds.has(row.id),
    }));

  // Relevance over alphabet: an exact-name match leads its local-only peers.
  return [...merged, ...localOnly].sort((a, b) => {
    const aExact = a.canonicalName.toLowerCase() === query.trim().toLowerCase();
    const bExact = b.canonicalName.toLowerCase() === query.trim().toLowerCase();
    if (aExact !== bExact) return aExact ? -1 : 1;
    return a.canonicalName.localeCompare(b.canonicalName);
  });
}

function rowMatchesFilters(
  row: ProcurementOfficerRow,
  filters: OfficerFilters,
): boolean {
  if (filters.province && row.province !== filters.province) return false;
  if (filters.kind && row.kind !== filters.kind) return false;
  if (filters.status && row.status !== filters.status) return false;
  return true;
}

export const OFFICER_PROVINCES: readonly string[] = SA_PROVINCES;
