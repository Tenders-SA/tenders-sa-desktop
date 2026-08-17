import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeSqlExecutor } from "./fakes/sql-executor";
import { ApiError } from "../services/api/errors";
import { OfficerSyncRunner, type OfficerSyncFeed } from "../services/sync/procurement-officers-sync";
import { ProcurementOfficerDirectory } from "../features/procurement-officers/ProcurementOfficerDirectory";
import { resetOfficerSyncRunnersForTesting } from "../features/procurement-officers/use-officer-sync";
import { getOfficerSyncRunner } from "../features/procurement-officers/use-officer-sync";
import { assertWorkspaceOwner } from "../services/storage/workspace-owner";
import type { OfficerSearchFeed } from "../features/procurement-officers/use-officer-search";
import type { OfficerDetailFeed } from "../features/procurement-officers/use-officer-detail";
import type { OfficerCorrectionFeed } from "../features/procurement-officers/use-officer-corrections";
import type { OfficerSearchResult, OfficerDetail, OfficerTendersResult, OfficerCorrection } from "../services/api/endpoints/procurement-officers";
import type { OfficerSyncResult } from "../services/api/endpoints/procurement-officers";
import type { ProcurementOfficerRow } from "../db/schema/types";

const owner = assertWorkspaceOwner(`v1-${"c".repeat(64)}`);

class FakeFeed implements OfficerSyncFeed, OfficerSearchFeed, OfficerDetailFeed, OfficerCorrectionFeed {
  pages: Array<OfficerSyncResult | ApiError> = [];
  searchPages: Array<OfficerSearchResult | Error> = [];
  detailPages: Array<OfficerDetail | Error> = [];
  tenderPages: Array<OfficerTendersResult | Error> = [];
  correctionResults: Array<OfficerCorrection | Error> = [];
  correctionCalls: Array<{ id: string; field: string; reason: string }> = [];
  calls = 0;
  async sync() {
    this.calls += 1;
    const next = this.pages.shift();
    if (next instanceof ApiError) throw next;
    return (
      next ?? { rows: [], nextCursor: null, hasMore: false, meta: { page: 1, limit: 200, total: 0 } }
    );
  }
  async search(): Promise<OfficerSearchResult> {
    const next = this.searchPages.shift();
    if (next instanceof Error) throw next;
    return next ?? { officers: [], page: 1, limit: 20, total: 0 };
  }
  async get(id: string): Promise<OfficerDetail> {
    const next = this.detailPages.shift();
    if (next instanceof Error) throw next;
    return (
      next ?? {
        id,
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
        tendersCount: 1,
        contactPoints: [],
        assignments: [],
        evidenceSummary: { sourceMethods: [], sourceFieldCount: 0, observedRange: { earliest: null, latest: null } },
      }
    );
  }
  async getTenders(): Promise<OfficerTendersResult> {
    const next = this.tenderPages.shift();
    if (next instanceof Error) throw next;
    return next ?? { tenders: [], page: 1, limit: 20, total: 0 };
  }
  async submitCorrection(
    id: string,
    input: { field: string; reason: string },
  ): Promise<OfficerCorrection> {
    this.correctionCalls.push({ id, field: input.field, reason: input.reason });
    const next = this.correctionResults.shift();
    if (next instanceof Error) throw next;
    return next ?? { id: "corr-1", status: "pending" };
  }
}

function emptyPage(): OfficerSyncResult {
  return { rows: [], nextCursor: null, hasMore: false, meta: { page: 1, limit: 200, total: 0 } };
}

