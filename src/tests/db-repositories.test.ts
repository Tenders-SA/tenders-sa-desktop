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
import type {
  CacheEntryRow,
  LocalPreferenceRow,
  ResponseDocDraftRow,
} from "../db/schema/types";

const owner = `v1-${"a".repeat(64)}`;

describe("cache-entries repository", () => {
  it("upserts with parameterized values, never string-interpolated", async () => {
    const db = new FakeSqlExecutor();
    await upsertCacheEntry(
      db,
      {
        ownerId: owner,
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
      `${owner}:tender:1`,
      "tender",
      "1",
      null,
      '{"title":"Road works"}',
      0,
      null,
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
      owner,
    ]);
  });

  it("reads a cache entry by key", async () => {
    const db = new FakeSqlExecutor();
    const row: CacheEntryRow = {
      owner_id: owner,
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

    const result = await getCacheEntry(db, owner, "tender:1");
    expect(result).toEqual(row);
    expect(db.calls[0].params).toEqual([owner, `${owner}:tender:1`]);
  });

  it("returns undefined for a missing key without erroring", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[]];
    expect(await getCacheEntry(db, owner, "missing")).toBeUndefined();
  });

  it("deletes expired entries and reports the count", async () => {
    const db = new FakeSqlExecutor();
    const deleted = await deleteExpiredCacheEntries(
      db,
      owner,
      "2026-01-01T00:00:00.000Z",
    );
    expect(deleted).toBe(1);
    expect(db.calls[0].sql).toContain("DELETE FROM cache_entries");
  });
});

describe("local-preferences repository", () => {
  it("round-trips a preference through parameterized queries", async () => {
    const db = new FakeSqlExecutor();
    await setLocalPreference(
      db,
      owner,
      "theme",
      "dark",
      "2026-01-01T00:00:00.000Z",
    );
    expect(db.calls[0].params).toEqual([
      owner,
      "theme",
      "dark",
      "2026-01-01T00:00:00.000Z",
    ]);

    const row: LocalPreferenceRow = {
      owner_id: "legacy-unscoped",
      key: "theme",
      value: "dark",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    db.selectResults = [[row]];
    expect(await getLocalPreference(db, owner, "theme")).toBe("dark");
  });
});

describe("sync-operations repository", () => {
  it("enqueues with a pending status and zero attempts", async () => {
    const db = new FakeSqlExecutor();
    await enqueueSyncOperation(
      db,
      {
        ownerId: owner,
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
      owner,
    ]);
  });

  it("upserts by idempotency key so a re-enqueue replaces the payload", async () => {
    const db = new FakeSqlExecutor();
    const { upsertSyncOperation } =
      await import("../db/repositories/sync-operations");
    await upsertSyncOperation(
      db,
      {
        ownerId: owner,
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
    expect(sql).toContain("ON CONFLICT(idempotency_key) DO UPDATE");
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain("attempt_count = 0");
    expect(params).toEqual([
      "op-1",
      "idem-1",
      "application",
      "a1",
      "update",
      "{}",
      null,
      "2026-01-01T00:00:00.000Z",
      owner,
    ]);
  });

  it("lists only pending operations, oldest first", async () => {
    const db = new FakeSqlExecutor();
    await listPendingSyncOperations(db, owner);
    expect(db.calls[0].sql).toContain("status = 'pending'");
    expect(db.calls[0].params).toEqual([owner]);
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

describe("response-doc-drafts repository", () => {
  it("upserts on the composite key, replacing the payload", async () => {
    const db = new FakeSqlExecutor();
    const { upsertResponseDocDraft: upsert } =
      await import("../db/repositories/response-doc-drafts");
    await upsert(
      db,
      {
        ownerId: owner,
        applicationId: "a1",
        documentKey: "technical",
        content: "enc:content",
        encrypted: true,
      },
      "2026-01-01T00:00:00.000Z",
    );
    const { sql, params } = db.calls[0];
    expect(sql).toContain("INSERT INTO response_doc_drafts");
    expect(sql).toContain(
      "ON CONFLICT(owner_id, application_id, document_key) DO UPDATE",
    );
    expect(params).toEqual([
      "a1",
      "technical",
      "enc:content",
      1,
      "2026-01-01T00:00:00.000Z",
      owner,
    ]);
  });

  it("reads a draft by composite key", async () => {
    const db = new FakeSqlExecutor();
    const { getResponseDocDraft: get } =
      await import("../db/repositories/response-doc-drafts");
    const row: ResponseDocDraftRow = {
      owner_id: owner,
      application_id: "a1",
      document_key: "technical",
      content: "enc:content",
      encrypted: 1,
      updated_at: "2026-01-01T00:00:00.000Z",
      base_fingerprint: null,
    };
    db.selectResults = [[row]];
    expect(await get(db, owner, "a1", "technical")).toEqual(row);
    expect(db.calls[0].params).toEqual([owner, "a1", "technical"]);
  });

  it("deletes a draft by composite key", async () => {
    const db = new FakeSqlExecutor();
    const { deleteResponseDocDraft: del } =
      await import("../db/repositories/response-doc-drafts");
    await del(db, owner, "a1", "technical");
    expect(db.calls[0].sql).toContain("DELETE FROM response_doc_drafts");
    expect(db.calls[0].params).toEqual([owner, "a1", "technical"]);
  });
});

describe("response-doc-versions repository", () => {
  it("inserts a version with an encrypted payload and source", async () => {
    const db = new FakeSqlExecutor();
    const { insertResponseDocVersion } =
      await import("../db/repositories/response-doc-versions");
    await insertResponseDocVersion(
      db,
      {
        ownerId: owner,
        id: "v1",
        applicationId: "a1",
        documentKey: "technical",
        content: "enc:content",
        encrypted: true,
        source: "save",
      },
      "2026-01-01T00:00:00.000Z",
    );
    expect(db.calls[0].params).toEqual([
      "v1",
      "a1",
      "technical",
      "enc:content",
      1,
      "save",
      "2026-01-01T00:00:00.000Z",
      owner,
    ]);
  });

  it("lists newest-first with a limit bound via parameters", async () => {
    const db = new FakeSqlExecutor();
    const { listResponseDocVersions } =
      await import("../db/repositories/response-doc-versions");
    await listResponseDocVersions(db, owner, "a1", "technical", 5);
    const { sql, params } = db.calls[0];
    expect(sql).toContain("ORDER BY created_at DESC");
    expect(sql).toContain("LIMIT $4");
    expect(params).toEqual([owner, "a1", "technical", 5]);
  });

  it("prunes older versions beyond the keep count", async () => {
    const db = new FakeSqlExecutor();
    const { pruneResponseDocVersions } =
      await import("../db/repositories/response-doc-versions");
    await pruneResponseDocVersions(db, owner, "a1", "technical", 20);
    const { sql, params } = db.calls[0];
    expect(sql).toContain("DELETE FROM response_doc_versions");
    expect(sql).toContain("NOT IN");
    expect(params).toEqual([owner, "a1", "technical", 20]);
  });
});
