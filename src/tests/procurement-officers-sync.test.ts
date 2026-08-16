import { describe, expect, it } from "vitest";
import { FakeSqlExecutor } from "./fakes/sql-executor";
import { OfficerSyncRunner, toOfficerIngest, type OfficerSyncFeed } from "../services/sync/procurement-officers-sync";
import { ApiError } from "../services/api/errors";
import type { OfficerSyncQuery, OfficerSyncResult, OfficerSyncRow } from "../services/api/endpoints/procurement-officers";

const owner = `v1-${"b".repeat(64)}`;

function syncRow(overrides: Partial<OfficerSyncRow> = {}): OfficerSyncRow {
  return {
    id: "officer-1",
    canonicalName: "Thabo Mokoena",
    firstName: "Thabo",
    lastName: "Mokoena",
    currentTitle: "Supply Chain Manager",
    currentOrganisationId: "org-9",
    province: "Gauteng",
    kind: "officer",
    status: "verified",
    confidenceScore: 0.95,
    firstSeenAt: "2025-01-01T00:00:00.000Z",
    lastSeenAt: "2025-06-01T00:00:00.000Z",
    verifiedAt: "2025-03-01T00:00:00.000Z",
    suppressed: false,
    updatedAt: "2025-06-01T00:00:00.000Z",
    contactPoints: [
      {
        id: "cp-1",
        type: "email",
        value: "thabo.mokoena@dwa.gov.za",
        isRoleBased: false,
        isOfficial: true,
        verificationStatus: "verified",
      },
    ],
    assignments: [
      {
        id: "asg-1",
        organisationId: "org-9",
        organisationName: "Department of Water Affairs",
        title: "Supply Chain Manager",
        validFrom: "2024-01-01",
        validTo: null,
        isCurrent: true,
        confidenceScore: 0.9,
      },
    ],
    ...overrides,
  };
}

function page(rows: OfficerSyncRow[], nextCursor: string | null, hasMore: boolean): OfficerSyncResult {
  return {
    rows,
    nextCursor,
    hasMore,
    meta: { page: 1, limit: 200, total: rows.length },
  };
}

class FakeFeed implements OfficerSyncFeed {
  calls: Array<{ cursor?: string; limit?: number }> = [];
  pages: Array<OfficerSyncResult | ApiError> = [];
  private cursorUsed = new Set<string>();

  async sync(query: OfficerSyncQuery): Promise<OfficerSyncResult> {
    this.calls.push(query);
    this.cursorUsed.add(query.cursor ?? "<none>");
    const next = this.pages.shift();
    if (next instanceof ApiError) throw next;
    return next!;
  }
}

function rowInsertCalls(db: FakeSqlExecutor): number {
  return db.calls.filter((c) => /INSERT INTO procurement_officers\s/.test(c.sql)).length;
}

