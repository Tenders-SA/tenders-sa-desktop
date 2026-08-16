import { describe, expect, it } from "vitest";
import { FakeSqlExecutor } from "./fakes/sql-executor";
import {
  applyTombstone,
  buildSearchText,
  getOfficer,
  getOfficerNote,
  getOfficerTenders,
  getOfficerAssignments,
  getSyncState,
  isOfficerSaved,
  listSavedOfficers,
  saveOfficer,
  searchOfficers,
  setOfficerNote,
  setSyncState,
  unsaveOfficer,
  upsertOfficer,
  type OfficerIngest,
} from "../db/repositories/procurement-officers";
import type { ProcurementOfficerRow } from "../db/schema/types";

const owner = `v1-${"a".repeat(64)}`;

function officerIngest(overrides: Partial<OfficerIngest> = {}): OfficerIngest {
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
    tenderLinks: [{ tenderId: "t-100", sourceField: "contact_person", observedAt: "2025-05-01" }],
    ...overrides,
  };
}

describe("upsertOfficer", () => {
  it("rebuilds the officer's full footprint delete-then-insert, fully parameterized", async () => {
    const db = new FakeSqlExecutor();
    await upsertOfficer(db, owner, officerIngest());

    const officerInsert = db.calls[1];
    expect(db.calls[0].sql).toContain("DELETE FROM procurement_officers_fts");
    expect(db.calls[0].params).toEqual([owner, "officer-1"]);
    expect(officerInsert.sql).toContain("INSERT INTO procurement_officers");
    expect(officerInsert.sql).not.toContain("Mokoena");
    expect(officerInsert.params[0]).toBe(owner);
    expect(officerInsert.params[1]).toBe("officer-1");
    expect(officerInsert.params[2]).toBe("Thabo Mokoena");
    expect(officerInsert.params[14]).toBe(0);

    const pointDelete = db.calls[2];
    const pointInsert = db.calls[3];
    expect(pointDelete.sql).toContain("DELETE FROM officer_contact_points");
    expect(pointDelete.params).toEqual([owner, "officer-1"]);
    expect(pointInsert.sql).toContain("INSERT INTO officer_contact_points");
    expect(pointInsert.params).toEqual([
      owner,
      "officer-1",
      "cp-1",
      "email",
      "thabo.mokoena@dwa.gov.za",
      0,
      1,
      "verified",
    ]);

    const assignmentInsert = db.calls[5];
    expect(assignmentInsert.sql).toContain("INSERT INTO officer_assignments");
    expect(assignmentInsert.params[8]).toBe(1);

    const linkDelete = db.calls[6];
    const linkInsert = db.calls[7];
    expect(linkDelete.sql).toContain("DELETE FROM officer_tender_links");
    expect(linkInsert.params).toEqual([
      owner,
      "officer-1",
      "t-100",
      "contact_person",
      "2025-05-01",
    ]);

    const ftsInsert = db.calls[8];
    expect(ftsInsert.sql).toContain("INSERT INTO procurement_officers_fts");
    expect(ftsInsert.params[0]).toBe(owner);
    expect(ftsInsert.params[1]).toBe("officer-1");
    expect(String(ftsInsert.params[2])).toContain("Thabo Mokoena");
    expect(String(ftsInsert.params[2])).toContain("Department of Water Affairs");
    expect(String(ftsInsert.params[2])).toContain("thabo.mokoena@dwa.gov.za");

    expect(db.calls).toHaveLength(9);
  });

  it("skips empty collections without emitting insert statements", async () => {
    const db = new FakeSqlExecutor();
    await upsertOfficer(db, owner, officerIngest({ contactPoints: [], assignments: [], tenderLinks: [] }));
    expect(db.calls).toHaveLength(6);
    for (const call of db.calls) {
      expect(call.sql).not.toContain("INSERT INTO officer_contact_points");
      expect(call.sql).not.toContain("INSERT INTO officer_assignments");
      expect(call.sql).not.toContain("INSERT INTO officer_tender_links");
    }
  });

  it("preserves suppression state from the feed row", async () => {
    const db = new FakeSqlExecutor();
    await upsertOfficer(db, owner, officerIngest({ suppressed: true }));
    expect(db.calls[1].params[14]).toBe(1);
  });
});

