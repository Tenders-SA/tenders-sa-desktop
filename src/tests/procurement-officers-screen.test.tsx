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
import type { OfficerSyncResult } from "../services/api/endpoints/procurement-officers";

const owner = assertWorkspaceOwner(`v1-${"c".repeat(64)}`);

class FakeFeed implements OfficerSyncFeed {
  pages: Array<OfficerSyncResult | ApiError> = [];
  calls = 0;
  async sync() {
    this.calls += 1;
    const next = this.pages.shift();
    if (next instanceof ApiError) throw next;
    return (
      next ?? { rows: [], nextCursor: null, hasMore: false, meta: { page: 1, limit: 200, total: 0 } }
    );
  }
}

function emptyPage(): OfficerSyncResult {
  return { rows: [], nextCursor: null, hasMore: false, meta: { page: 1, limit: 200, total: 0 } };
}

afterEach(() => {
  resetOfficerSyncRunnersForTesting();
});

describe("ProcurementOfficerDirectory shell", () => {
  it("renders with an idle sync state and last sync time", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [
      [{ owner_id: owner, cursor: null, last_sync_at: "2026-01-01T10:00:00.000Z" }],
      [{ owner_id: owner, cursor: null, last_sync_at: "2026-01-01T10:00:00.000Z" }],
    ];
    const feed = new FakeFeed();
    feed.pages = [emptyPage()];

    render(<ProcurementOfficerDirectory feed={feed} executor={db} ownerId={owner} />);

    expect(
      await screen.findByRole("heading", { name: "Procurement Officers" }),
    ).toBeVisible();
    expect(await screen.findByText(/Last synced/)).toBeVisible();
    expect(screen.getByText("Officer search is coming next.")).toBeVisible();
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

  it("syncs on demand via the Sync now button", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [
      [],
      [],
      [],
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