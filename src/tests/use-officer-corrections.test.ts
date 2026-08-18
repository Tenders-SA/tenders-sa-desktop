import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { FakeSqlExecutor } from "./fakes/sql-executor";
import { ApiError } from "../services/api/errors";
import { assertWorkspaceOwner } from "../services/storage/workspace-owner";
import {
  isFieldSuppressed,
  pruneSuppressed,
  useOfficerCorrections,
  type OfficerCorrectionFeed,
} from "../features/procurement-officers/use-officer-corrections";
import type { OfficerCorrection } from "../services/api/endpoints/procurement-officers";

const owner = assertWorkspaceOwner(`v1-${"d".repeat(64)}`);

class FakeCorrectionFeed implements OfficerCorrectionFeed {
  correctionCalls: Array<{ id: string; field: string; reason: string }> = [];
  results: Array<OfficerCorrection | Error> = [];
  async submitCorrection(
    id: string,
    input: { field: string; reason: string },
  ): Promise<OfficerCorrection> {
    this.correctionCalls.push({ id, field: input.field, reason: input.reason });
    const next = this.results.shift();
    if (next instanceof Error) throw next;
    return next ?? { id: "corr-1", status: "pending" };
  }
}

function persistedMap(db: FakeSqlExecutor): Record<string, string> {
  const insert = db.calls.find((c) =>
    c.sql.includes("INSERT INTO local_preferences"),
  );
  if (!insert) return {};
  const stored = insert.params[2];
  return typeof stored === "string"
    ? (JSON.parse(stored) as Record<string, string>)
    : {};
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useOfficerCorrections", () => {
  it("loads the suppressed map from preferences", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [
      [
        {
          owner_id: owner,
          key: "officerSuppressedFields",
          value: JSON.stringify({ "officer-1:email": "a@b.co" }),
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    ];
    const feed = new FakeCorrectionFeed();

    const { result } = renderHook(() =>
      useOfficerCorrections(feed, db, owner, "officer-1", null),
    );
    await waitFor(() =>
      expect(result.current.suppressed["officer-1:email"]).toBe("a@b.co"),
    );
  });

  it("posts the correction and persists the pending suppression marker", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[]];
    const feed = new FakeCorrectionFeed();

    const { result } = renderHook(() =>
      useOfficerCorrections(feed, db, owner, "officer-1", null),
    );
    await waitFor(() => expect(result.current.phase).toBe("idle"));

    await act(async () => {
      await result.current.submitCorrection(
        "email",
        "thabo@dwa.gov.za",
        "Wrong address",
      );
    });

    expect(feed.correctionCalls).toEqual([
      { id: "officer-1", field: "email", reason: "Wrong address" },
    ]);
    expect(result.current.phase).toBe("submitted");
    expect(result.current.status).toBe("pending");
    expect(result.current.suppressed["officer-1:email"]).toBe(
      "thabo@dwa.gov.za",
    );
    expect(persistedMap(db)["officer-1:email"]).toBe("thabo@dwa.gov.za");
  });

  it("never writes a marker when the server rejects the correction (400)", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[]];
    const feed = new FakeCorrectionFeed();
    feed.results = [
      new ApiError({ kind: "validation", status: 400, message: "Bad field" }),
    ];

    const { result } = renderHook(() =>
      useOfficerCorrections(feed, db, owner, "officer-1", null),
    );
    await waitFor(() => expect(result.current.phase).toBe("idle"));

    await act(async () => {
      await result.current.submitCorrection(
        "email",
        "thabo@dwa.gov.za",
        "Wrong",
      );
    });

    expect(result.current.phase).toBe("error");
    expect(result.current.errorMessage).toMatch(/rejected/);
    expect(result.current.suppressed["officer-1:email"]).toBeUndefined();
    expect(persistedMap(db)).toEqual({});
  });

  it("surfaces a 404 honestly without a marker", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[]];
    const feed = new FakeCorrectionFeed();
    feed.results = [
      new ApiError({ kind: "not-found", status: 404, message: "Not found" }),
    ];

    const { result } = renderHook(() =>
      useOfficerCorrections(feed, db, owner, "officer-1", null),
    );
    await waitFor(() => expect(result.current.phase).toBe("idle"));

    await act(async () => {
      await result.current.submitCorrection("title", "Manager", "Wrong");
    });

    expect(result.current.phase).toBe("error");
    expect(result.current.errorMessage).toMatch(/not available/);
    expect(result.current.suppressed["officer-1:title"]).toBeUndefined();
  });

  it("rejects an unlisted field locally without a network call", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[]];
    const feed = new FakeCorrectionFeed();

    const { result } = renderHook(() =>
      useOfficerCorrections(feed, db, owner, "officer-1", null),
    );
    await waitFor(() => expect(result.current.phase).toBe("idle"));

    await act(async () => {
      await result.current.submitCorrection(
        "not-a-field",
        "whatever",
        "Reason",
      );
    });

    expect(result.current.phase).toBe("error");
    expect(result.current.errorMessage).toMatch(/cannot be reported/);
    expect(feed.correctionCalls).toEqual([]);
    expect(persistedMap(db)).toEqual({});
  });

  it("prunes a marker once a later sync no longer carries the disputed value", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [
      [
        {
          owner_id: owner,
          key: "officerSuppressedFields",
          value: JSON.stringify({ "officer-1:email": "thabo@dwa.gov.za" }),
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    ];
    const feed = new FakeCorrectionFeed();

    const values = {
      email: "thabo@dwa.gov.za",
      telephone: null,
      mobile: null,
      title: null,
      organisation: null,
      officer: "Thabo Mokoena",
    };
    const { result, rerender } = renderHook(
      ({ current }: { current: Record<string, string | null> | null }) =>
        useOfficerCorrections(feed, db, owner, "officer-1", current),
      { initialProps: { current: values } },
    );
    await waitFor(() =>
      expect(result.current.suppressed["officer-1:email"]).toBe(
        "thabo@dwa.gov.za",
      ),
    );

    rerender({ current: { ...values, email: "new@address.gov.za" } });
    await waitFor(() =>
      expect(result.current.suppressed["officer-1:email"]).toBeUndefined(),
    );
    expect(persistedMap(db)).toEqual({});
  });
});

describe("suppression logic", () => {
  it("hides only while the exact disputed value is carried", () => {
    const map = { "officer-1:email": "old@a.co" };
    expect(isFieldSuppressed(map, "officer-1", "email", "old@a.co")).toBe(true);
    expect(isFieldSuppressed(map, "officer-1", "email", "new@a.co")).toBe(
      false,
    );
    expect(isFieldSuppressed(map, "officer-1", "email", null)).toBe(false);
    expect(isFieldSuppressed(map, "officer-2", "email", "old@a.co")).toBe(
      false,
    );
  });

  it("prunes resolved markers and keeps active ones", () => {
    const map = {
      "officer-1:email": "old@a.co",
      "officer-1:title": "Manager",
      "officer-2:email": "other@b.co",
    };
    const pruned = pruneSuppressed(map, "officer-1", {
      email: "new@a.co",
      title: "Manager",
    });
    expect(pruned).toEqual({
      "officer-1:title": "Manager",
      "officer-2:email": "other@b.co",
    });
  });
});