describe("applyTombstone", () => {
  it("removes the officer from every local table, owner-scoped", async () => {
    const db = new FakeSqlExecutor();
    await applyTombstone(db, owner, "officer-1");

    const deletes = db.calls.map((c) => c.sql);
    expect(deletes).toHaveLength(5);
    expect(deletes[0]).toContain("DELETE FROM procurement_officers_fts");
    expect(deletes[1]).toContain("DELETE FROM procurement_officers");
    expect(deletes[2]).toContain("DELETE FROM officer_contact_points");
    expect(deletes[3]).toContain("DELETE FROM officer_assignments");
    expect(deletes[4]).toContain("DELETE FROM officer_tender_links");
    for (const call of db.calls) {
      expect(call.params).toEqual([owner, "officer-1"]);
    }
  });
});

describe("searchOfficers", () => {
  const rows: ProcurementOfficerRow[] = [
    {
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
    },
  ];

  it("runs an FTS5 MATCH with owner scoping and relevance ordering", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [rows];
    const result = await searchOfficers(db, owner, { q: "Mokoena" });

    expect(result).toEqual(rows);
    expect(db.calls).toHaveLength(1);
    const { sql, params } = db.calls[0];
    expect(sql).toContain("procurement_officers_fts MATCH $2");
    expect(sql).toContain("JOIN procurement_officers");
    expect(sql).toContain("ORDER BY rank");
    expect(sql).toContain("LIMIT $3");
    expect(params).toEqual([owner, "Mokoena", 20]);
  });

  it("appends equality filters as bound parameters in order", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [rows];
    await searchOfficers(db, owner, { q: "Mokoena", province: "Gauteng", kind: "officer", status: "verified" });

    const { sql, params } = db.calls[0];
    expect(sql).toContain("province = $3");
    expect(sql).toContain("kind = $4");
    expect(sql).toContain("status = $5");
    expect(params).toEqual([owner, "Mokoena", "Gauteng", "officer", "verified", 20]);
  });

  it("clamps the limit to the 1..50 contract window", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[]];
    await searchOfficers(db, owner, { q: "x", limit: 500 });
    expect(db.calls[0].params[2]).toBe(50);
    const db2 = new FakeSqlExecutor();
    db2.selectResults = [[]];
    await searchOfficers(db2, owner, { q: "x", limit: 0 });
    expect(db2.calls[0].params[2]).toBe(1);
  });

  it("degrades to a plain owner-scoped listing when q is empty", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [rows];
    const result = await searchOfficers(db, owner, { province: "Gauteng" });

    expect(result).toEqual(rows);
    const { sql, params } = db.calls[0];
    expect(sql).not.toContain("MATCH");
    expect(sql).toContain("ORDER BY canonical_name ASC");
    expect(params).toEqual([owner, "Gauteng", 20]);
  });
});

describe("getOfficer", () => {
  it("assembles the officer with contacts and assignments", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [
      [{ id: "officer-1", owner_id: owner } as ProcurementOfficerRow],
      [{ id: "cp-1", officer_id: "officer-1" }],
      [{ id: "asg-1", officer_id: "officer-1" }],
    ];

    const result = await getOfficer(db, owner, "officer-1");
    expect(result?.officer.id).toBe("officer-1");
    expect(result?.contactPoints).toHaveLength(1);
    expect(result?.assignments).toHaveLength(1);
    expect(db.calls[0].params).toEqual([owner, "officer-1"]);
    expect(db.calls[1].params).toEqual([owner, "officer-1"]);
  });

  it("returns undefined when the officer is absent", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[], [], []];
    expect(await getOfficer(db, owner, "missing")).toBeUndefined();
  });

  it("orders assignments current-first", async () => {
    const db = new FakeSqlExecutor();
    await getOfficerAssignments(db, owner, "officer-1");
    expect(db.calls[0].sql).toContain("ORDER BY is_current DESC, valid_from DESC");
  });
});

