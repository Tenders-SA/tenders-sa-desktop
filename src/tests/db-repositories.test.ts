import { describe, expect, it } from "vitest";
import { FakeSqlExecutor } from "./fakes/sql-executor";
import {
  deleteExpiredCacheEntries,
  getCacheEntry,
  upsertCacheEntry,
} from "../db/repositories/cache-entries";
import {
  getLocalPreference,
  setLocalPreference,
} from "../db/repositories/local-preferences";
import {
  enqueueSyncOperation,
  listPendingSyncOperations,
  updateSyncOperationStatus,
} from "../db/repositories/sync-operations";
import type { CacheEntryRow, LocalPreferenceRow } from "../db/schema/types";

describe("cache-entries repository", () => {
  it("upserts with parameterized values, never string-interpolated", async () => {
    const db = new FakeSqlExecutor();
    await upsertCacheEntry(
      db,
      {
        key: "tender:1",
        entityType: "tender",
        entityId: "1",
        payload: '{"title":"Road works"}',
        encrypted: false,
      },
      "2026-01-01T00:00:00.000Z",
    );

    expect(db.calls).toHaveLength(1);
    const { sql, params } = db.calls[0];
    expect(sql).toContain("INSERT INTO cache_entries");
    expect(sql).not.toContain("Road works");
    expect(params).toEqual([
      "tender:1",
      "tender",
      "1",
      null,
      '{"title":"Road works"}',
      0,
      null,
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    ]);
  });

  it("reads a cache entry by key", async () => {
    const db = new FakeSqlExecutor();
    const row: CacheEntryRow = {
      key: "tender:1",
      entity_type: "tender",
      entity_id: "1",
      etag: null,
      payload: "{}",
      encrypted: 0,
      expires_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    db.selectResults = [[row]];

    const result = await getCacheEntry(db, "tender:1");
    expect(result).toEqual(row);
    expect(db.calls[0].params).toEqual(["tender:1"]);
  });

  it("returns undefined for a missing key without erroring", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[]];
    expect(await getCacheEntry(db, "missing")).toBeUndefined();
  });

  it("deletes expired entries and reports the count", async () => {
    const db = new FakeSqlExecutor();
    const deleted = await deleteExpiredCacheEntries(
      db,
      "2026-01-01T00:00:00.000Z",
    );
    expect(deleted).toBe(1);
    expect(db.calls[0].sql).toContain("DELETE FROM cache_entries");
  });
});

describe("local-preferences repository", () => {
  it("round-trips a preference through parameterized queries", async () => {
    const db = new FakeSqlExecutor();
    await setLocalPreference(db, "theme", "dark", "2026-01-01T00:00:00.000Z");
    expect(db.calls[0].params).toEqual([
      "theme",
      "dark",
      "2026-01-01T00:00:00.000Z",
    ]);

    const row: LocalPreferenceRow = {
      key: "theme",
      value: "dark",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    db.selectResults = [[row]];
    expect(await getLocalPreference(db, "theme")).toBe("dark");
  });
});

describe("sync-operations repository", () => {
  it("enqueues with a pending status and zero attempts", async () => {
    const db = new FakeSqlExecutor();
    await enqueueSyncOperation(
      db,
      {
        id: "op-1",
        idempotencyKey: "idem-1",
        entityType: "application",
        entityId: "a1",
        operationType: "update",
        payload: "{}",
      },
      "2026-01-01T00:00:00.000Z",
    );
    const { sql, params } = db.calls[0];
    expect(sql).toContain("ON CONFLICT(idempotency_key) DO NOTHING");
    expect(params).toEqual([
      "op-1",
      "idem-1",
      "application",
      "a1",
      "update",
      "{}",
      null,
      "2026-01-01T00:00:00.000Z",
    ]);
  });

  it("lists only pending operations, oldest first", async () => {
    const db = new FakeSqlExecutor();
    await listPendingSyncOperations(db);
    expect(db.calls[0].sql).toContain("WHERE status = 'pending'");
    expect(db.calls[0].sql).toContain("ORDER BY created_at ASC");
  });

  it("updates status and attempt count via parameters", async () => {
    const db = new FakeSqlExecutor();
    await updateSyncOperationStatus(
      db,
      "op-1",
      "failed",
      { attemptCount: 2, lastError: "network timeout" },
      "2026-01-01T00:00:00.000Z",
    );
    expect(db.calls[0].params).toEqual([
      "failed",
      2,
      "network timeout",
      "2026-01-01T00:00:00.000Z",
      "op-1",
    ]);
  });
});