function localOfficerRow(overrides: Partial<ProcurementOfficerRow> = {}): ProcurementOfficerRow {
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

afterEach(() => {
  resetOfficerSyncRunnersForTesting();
});

describe("ProcurementOfficerDirectory shell", () => {
  it("renders with an idle sync state and last sync time", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [
      [{ owner_id: owner, cursor: null, last_sync_at: "2026-01-01T10:00:00.000Z" }],
      [], // saved ids
      [], // recent searches
      [], // corrections: suppressed fields read
      [{ owner_id: owner, cursor: null, last_sync_at: "2026-01-01T10:00:00.000Z" }],
    ];
    const feed = new FakeFeed();
    feed.pages = [emptyPage()];

    render(<ProcurementOfficerDirectory feed={feed} executor={db} ownerId={owner} />);

    expect(
      await screen.findByRole("heading", { name: "Procurement Officers" }),
    ).toBeVisible();
    expect(await screen.findByText(/Last synced/)).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "Search officers" })).toBeVisible();
  });

  it("renders the feature-off state when the feed 404s", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[]];
    const feed = new FakeFeed();
    feed.pages = [new ApiError({ kind: "not-found", status: 404, message: "Not found" })];

    render(<ProcurementOfficerDirectory feed={feed} executor={db} ownerId={owner} />);

    expect(await screen.findByText("Directory not enabled")).toBeVisible();
    expect(screen.queryByText("Sync now")).not.toBeNull();
  });

  it("renders the entitlement-missing state when the feed 403s", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[]];
    const feed = new FakeFeed();
    feed.pages = [new ApiError({ kind: "forbidden", status: 403, message: "Forbidden" })];

    render(<ProcurementOfficerDirectory feed={feed} executor={db} ownerId={owner} />);

    expect(await screen.findByText("Not included in your plan")).toBeVisible();
  });

  it("keeps search working under the entitlement banner (read-only index)", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [
      [], // boot runner read
      [], // saved ids
      [], // recent searches
      [], // corrections: suppressed fields read
      [localOfficerRow()], // local FTS pass (no post-boot-sync read under entitlement-missing)
    ];
    const feed = new FakeFeed();
    feed.pages = [new ApiError({ kind: "forbidden", status: 403, message: "Forbidden" })];

    render(<ProcurementOfficerDirectory feed={feed} executor={db} ownerId={owner} />);

    expect(await screen.findByText("Not included in your plan")).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "Search officers" })).toBeVisible();

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("searchbox", { name: "Search officers" }),
      "Mokoena",
    );

    expect(await screen.findByText("Thabo Mokoena")).toBeVisible();
  });

  it("shows the offline banner with the last sync time when the refresh fails", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [
      [{ owner_id: owner, cursor: null, last_sync_at: "2026-01-01T10:00:00.000Z" }], // boot runner read
      [], // saved ids
      [], // recent searches
      [], // corrections: suppressed fields read
      [{ owner_id: owner, cursor: null, last_sync_at: "2026-01-01T10:00:00.000Z" }], // post-boot-sync read
      [localOfficerRow()], // local FTS pass
    ];
    const feed = new FakeFeed();
    feed.pages = [emptyPage()];
    feed.searchPages = [
      new ApiError({ kind: "offline", status: 0, message: "No network connection is available" }),
    ];

    render(<ProcurementOfficerDirectory feed={feed} executor={db} ownerId={owner} />);

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("searchbox", { name: "Search officers" }),
      "Mokoena",
    );

    expect(await screen.findByText(/Showing locally synced results only/)).toBeVisible();
    expect(screen.getByText(/last synced/)).toBeVisible();
    expect(screen.getByText("Thabo Mokoena")).toBeVisible();
  });

  it("filters to saved officers only and shows an honest empty state", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [
      [], // boot runner read
      [], // saved ids: nothing saved
      [], // recent searches
      [], // corrections: suppressed fields read
      [], // post-boot-sync read
      [localOfficerRow()], // local FTS pass
    ];
    const feed = new FakeFeed();

    render(<ProcurementOfficerDirectory feed={feed} executor={db} ownerId={owner} />);

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("searchbox", { name: "Search officers" }),
      "Mokoena",
    );
    expect(await screen.findByText("Thabo Mokoena")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Saved only" }));
    expect(
      await screen.findByText("No saved officers yet — save one from its details."),
    ).toBeVisible();
  });

  it("keeps saved rows when the saved-only filter is on", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [
      [], // boot runner read
      [{ officer_id: "officer-1" }], // saved ids: officer-1 is saved
      [], // recent searches
      [], // corrections: suppressed fields read
      [], // post-boot-sync read
      [localOfficerRow()], // local FTS pass
      [localOfficerRow()], // local FTS pass after the Saved-only filter re-runs the pipeline
    ];
    const feed = new FakeFeed();

    render(<ProcurementOfficerDirectory feed={feed} executor={db} ownerId={owner} />);

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("searchbox", { name: "Search officers" }),
      "Mokoena",
    );
    expect(await screen.findByText("Thabo Mokoena")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Saved only" }));
    expect(await screen.findByText("Thabo Mokoena")).toBeVisible();
    expect(screen.getByText("Saved")).toBeVisible();
  });

  it("syncs on demand via the Sync now button", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [
      [], // boot runner read
      [], // saved ids
      [], // recent searches
      [], // corrections: suppressed fields read
      [], // post-boot-sync read: nothing synced yet
      [], // click runner read
      [{ owner_id: owner, cursor: null, last_sync_at: "2026-01-01T10:00:00.000Z" }],
    ];
    const feed = new FakeFeed();
    feed.pages = [emptyPage(), emptyPage()];

    render(<ProcurementOfficerDirectory feed={feed} executor={db} ownerId={owner} />);
    await screen.findByText(/No sync has run yet/);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sync now" }));

    expect(await screen.findByText(/Last synced/)).toBeVisible();
    expect(feed.calls).toBe(2);
  });

  it("searches the local index and shows result rows", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [
      [], // boot runner read
      [], // saved ids
      [], // recent searches
      [], // corrections: suppressed fields read
      [], // post-boot-sync read
      [localOfficerRow()], // local FTS pass
    ];
    const feed = new FakeFeed();

    render(<ProcurementOfficerDirectory feed={feed} executor={db} ownerId={owner} />);

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("searchbox", { name: "Search officers" }),
      "Mokoena",
    );

    expect(await screen.findByText("Thabo Mokoena")).toBeVisible();
    expect(screen.getByText(/Supply Chain Manager/)).toBeVisible();
  });

  it("files a correction that hides the disputed field until resolution", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [
      [], // boot runner read
      [], // saved ids
      [], // recent searches
      [], // corrections: suppressed fields read
      [], // post-boot-sync read
      [localOfficerRow()], // local FTS pass
      [localOfficerRow()], // detail: officers
      [{ owner_id: owner, officer_id: "officer-1", id: "cp-1", type: "email", value: "thabo@dwa.gov.za", is_role_based: 0, is_official: 1, verification_status: "verified" }], // detail: contact points
      [{ owner_id: owner, officer_id: "officer-1", id: "a-1", organisation_id: "org-9", organisation_name: "Department of Water Affairs", title: "Supply Chain Manager", valid_from: "2024-01-01T00:00:00.000Z", valid_to: null, is_current: 1, confidence_score: 0.9 }], // detail: assignments
      [], // detail: tender links
      [], // detail: is saved
      [], // detail: notes
    ];
    const feed = new FakeFeed();

    render(<ProcurementOfficerDirectory feed={feed} executor={db} ownerId={owner} />);

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("searchbox", { name: "Search officers" }),
      "Mokoena",
    );
    await user.click(await screen.findByRole("button", { name: /Thabo Mokoena/ }));

    const reportButtons = await screen.findAllByRole("button", { name: "Report" });
    await user.click(reportButtons[reportButtons.length - 1]);

    expect(
      screen.getByRole("heading", { name: "Report incorrect information" }),
    ).toBeVisible();
    await user.type(
      screen.getByLabelText("Reason"),
      "This address is out of date",
    );
    await user.click(
      screen.getByRole("button", { name: "Report incorrect information" }),
    );

    expect(feed.correctionCalls).toEqual([
      { id: "officer-1", field: "email", reason: "This address is out of date" },
    ]);
    expect(
      await screen.findByText(/Correction filed — status: pending/),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByText(/thabo@dwa\.gov\.za/)).not.toBeInTheDocument();
    expect(screen.getByText("No official contacts recorded.")).toBeVisible();
  });

  it("opens the detail panel from a result row and returns to the list", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [
      [], // boot runner read
      [], // saved ids
      [], // recent searches
      [], // corrections: suppressed fields read
      [], // post-boot-sync read
      [localOfficerRow()], // local FTS pass
      [localOfficerRow()], // detail: officers
      [], // detail: contact points
      [{ owner_id: owner, officer_id: "officer-1", id: "a-1", organisation_id: "org-9", organisation_name: "Department of Water Affairs", title: "Supply Chain Manager", valid_from: "2024-01-01T00:00:00.000Z", valid_to: null, is_current: 1, confidence_score: 0.9 }], // detail: assignments
      [], // detail: tender links
      [], // detail: is saved
      [], // detail: notes
    ];
    const feed = new FakeFeed();
    feed.detailPages = [
      {
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
        tendersCount: 1,
        contactPoints: [],
        assignments: [],
        evidenceSummary: { sourceMethods: [], sourceFieldCount: 0, observedRange: { earliest: null, latest: null } },
      },
    ];

    render(<ProcurementOfficerDirectory feed={feed} executor={db} ownerId={owner} />);

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("searchbox", { name: "Search officers" }),
      "Mokoena",
    );
    await user.click(await screen.findByRole("button", { name: /Thabo Mokoena/ }));

    expect(await screen.findByText("Private Bag X313, Pretoria")).toBeVisible();
    expect(screen.getByText(/Current assignment/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(
      await screen.findByRole("button", { name: /Thabo Mokoena/ }),
    ).toBeVisible();
  });

  it("applies a province filter to the local pass", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [
      [], // boot runner read
      [], // saved ids
      [], // recent searches
      [], // corrections: suppressed fields read
      [], // post-boot-sync read
      [localOfficerRow()], // local FTS pass with the province filter
    ];
    const feed = new FakeFeed();

    render(<ProcurementOfficerDirectory feed={feed} executor={db} ownerId={owner} />);

    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter by province" }),
      "Gauteng",
    );

    expect(await screen.findByText("Thabo Mokoena")).toBeVisible();
  });

  it("shows an honest empty state when nothing matches", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[], [], [], [], [], []];
    const feed = new FakeFeed();

    render(<ProcurementOfficerDirectory feed={feed} executor={db} ownerId={owner} />);

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("searchbox", { name: "Search officers" }),
      "zzz",
    );

    expect(
      await screen.findByText("No officers match your search."),
    ).toBeVisible();
  });

  it("does not crash when no account is active", () => {
    const db = new FakeSqlExecutor();
    render(<ProcurementOfficerDirectory feed={new FakeFeed()} executor={db} />);
    expect(
      screen.getByRole("heading", { name: "Procurement Officers" }),
    ).toBeVisible();
  });
});

