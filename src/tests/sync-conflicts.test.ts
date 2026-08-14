import { describe, expect, it } from "vitest";
import { FakeSqlExecutor } from "./fakes/sql-executor";
import {
  listUnresolvedConflicts,
  markConflictResolved,
  recordConflict,
  requiresHumanResolution,
} from "../services/sync/conflicts";

describe("sync conflicts", () => {
  it("records both versions and starts unresolved", async () => {
    const db = new FakeSqlExecutor();
    await recordConflict(
      db,
      "owner-a",
      {
        id: "c1",
        syncOperationId: "op-1",
        entityType: "proposal",
        entityId: "p1",
        localVersion: '{"price":100}',
        remoteVersion: '{"price":120}',
      },
      "2026-01-01T00:00:00.000Z",
    );

    const { sql, params } = db.calls[0];
    expect(sql).toContain("'unresolved'");
    expect(params).toContain("owner-a");
    expect(params).toContain('{"price":100}');
    expect(params).toContain('{"price":120}');
  });

  it("flags proposal and pricing conflicts as human-resolution-only", () => {
    expect(requiresHumanResolution("proposal")).toBe(true);
    expect(requiresHumanResolution("pricing")).toBe(true);
    expect(requiresHumanResolution("response-document")).toBe(true);
    expect(requiresHumanResolution("tender")).toBe(false);
  });

  it("lists unresolved conflicts oldest-first", async () => {
    const db = new FakeSqlExecutor();
    await listUnresolvedConflicts(db, "owner-a");
    expect(db.calls[0].sql).toContain("resolution_state = 'unresolved'");
    expect(db.calls[0].sql).toContain("ORDER BY created_at ASC");
    expect(db.calls[0].params).toEqual(["owner-a"]);
  });

  it("only resolves a conflict that is still unresolved", async () => {
    const db = new FakeSqlExecutor();
    await markConflictResolved(
      db,
      "owner-a",
      "c1",
      "resolved_local",
      "2026-01-01T00:00:00.000Z",
    );
    const { sql, params } = db.calls[0];
    // The guard prevents silently re-resolving an already-decided
    // conflict, which would discard the recorded human decision.
    expect(sql).toContain("AND resolution_state = 'unresolved'");
    expect(params).toEqual([
      "resolved_local",
      "2026-01-01T00:00:00.000Z",
      "owner-a",
      "c1",
    ]);
  });
});