describe("OfficerSyncRunner", () => {
  it("resumes from the persisted cursor and pages until hasMore is false", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[{ owner_id: owner, cursor: "cursor-1", last_sync_at: "2025-05-01T00:00:00.000Z" }]];
    const feed = new FakeFeed();
    feed.pages = [
      page([syncRow()], "cursor-2", true),
      page([syncRow({ id: "officer-2", canonicalName: "Nomsa Dlamini" })], null, false),
    ];

    const runner = new OfficerSyncRunner({ feed, executor: db, ownerId: owner, now: () => "2025-06-01T00:00:00.000Z" });
    const outcome = await runner.sync();

    expect(outcome).toEqual({ featureState: "active", appliedRows: 2, tombstones: 0, pages: 2 });
    expect(feed.calls).toEqual([{ cursor: "cursor-1", limit: 200 }, { cursor: "cursor-2", limit: 200 }]);

    const stateWrites = db.calls.filter((c) => c.sql.includes("INSERT INTO procurement_officer_sync_state"));
    expect(stateWrites[0].params).toEqual([owner, "cursor-2", "2025-06-01T00:00:00.000Z"]);
    expect(stateWrites[1].params).toEqual([owner, null, "2025-06-01T00:00:00.000Z"]);
    expect(rowInsertCalls(db)).toBe(2);
  });

  it("starts without a cursor on a fresh account", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[]];
    const feed = new FakeFeed();
    feed.pages = [page([], null, false)];

    await new OfficerSyncRunner({ feed, executor: db, ownerId: owner }).sync();
    expect(feed.calls[0].cursor).toBeUndefined();
  });

  it("drops tombstone rows via applyTombstone and never re-inserts them", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[]];
    const feed = new FakeFeed();
    feed.pages = [page([syncRow({ suppressed: true, contactPoints: [], assignments: [] })], null, false)];

    const outcome = await new OfficerSyncRunner({ feed, executor: db, ownerId: owner }).sync();

    expect(outcome.tombstones).toBe(1);
    expect(outcome.appliedRows).toBe(0);
    const officersDeletes = db.calls.filter((c) => c.sql.includes("DELETE FROM procurement_officers WHERE"));
    expect(officersDeletes).toHaveLength(1);
    expect(officersDeletes[0].params).toEqual([owner, "officer-1"]);
    expect(rowInsertCalls(db)).toBe(0);
  });

  it("marks the feature off on a 404 and writes nothing", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[]];
    const feed = new FakeFeed();
    feed.pages = [new ApiError({ kind: "not-found", status: 404, message: "Not found" })];

    const outcome = await new OfficerSyncRunner({ feed, executor: db, ownerId: owner }).sync();

    expect(outcome).toEqual({ featureState: "off", appliedRows: 0, tombstones: 0, pages: 0 });
    expect(db.calls).toHaveLength(1); // only the initial sync-state read
  });

  it("marks entitlement-missing on a 403 and keeps the last good index read-only", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[]];
    const feed = new FakeFeed();
    feed.pages = [
      page([syncRow()], "cursor-2", true),
      new ApiError({ kind: "forbidden", status: 403, message: "Forbidden" }),
    ];

    const outcome = await new OfficerSyncRunner({ feed, executor: db, ownerId: owner, now: () => "2025-06-01T00:00:00.000Z" }).sync();

    expect(outcome).toEqual({ featureState: "entitlement-missing", appliedRows: 1, tombstones: 0, pages: 1 });
    const stateWrites = db.calls.filter((c) => c.sql.includes("INSERT INTO procurement_officer_sync_state"));
    expect(stateWrites).toHaveLength(1);
    expect(stateWrites[0].params).toEqual([owner, "cursor-2", "2025-06-01T00:00:00.000Z"]);
  });

  it("surfaces transient failures with featureState active and the pages already applied", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[]];
    const feed = new FakeFeed();
    feed.pages = [
      page([syncRow()], "cursor-2", true),
      new ApiError({ kind: "server", status: 503, message: "Unavailable" }),
    ];

    const outcome = await new OfficerSyncRunner({ feed, executor: db, ownerId: owner }).sync();

    expect(outcome.featureState).toBe("active");
    expect(outcome.error?.kind).toBe("server");
    expect(outcome.appliedRows).toBe(1);
    expect(outcome.pages).toBe(1);
  });

  it("never runs overlapping syncs", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[]];
    const feed = new FakeFeed();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    feed.pages = [page([], null, false)];
    const originalSync = feed.sync.bind(feed);
    feed.sync = async (query) => {
      await gate;
      return originalSync(query);
    };

    const runner = new OfficerSyncRunner({ feed, executor: db, ownerId: owner });
    const first = runner.sync();
    const second = runner.sync();
    release();
    const [a, b] = await Promise.all([first, second]);

    expect(a).toEqual(b);
    expect(feed.calls).toHaveLength(1);
  });

  it("shares one in-flight run even when a later call happens mid-loop", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[]];
    const feed = new FakeFeed();
    feed.pages = [page([syncRow()], null, false)];

    const runner = new OfficerSyncRunner({ feed, executor: db, ownerId: owner });
    const [a, b] = await Promise.all([runner.sync(), runner.sync()]);
    expect(a).toEqual(b);
    expect(feed.calls).toHaveLength(1);
  });
});

describe("toOfficerIngest", () => {
  it("maps feed rows onto the repository ingest with no tender links", () => {
    const ingest = toOfficerIngest(syncRow());
    expect(ingest.id).toBe("officer-1");
    expect(ingest.contactPoints[0].value).toBe("thabo.mokoena@dwa.gov.za");
    expect(ingest.assignments[0].isCurrent).toBe(true);
    expect(ingest.tenderLinks).toEqual([]);
    expect(ingest.suppressed).toBe(false);
  });
});