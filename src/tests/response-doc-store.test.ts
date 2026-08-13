import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/api/errors";
import {
  createResponseDocStore,
  RESPONSE_DOC_ENTITY_TYPE,
  RESPONSE_DOC_SAVE_OPERATION,
} from "../services/storage/response-doc-store";
import type { NativeCrypto } from "../services/storage/native-crypto";
import { FakeSqlExecutor } from "./fakes/sql-executor";
import type {
  ResponseDocDraftRow,
  ResponseDocVersionRow,
  SyncOperationRow,
} from "../db/schema/types";

function fakeCrypto(): NativeCrypto {
  return {
    encrypt: (value) => Promise.resolve(`enc:${value}`),
    decrypt: (value) => Promise.resolve(value.replace(/^enc:/, "")),
  };
}

function draftRow(
  overrides: Partial<ResponseDocDraftRow> = {},
): ResponseDocDraftRow {
  return {
    application_id: "a1",
    document_key: "technical",
    content: "enc:draft content",
    encrypted: 1,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function versionRow(
  overrides: Partial<ResponseDocVersionRow> = {},
): ResponseDocVersionRow {
  return {
    id: "v1",
    application_id: "a1",
    document_key: "technical",
    content: "enc:older content",
    encrypted: 1,
    source: "save",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function pendingOp(
  overrides: Partial<SyncOperationRow> = {},
): SyncOperationRow {
  return {
    id: "op-1",
    idempotency_key: "response-doc-save:a1:technical",
    entity_type: RESPONSE_DOC_ENTITY_TYPE,
    entity_id: "a1:technical",
    operation_type: RESPONSE_DOC_SAVE_OPERATION,
    payload:
      'enc:{"applicationId":"a1","documentKey":"technical","content":"draft v1"}',
    depends_on: null,
    status: "pending",
    attempt_count: 0,
    last_error: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("response-doc store (Slice 10)", () => {
  it("persists drafts encrypted, never plaintext in the SQL params", async () => {
    const db = new FakeSqlExecutor();
    const store = createResponseDocStore(db, fakeCrypto());

    await store.persistDraft("a1", "technical", "draft content");

    const { params } = db.calls[0];
    expect(params).not.toContain("draft content");
    expect(params).toContain("enc:draft content");
    expect(params).toContain(1); // encrypted = 1
  });

  it("loads and decrypts a stored draft", async () => {
    const db = new FakeSqlExecutor();
    const store = createResponseDocStore(db, fakeCrypto());
    db.selectResults = [[draftRow()]];

    expect(await store.loadDraft("a1", "technical")).toBe("draft content");
    expect(db.calls[0].params).toEqual(["a1", "technical"]);
  });

  it("returns undefined for a missing draft", async () => {
    const db = new FakeSqlExecutor();
    db.selectResults = [[]];
    const store = createResponseDocStore(db, fakeCrypto());

    expect(await store.loadDraft("a1", "technical")).toBeUndefined();
  });

  it("clears a draft by composite key", async () => {
    const db = new FakeSqlExecutor();
    const store = createResponseDocStore(db, fakeCrypto());

    await store.clearDraft("a1", "technical");

    expect(db.calls[0].sql).toContain("DELETE FROM response_doc_drafts");
    expect(db.calls[0].params).toEqual(["a1", "technical"]);
  });

  it("snapshots versions encrypted and prunes beyond the cap", async () => {
    const db = new FakeSqlExecutor();
    const store = createResponseDocStore(db, fakeCrypto());

    await store.snapshotVersion("a1", "technical", "old content", "save");

    const insert = db.calls[0];
    expect(insert.params).toContain("enc:old content");
    expect(insert.params).not.toContain("old content");
    expect(insert.params).toContain("save");
    const prune = db.calls[1];
    expect(prune.sql).toContain("DELETE FROM response_doc_versions");
    expect(prune.sql).toContain("NOT IN");
    expect(prune.params).toContain(20);
  });

  it("lists versions decrypted, newest first as stored", async () => {
    const db = new FakeSqlExecutor();
    const store = createResponseDocStore(db, fakeCrypto());
    db.selectResults = [
      [
        versionRow({
          id: "v2",
          content: "enc:newer content",
          created_at: "2026-01-02T00:00:00.000Z",
        }),
        versionRow(),
      ],
    ];

    const entries = await store.listVersions("a1", "technical");

    expect(entries).toEqual([
      {
        id: "v2",
        content: "newer content",
        source: "save",
        createdAt: "2026-01-02T00:00:00.000Z",
      },
      {
        id: "v1",
        content: "older content",
        source: "save",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("enqueues a save with an idempotency key and an encrypted payload", async () => {
    const db = new FakeSqlExecutor();
    const store = createResponseDocStore(db, fakeCrypto());

    await store.enqueueSave("a1", "technical", "offline content");

    const { sql, params } = db.calls[0];
    expect(sql).toContain("INSERT INTO sync_operations");
    expect(sql).toContain("ON CONFLICT(idempotency_key) DO UPDATE");
    expect(sql).not.toContain("DO NOTHING");
    expect(params[1]).toBe("response-doc-save:a1:technical");
    expect(params).toContain(
      'enc:{"applicationId":"a1","documentKey":"technical","content":"offline content"}',
    );
    expect(params).not.toContain(
      '{"applicationId":"a1","documentKey":"technical","content":"offline content"}',
    );
  });

  it("lists pending save keys for the application only", async () => {
    const db = new FakeSqlExecutor();
    const store = createResponseDocStore(db, fakeCrypto());
    db.selectResults = [
      [
        pendingOp(),
        pendingOp({
          id: "op-2",
          entity_id: "a2:technical",
          idempotency_key: "response-doc-save:a2:technical",
          payload:
            'enc:{"applicationId":"a2","documentKey":"technical","content":"other app"}',
        }),
        pendingOp({
          id: "op-3",
          operation_type: "export",
          payload: "enc:{}",
        }),
      ],
    ];

    expect(await store.listPendingSaveKeys("a1")).toEqual(["technical"]);
  });

  it("replays queued saves oldest-first, completing and clearing drafts", async () => {
    const db = new FakeSqlExecutor();
    const save = vi.fn(async () => {});
    db.selectResults = [
      [
        pendingOp(),
        pendingOp({
          id: "op-2",
          idempotency_key: "response-doc-save:a1:cover_letter",
          entity_id: "a1:cover_letter",
          payload:
            'enc:{"applicationId":"a1","documentKey":"cover_letter","content":"letter v1"}',
        }),
      ],
    ];
    const store = createResponseDocStore(db, fakeCrypto());

    const replayed = await store.replayPendingSaves(save);

    expect(replayed).toBe(2);
    expect(save).toHaveBeenNthCalledWith(1, "a1", "technical", "draft v1");
    expect(save).toHaveBeenNthCalledWith(2, "a1", "cover_letter", "letter v1");
    const statuses = db.calls
      .filter((call) => call.sql.includes("UPDATE sync_operations"))
      .map((call) => call.params[0]);
    expect(statuses).toEqual(["syncing", "complete", "syncing", "complete"]);
    const deletes = db.calls.filter((call) =>
      call.sql.includes("DELETE FROM response_doc_drafts"),
    );
    expect(deletes).toHaveLength(2);
    expect(deletes[0].params).toEqual(["a1", "technical"]);
    expect(deletes[1].params).toEqual(["a1", "cover_letter"]);
  });

  it("keeps transient failures pending and marks hard failures failed", async () => {
    const db = new FakeSqlExecutor();
    const save = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ kind: "offline", message: "No network" }),
      )
      .mockRejectedValueOnce(
        new ApiError({ kind: "forbidden", message: "Not entitled" }),
      );
    db.selectResults = [[pendingOp({ id: "op-t" }), pendingOp({ id: "op-h" })]];
    const store = createResponseDocStore(db, fakeCrypto());

    const replayed = await store.replayPendingSaves(save);

    expect(replayed).toBe(0);
    const updates = db.calls
      .filter((call) => call.sql.includes("UPDATE sync_operations"))
      .map((call) => call.params);
    expect(updates[0].slice(0, 2)).toEqual(["syncing", null]);
    expect(updates[1].slice(0, 3)).toEqual(["pending", 1, "No network"]);
    expect(updates[2].slice(0, 2)).toEqual(["syncing", null]);
    expect(updates[3][0]).toBe("failed");
    expect(updates[3][2]).toBe("Not entitled");
    expect(
      db.calls.filter((call) =>
        call.sql.includes("DELETE FROM response_doc_drafts"),
      ),
    ).toHaveLength(0);
  });

  it("marks a corrupt queued payload failed without calling the save function", async () => {
    const db = new FakeSqlExecutor();
    const save = vi.fn();
    db.selectResults = [[pendingOp({ payload: "enc:not-json" })]];
    const store = createResponseDocStore(db, fakeCrypto());

    await store.replayPendingSaves(save);

    expect(save).not.toHaveBeenCalled();
    const update = db.calls.find((call) =>
      call.sql.includes("UPDATE sync_operations"),
    );
    expect(update?.params[0]).toBe("failed");
  });
});
