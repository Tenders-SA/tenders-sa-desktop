import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { FakeSqlExecutor } from "./fakes/sql-executor";
import { assertWorkspaceOwner } from "../services/storage/workspace-owner";
import { mergeOfficerRows, useOfficerSearch, type OfficerSearchFeed } from "../features/procurement-officers/use-officer-search";
import type { ProcurementOfficerRow } from "../db/schema/types";
import type { OfficerSearchQuery, OfficerSearchResult, OfficerSearchRow } from "../services/api/endpoints/procurement-officers";

const owner = assertWorkspaceOwner(`v1-${"d".repeat(64)}`);

function localRow(overrides: Partial<ProcurementOfficerRow> = {}): ProcurementOfficerRow {
  return {
    owner_id: owner,
    id: "officer-1",
    canonical_name: "Thabo Mokoena",
    first_name: "Thabo",
    last_name: "Mokoena",
    current_title: "Supply Chain Manager",
    current_organisation_id: "org-9",
    province: "Gauteng",
    kind: "officer",
    status: "verified",
    confidence_score: 0.95,
    first_seen_at: "2025-01-01T00:00:00.000Z",
    last_seen_at: "2025-06-01T00:00:00.000Z",
    verified_at: "2025-03-01T00:00:00.000Z",
    suppressed: 0,
    updated_at: "2025-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function serverRow(overrides: Partial<OfficerSearchRow> = {}): OfficerSearchRow {
  return {
    id: "officer-1",
    canonicalName: "Thabo Mokoena",
    firstName: "Thabo",
    lastName: "Mokoena",
    currentTitle: "Supply Chain Manager",
    currentOrganisationId: "org-9",
    organisationName: "Department of Water Affairs",
    province: "Gauteng",
    kind: "officer",
    status: "verified",
    confidenceScore: 0.95,
    tendersCount: 3,
    contactSummary: { email: "th***@dwa.gov.za", telephone: "012****89" },
    ...overrides,
  };
}

function searchResult(rows: OfficerSearchRow[]): OfficerSearchResult {
  return { officers: rows, page: 1, limit: 20, total: rows.length };
}

class FakeFeed implements OfficerSearchFeed {
  calls: OfficerSearchQuery[] = [];
  pages: Array<OfficerSearchResult | Error> = [];
  async search(query: OfficerSearchQuery) {
    this.calls.push(query);
    const next = this.pages.shift();
    if (next instanceof Error) throw next;
    return next ?? searchResult([]);
  }
}

function advanceDebounce(ms = 250) {
  return act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useOfficerSearch", () => {
  it("debounces the query into a single local + server search", async () => {
    vi.useFakeTimers();
    const db = new FakeSqlExecutor();
    db.selectResults = [[], [], [], []]; // saved ids, recent pref, local pass
    const feed = new FakeFeed();
    feed.pages = [searchResult([serverRow()])];

    const { result } = renderHook(() => useOfficerSearch(feed, db, owner));
    await act(async () => {}); // mount effects

    act(() => result.current.setQuery("mok"));
    act(() => result.current.setQuery("moko"));
    await advanceDebounce();

    expect(feed.calls).toHaveLength(1);
    expect(feed.calls[0].q).toBe("moko");
    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0].canonicalName).toBe("Thabo Mokoena");
  });

  it("merges server and local rows by id: server wins on status, local on freshness", () => {
    const merged = mergeOfficerRows(
      [localRow({ last_seen_at: "2025-12-01T00:00:00.000Z" })],
      [serverRow({ status: "unverified" })],
      new Set(["officer-1"]),
      "mokoena",
      {},
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe("unverified");
    expect(merged[0].lastSeenAt).toBe("2025-12-01T00:00:00.000Z");
    expect(merged[0].tendersCount).toBe(3);
    expect(merged[0].organisationName).toBe("Department of Water Affairs");
    expect(merged[0].saved).toBe(true);
  });

  it("appends local-only rows alphabetically with server fields absent", () => {
    const merged = mergeOfficerRows(
      [
        localRow({ id: "b", canonical_name: "Nomsa Dlamini" }),
        localRow({ id: "a", canonical_name: "Anele Khumalo" }),
      ],
      [],
      new Set(),
      "dlamini",
      {},
    );
    expect(merged.map((r) => r.canonicalName)).toEqual([
      "Anele Khumalo",
      "Nomsa Dlamini",
    ]);
    expect(merged[1].organisationName).toBeNull();
    expect(merged[1].tendersCount).toBe(0);
  });

  it("leads an exact-name match ahead of its local-only peers", () => {
    const merged = mergeOfficerRows(
      [
        localRow({ id: "b", canonical_name: "Thabo Mokoena" }),
        localRow({ id: "a", canonical_name: "Thabo Mokoena Jr" }),
      ],
      [],
      new Set(),
      "thabo mokoena",
      {},
    );
    expect(merged.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("post-filters server rows by kind and status when those filters are set", async () => {
    vi.useFakeTimers();
    const db = new FakeSqlExecutor();
    db.selectResults = [[], [], []];
    const feed = new FakeFeed();
    feed.pages = [
      searchResult([]), // filter-only run before the debounce settles
      searchResult([
        serverRow({ id: "o1", kind: "officer", status: "verified" }),
        serverRow({ id: "o2", kind: "department", status: "verified" }),
      ]),
    ];

    const { result } = renderHook(() => useOfficerSearch(feed, db, owner));
    await act(async () => {});
    act(() => result.current.setQuery("water"));
    act(() => result.current.setFilters({ kind: "officer" }));
    await advanceDebounce();

const finalCall = feed.calls[feed.calls.length - 1];
    expect(finalCall.q).toBe("water");
    expect(result.current.results.map((r) => r.id)).toEqual(["o1"]);
  });

  it("suspends the local pass when a server-only filter (organisation) is set", async () => {
    vi.useFakeTimers();
    const db = new FakeSqlExecutor();
    db.selectResults = [[], []]; // saved ids + recent pref only, no local pass
    const feed = new FakeFeed();
    feed.pages = [searchResult([]), searchResult([serverRow()])];

    const { result } = renderHook(() => useOfficerSearch(feed, db, owner));
    await act(async () => {});
    act(() => result.current.setQuery("moko"));
    act(() => result.current.setFilters({ organisation: "Water" }));
    await advanceDebounce();

    const finalCall = feed.calls[feed.calls.length - 1];
    expect(finalCall.organisation).toBe("Water");
    const localSelect = db.calls.filter((c) => c.sql.includes("FROM procurement_officers_fts"));
    expect(localSelect).toHaveLength(0);
    expect(result.current.results).toHaveLength(1);
  });

  it("discards stale server responses when a newer query wins (coalesced)", async () => {
    vi.useFakeTimers();
    const db = new FakeSqlExecutor();
    db.selectResults = [[], [], [], [], []];
    let resolveFirst: (value: OfficerSearchResult) => void = () => {};
    const feed = new FakeFeed();
    feed.search = vi.fn(async (query) => {
      if (query.q === "old") {
        return new Promise<OfficerSearchResult>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return searchResult([serverRow()]);
    });

    const { result } = renderHook(() => useOfficerSearch(feed, db, owner));
    await act(async () => {});
    act(() => result.current.setQuery("old"));
    await advanceDebounce();
    act(() => result.current.setQuery("new"));
    await advanceDebounce();

    await act(async () => {
      resolveFirst(searchResult([serverRow({ id: "stale", canonicalName: "Old Result" })]));
    });

    expect(result.current.results.map((r) => r.id)).toEqual(["officer-1"]);
  });

  it("records recent searches once, newest first, capped and persisted", async () => {
    vi.useFakeTimers();
    const db = new FakeSqlExecutor();
    db.selectResults = [[], [], []];
    const feed = new FakeFeed();

    const { result } = renderHook(() => useOfficerSearch(feed, db, owner));
    await act(async () => {});
    act(() => result.current.setQuery("moko"));
    await advanceDebounce();
    act(() => result.current.setQuery("moko"));
    await advanceDebounce();
    act(() => result.current.setQuery("dlamini"));
    await advanceDebounce();

    const persists = db.calls.filter((c) => c.sql.includes("INSERT INTO local_preferences"));
    const persist = persists[persists.length - 1];
    expect(persist?.params[1]).toBe("officerRecentSearches");
    expect(JSON.parse(persist?.params[2] as string)).toEqual(["dlamini", "moko"]);
  });

  it("shows the error phase when the server refresh fails and local rows exist", async () => {
    vi.useFakeTimers();
    const db = new FakeSqlExecutor();
    db.selectResults = [[], [], [localRow()]];
    const feed = new FakeFeed();
    feed.pages = [new Error("boom")];

    const { result } = renderHook(() => useOfficerSearch(feed, db, owner));
    await act(async () => {});
    act(() => result.current.setQuery("moko"));
    await advanceDebounce();

    expect(result.current.phase).toBe("error");
    expect(result.current.results).toHaveLength(1); // local rows still shown
  });
});

describe("mergeOfficerRows guard rails", () => {
  it("survives a same-id row appearing only on the server", () => {
    const merged = mergeOfficerRows([], [serverRow()], new Set(), "moko", {});
    expect(merged).toHaveLength(1);
    expect(merged[0].lastSeenAt).toBeNull();
    expect(merged[0].saved).toBe(false);
  });
});