describe("getOfficerTenders", () => {
  it("returns links newest-observed first", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[{ tender_id: "t-100" }]];
    const result = await getOfficerTenders(db, owner, "officer-1");
    expect(result).toEqual([{ tender_id: "t-100" }]);
    expect(db.calls[0].sql).toContain("ORDER BY observed_at DESC");
  });
});

describe("saved officers and notes", () => {
  it("saves without erroring on duplicates and lists newest-first", async () => {
    const db = new FakeSqlExecutor();
    await saveOfficer(db, owner, "officer-1", "2026-01-01T00:00:00.000Z");
    expect(db.calls[0].sql).toContain("ON CONFLICT(owner_id, officer_id) DO NOTHING");
    expect(db.calls[0].params).toEqual([owner, "officer-1", "2026-01-01T00:00:00.000Z"]);

    const listDb = new FakeSqlExecutor();
    listDb.selectResults = [[{ officer_id: "officer-1", saved_at: "2026-01-01T00:00:00.000Z" }]];
    expect(await listSavedOfficers(listDb, owner)).toHaveLength(1);

    const savedDb = new FakeSqlExecutor();
    savedDb.selectResults = [[{ officer_id: "officer-1" }]];
    expect(await isOfficerSaved(savedDb, owner, "officer-1")).toBe(true);

    const notSavedDb = new FakeSqlExecutor();
    notSavedDb.selectResults = [[]];
    expect(await isOfficerSaved(notSavedDb, owner, "other")).toBe(false);

    await unsaveOfficer(db, owner, "officer-1");
    expect(db.calls[1].params).toEqual([owner, "officer-1"]);
  });

  it("upserts notes and reads them back or null", async () => {
    const db = new FakeSqlExecutor();
    await setOfficerNote(db, owner, "officer-1", "Confirmed at CPAR", "2026-01-01T00:00:00.000Z");
    expect(db.calls[0].sql).toContain("ON CONFLICT(owner_id, officer_id) DO UPDATE SET note = excluded.note");

    const readDb = new FakeSqlExecutor();
    readDb.selectResults = [[{ note: "Confirmed at CPAR" }]];
    expect(await getOfficerNote(readDb, owner, "officer-1")).toBe("Confirmed at CPAR");

    const missingDb = new FakeSqlExecutor();
    missingDb.selectResults = [[]];
    expect(await getOfficerNote(missingDb, owner, "missing")).toBeNull();
  });
});

describe("sync state", () => {
  it("reads undefined for a fresh account and upserts the singleton", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[]];
    expect(await getSyncState(db, owner)).toBeUndefined();
    expect(db.calls[0].params).toEqual([owner]);

    await setSyncState(db, owner, "cursor-2", "2026-01-01T00:00:00.000Z");
    const { sql, params } = db.calls[1];
    expect(sql).toContain("ON CONFLICT(owner_id) DO UPDATE SET cursor = excluded.cursor");
    expect(params).toEqual([owner, "cursor-2", "2026-01-01T00:00:00.000Z"]);

    const readDb = new FakeSqlExecutor();
    readDb.selectResults = [[{ owner_id: owner, cursor: "cursor-2", last_sync_at: "2026-01-01T00:00:00.000Z" }]];
    expect((await getSyncState(readDb, owner))?.cursor).toBe("cursor-2");
  });

  it("persists null cursors when the feed runs dry", async () => {
    const db = new FakeSqlExecutor();
    await setSyncState(db, owner, null);
    expect(db.calls[0].params[1]).toBeNull();
  });
});

describe("buildSearchText", () => {
  it("joins name, organisation, title, province and contact values", () => {
    const text = buildSearchText(officerIngest());
    expect(text).toBe(
      "Thabo Mokoena | Supply Chain Manager | Gauteng | Department of Water Affairs | Supply Chain Manager | thabo.mokoena@dwa.gov.za | t-100",
    );
  });

  it("drops nulls and empties", () => {
    const text = buildSearchText(
      officerIngest({
        canonicalName: "Nomsa Dlamini",
        currentTitle: null,
        province: null,
        assignments: [],
        contactPoints: [],
        tenderLinks: [],
      }),
    );
    expect(text).toBe("Nomsa Dlamini");
  });
});