import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { FakeSqlExecutor } from "./fakes/sql-executor";
import { ApiError } from "../services/api/errors";
import { assertWorkspaceOwner } from "../services/storage/workspace-owner";
import {
  mergeOfficerDetail,
  orderAssignments,
  useOfficerDetail,
  type OfficerDetailFeed,
} from "../features/procurement-officers/use-officer-detail";
import type {
  OfficerAssignmentRow,
  OfficerContactPointRow,
  OfficerTenderLinkRow,
  ProcurementOfficerRow,
} from "../db/schema/types";
import type {
  OfficerDetail,
  OfficerTenderRow,
  OfficerTendersResult,
} from "../services/api/endpoints/procurement-officers";

const owner = assertWorkspaceOwner(`v1-${"e".repeat(64)}`);

function officerRow(
  overrides: Partial<ProcurementOfficerRow> = {},
): ProcurementOfficerRow {
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

function contactRow(
  overrides: Partial<OfficerContactPointRow> = {},
): OfficerContactPointRow {
  return {
    owner_id: owner,
    officer_id: "officer-1",
    id: "cp-1",
    type: "email",
    value: "thabo@dwa.gov.za",
    is_role_based: 0,
    is_official: 1,
    verification_status: "verified",
    ...overrides,
  };
}

function assignmentRow(
  overrides: Partial<OfficerAssignmentRow> = {},
): OfficerAssignmentRow {
  return {
    owner_id: owner,
    officer_id: "officer-1",
    id: "a-1",
    organisation_id: "org-9",
    organisation_name: "Department of Water Affairs",
    title: "Supply Chain Manager",
    valid_from: "2024-01-01T00:00:00.000Z",
    valid_to: null,
    is_current: 1,
    confidence_score: 0.9,
    ...overrides,
  };
}

function tenderLinkRow(
  overrides: Partial<OfficerTenderLinkRow> = {},
): OfficerTenderLinkRow {
  return {
    owner_id: owner,
    officer_id: "officer-1",
    tender_id: "t-1",
    source_field: "signature",
    observed_at: "2025-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function serverDetail(overrides: Partial<OfficerDetail> = {}): OfficerDetail {
  return {
    id: "officer-1",
    canonicalName: "Thabo Mokoena",
    firstName: "Thabo",
    lastName: "Mokoena",
    currentTitle: "Supply Chain Manager",
    currentOrganisationId: "org-9",
    organisationName: "Department of Water Affairs",
    organisationAddress: "Private Bag X313, Pretoria",
    province: "Gauteng",
    kind: "officer",
    status: "verified",
    confidenceScore: 0.95,
    firstSeenAt: "2025-01-01T00:00:00.000Z",
    lastSeenAt: "2025-06-01T00:00:00.000Z",
    verifiedAt: "2025-03-01T00:00:00.000Z",
    tendersCount: 2,
    contactPoints: [
      {
        id: "cp-s1",
        type: "email",
        value: "th***@dwa.gov.za",
        isRoleBased: false,
        isOfficial: true,
        verificationStatus: "verified",
      },
    ],
    assignments: [],
    evidenceSummary: {
      sourceMethods: ["tender-signature"],
      sourceFieldCount: 4,
      observedRange: {
        earliest: "2025-01-01T00:00:00.000Z",
        latest: "2025-06-01T00:00:00.000Z",
      },
    },
    ...overrides,
  };
}

function serverTenderRow(
  overrides: Partial<OfficerTenderRow> = {},
): OfficerTenderRow {
  return {
    id: "t-1",
    tenderId: "t-1",
    title: "Water infrastructure maintenance",
    referenceNumber: "DWA/2025/01",
    province: "Gauteng",
    closingDate: "2025-12-01T12:00:00.000Z",
    sourceUrl: "https://etenders.gov.za/notice/t-1",
    ...overrides,
  };
}

class FakeDetailFeed implements OfficerDetailFeed {
  getCalls: string[] = [];
  detailPages: Array<OfficerDetail | Error> = [];
  tenderPages: Array<OfficerTendersResult | Error> = [];
  async get(id: string) {
    this.getCalls.push(id);
    const next = this.detailPages.shift();
    if (next instanceof Error) throw next;
    return next ?? serverDetail();
  }
  async getTenders(): Promise<OfficerTendersResult> {
    const next = this.tenderPages.shift();
    if (next instanceof Error) throw next;
    return next ?? { tenders: [], page: 1, limit: 20, total: 0 };
  }
}

function seedLocal(
  db: FakeSqlExecutor,
  options: {
    officer?: ProcurementOfficerRow;
    contacts?: OfficerContactPointRow[];
    assignments?: OfficerAssignmentRow[];
    tenders?: OfficerTenderLinkRow[];
    saved?: Array<{ officer_id: string }>;
    note?: Array<{ note: string }>;
  },
) {
  db.selectResults = [
    options.officer ? [options.officer] : [],
    options.contacts ?? [],
    options.assignments ?? [],
    options.tenders ?? [],
    options.saved ?? [],
    options.note ?? [],
  ];
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useOfficerDetail", () => {
  it("loads the local record and refreshes organisation + tenders from the server", async () => {
    const db = new FakeSqlExecutor();
    seedLocal(db, {
      officer: officerRow(),
      contacts: [contactRow()],
      assignments: [assignmentRow()],
    });
    const feed = new FakeDetailFeed();
    feed.detailPages = [serverDetail()];
    feed.tenderPages = [
      { tenders: [serverTenderRow()], page: 1, limit: 20, total: 1 },
    ];

    const { result } = renderHook(() =>
      useOfficerDetail(feed, db, owner, "officer-1"),
    );

    await waitFor(() => expect(result.current.phase).toBe("idle"));
    expect(result.current.data?.organisationAddress).toBe(
      "Private Bag X313, Pretoria",
    );
    expect(result.current.data?.organisationName).toBe(
      "Department of Water Affairs",
    );
    expect(result.current.data?.contactPoints[0]).toMatchObject({
      value: "thabo@dwa.gov.za",
      masked: false,
    });
    expect(result.current.data?.tenders[0]).toMatchObject({
      tenderId: "t-1",
      title: "Water infrastructure maintenance",
    });
    expect(result.current.data?.evidenceSummary?.sourceFieldCount).toBe(4);
  });

  it("headlines the current assignment and never a stale one", async () => {
    const db = new FakeSqlExecutor();
    seedLocal(db, {
      officer: officerRow(),
      assignments: [
        assignmentRow({
          id: "a-stale",
          title: "Former role",
          valid_from: "2024-06-01T00:00:00.000Z",
          is_current: 0,
        }),
        assignmentRow({
          id: "a-current",
          title: "Supply Chain Manager",
          valid_from: "2023-01-01T00:00:00.000Z",
          is_current: 1,
        }),
      ],
    });
    const feed = new FakeDetailFeed();
    feed.detailPages = [
      new ApiError({ kind: "server", status: 500, message: "down" }),
    ];
    feed.tenderPages = [
      new ApiError({ kind: "server", status: 500, message: "down" }),
    ];

    const { result } = renderHook(() =>
      useOfficerDetail(feed, db, owner, "officer-1"),
    );

    await waitFor(() =>
      expect(result.current.data?.headlineAssignment?.id).toBe("a-current"),
    );
    // Stale roles with a later valid_from must not win the headline slot.
    expect(result.current.data?.assignments.map((a) => a.id)).toEqual([
      "a-current",
      "a-stale",
    ]);
  });

  it("orders non-current assignments by most recent valid_from", () => {
    const ordered = orderAssignments([
      {
        id: "old",
        organisationId: null,
        organisationName: null,
        title: null,
        validFrom: "2020-01-01T00:00:00.000Z",
        validTo: null,
        isCurrent: false,
        confidenceScore: null,
      },
      {
        id: "new",
        organisationId: null,
        organisationName: null,
        title: null,
        validFrom: "2024-01-01T00:00:00.000Z",
        validTo: null,
        isCurrent: false,
        confidenceScore: null,
      },
    ]);
    expect(ordered.map((a) => a.id)).toEqual(["new", "old"]);
  });

  it("falls back to masked server contacts when the local index has none", async () => {
    const db = new FakeSqlExecutor();
    seedLocal(db, { officer: officerRow() });
    const feed = new FakeDetailFeed();
    feed.detailPages = [serverDetail()];

    const { result } = renderHook(() =>
      useOfficerDetail(feed, db, owner, "officer-1"),
    );

    await waitFor(() => expect(result.current.phase).toBe("idle"));
    expect(result.current.data?.contactPoints[0]).toMatchObject({
      value: "th***@dwa.gov.za",
      masked: true,
    });
  });

  it("keeps the local record when the server refresh fails", async () => {
    const db = new FakeSqlExecutor();
    seedLocal(db, { officer: officerRow(), assignments: [assignmentRow()] });
    const feed = new FakeDetailFeed();
    feed.detailPages = [
      new ApiError({ kind: "server", status: 500, message: "down" }),
    ];
    feed.tenderPages = [
      new ApiError({ kind: "server", status: 500, message: "down" }),
    ];

    const { result } = renderHook(() =>
      useOfficerDetail(feed, db, owner, "officer-1"),
    );

    await waitFor(() => expect(result.current.phase).toBe("error"));
    expect(result.current.data?.canonicalName).toBe("Thabo Mokoena");
    expect(result.current.data?.headlineAssignment?.id).toBe("a-1");
  });

  it("uses local tender links when the server tender list is unavailable", async () => {
    const db = new FakeSqlExecutor();
    seedLocal(db, { officer: officerRow(), tenders: [tenderLinkRow()] });
    const feed = new FakeDetailFeed();
    feed.tenderPages = [
      new ApiError({ kind: "server", status: 500, message: "down" }),
    ];

    const { result } = renderHook(() =>
      useOfficerDetail(feed, db, owner, "officer-1"),
    );

    await waitFor(() =>
      expect(result.current.data?.tenders[0]?.tenderId).toBe("t-1"),
    );
    expect(result.current.data?.tenders[0]?.title).toBeNull();
  });

  it("toggles the saved state", async () => {
    const db = new FakeSqlExecutor();
    seedLocal(db, { officer: officerRow(), saved: [] });
    const feed = new FakeDetailFeed();

    const { result } = renderHook(() =>
      useOfficerDetail(feed, db, owner, "officer-1"),
    );
    await waitFor(() => expect(result.current.phase).toBe("idle"));

    await act(async () => {
      await result.current.toggleSaved();
    });
    expect(result.current.saved).toBe(true);
    const insert = db.calls.find((c) =>
      c.sql.includes("INSERT INTO saved_officers"),
    );
    expect(insert?.params[1]).toBe("officer-1");

    await act(async () => {
      await result.current.toggleSaved();
    });
    expect(result.current.saved).toBe(false);
    expect(
      db.calls.some((c) => c.sql.includes("DELETE FROM saved_officers")),
    ).toBe(true);
  });

  it("persists notes via the officer_notes upsert", async () => {
    const db = new FakeSqlExecutor();
    seedLocal(db, { officer: officerRow() });
    const feed = new FakeDetailFeed();

    const { result } = renderHook(() =>
      useOfficerDetail(feed, db, owner, "officer-1"),
    );
    await waitFor(() => expect(result.current.phase).toBe("idle"));

    await act(async () => {
      await result.current.saveNote("Prefers email, no calls before 9am.");
    });
    expect(result.current.note).toBe("Prefers email, no calls before 9am.");
    const upsert = db.calls.find((c) =>
      c.sql.includes("INSERT INTO officer_notes"),
    );
    expect(upsert?.params[2]).toBe("Prefers email, no calls before 9am.");
  });

  it("copies values through the clipboard and reports failure honestly", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const db = new FakeSqlExecutor();
    seedLocal(db, { officer: officerRow() });
    const feed = new FakeDetailFeed();

    const { result } = renderHook(() =>
      useOfficerDetail(feed, db, owner, "officer-1"),
    );
    await waitFor(() => expect(result.current.phase).toBe("idle"));

    expect(await result.current.copyValue("thabo@dwa.gov.za")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("thabo@dwa.gov.za");

    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    expect(await result.current.copyValue("0123456789")).toBe(false);
  });

  it("resolves the organisation link only for the user's own company", async () => {
    const db = new FakeSqlExecutor();
    seedLocal(db, { officer: officerRow(), assignments: [assignmentRow()] });
    const feed = new FakeDetailFeed();

    const { result } = renderHook(() =>
      useOfficerDetail(feed, db, owner, "officer-1", "org-9"),
    );
    await waitFor(() => expect(result.current.phase).toBe("idle"));
    expect(result.current.organisationLink).toBe("/company");

    const { result: other } = renderHook(() =>
      useOfficerDetail(feed, db, owner, "officer-1", "org-other"),
    );
    await waitFor(() => expect(other.current.phase).toBe("idle"));
    expect(other.current.organisationLink).toBeNull();
  });
});

describe("mergeOfficerDetail guard rails", () => {
  it("keeps local contact values when both sources carry the same contact", () => {
    const merged = mergeOfficerDetail(
      officerRow(),
      [contactRow()],
      [assignmentRow()],
      [],
      serverDetail({
        contactPoints: [
          {
            id: "cp-s1",
            type: "email",
            value: "th***@dwa.gov.za",
            isRoleBased: false,
            isOfficial: true,
            verificationStatus: "verified",
          },
        ],
      }),
      [],
    );
    expect(merged.contactPoints[0].value).toBe("thabo@dwa.gov.za");
    expect(merged.contactPoints[0].masked).toBe(false);
  });
});