describe("useOfficerSync runner registry", () => {
  it("reuses one runner instance per account", () => {
    const db = new FakeSqlExecutor();
    const feed = new FakeFeed();
    const first = getOfficerSyncRunner(owner, feed, db);
    const second = getOfficerSyncRunner(owner, feed, db);
    expect(first).toBe(second);
    expect(first).toBeInstanceOf(OfficerSyncRunner);
  });

  it("replaces the runner when the wiring changes", () => {
    const db = new FakeSqlExecutor();
    const feed = new FakeFeed();
    const first = getOfficerSyncRunner(owner, feed, db);
    const second = getOfficerSyncRunner(owner, feed, new FakeSqlExecutor());
    expect(second).not.toBe(first);
  });

  it("keeps different accounts isolated", () => {
    const db = new FakeSqlExecutor();
    const feed = new FakeFeed();
    const a = getOfficerSyncRunner(owner, feed, db);
    const b = getOfficerSyncRunner(`${owner.slice(0, -1)}d`, feed, db);
    expect(b).not.toBe(a);
  });
});

describe("ProcurementOfficerDirectory test hygiene", () => {
  it("resets the registry between tests so wiring is never stale", () => {
    const db = new FakeSqlExecutor();
    const feed = new FakeFeed();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const first = getOfficerSyncRunner(owner, feed, db);
    resetOfficerSyncRunnersForTesting();
    const second = getOfficerSyncRunner(owner, feed, db);
    expect(second).not.toBe(first);
    vi.restoreAllMocks();
  });
});