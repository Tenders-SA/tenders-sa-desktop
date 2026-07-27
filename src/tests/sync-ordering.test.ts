import { describe, expect, it } from "vitest";
import {
  DependencyCycleError,
  orderPendingOperations,
} from "../services/sync/ordering";
import type { SyncOperationRow, SyncOperationStatus } from "../db/schema/types";

function op(
  id: string,
  overrides: Partial<SyncOperationRow> = {},
): SyncOperationRow {
  return {
    id,
    idempotency_key: `idem-${id}`,
    entity_type: "application",
    entity_id: "a1",
    operation_type: "update",
    payload: "{}",
    depends_on: null,
    status: "pending" as SyncOperationStatus,
    attempt_count: 0,
    last_error: null,
    created_at: `2026-01-01T00:00:0${id.replace(/\D/g, "")}.000Z`,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function index(ops: SyncOperationRow[]): Map<string, SyncOperationRow> {
  return new Map(ops.map((o) => [o.id, o]));
}

describe("sync ordering", () => {
  it("orders independent operations oldest-first", () => {
    const ops = [op("2"), op("1"), op("3")];
    const ordered = orderPendingOperations(ops, index(ops));
    expect(ordered.map((o) => o.id)).toEqual(["1", "2", "3"]);
  });

  it("places a dependency before its dependent", () => {
    const first = op("1");
    const second = op("2", { depends_on: "1" });
    // Deliberately pass the dependent first.
    const ops = [second, first];
    const ordered = orderPendingOperations(ops, index(ops));
    expect(ordered.map((o) => o.id)).toEqual(["1", "2"]);
  });

  it("treats an already-complete dependency as satisfied", () => {
    const done = op("1", { status: "complete" });
    const dependent = op("2", { depends_on: "1" });
    const ordered = orderPendingOperations(
      [dependent],
      index([done, dependent]),
    );
    expect(ordered.map((o) => o.id)).toEqual(["2"]);
  });

  it("holds back an operation whose dependency failed", () => {
    const failed = op("1", { status: "failed" });
    const dependent = op("2", { depends_on: "1" });
    const ordered = orderPendingOperations(
      [dependent],
      index([failed, dependent]),
    );
    expect(ordered).toEqual([]);
  });

  it("holds back an operation whose dependency was cancelled", () => {
    const cancelled = op("1", { status: "cancelled" });
    const dependent = op("2", { depends_on: "1" });
    const ordered = orderPendingOperations(
      [dependent],
      index([cancelled, dependent]),
    );
    expect(ordered).toEqual([]);
  });

  it("holds back an operation whose dependency is missing entirely", () => {
    const orphan = op("2", { depends_on: "does-not-exist" });
    const ordered = orderPendingOperations([orphan], index([orphan]));
    expect(ordered).toEqual([]);
  });

  it("orders a multi-step dependency chain correctly", () => {
    const a = op("1");
    const b = op("2", { depends_on: "1" });
    const c = op("3", { depends_on: "2" });
    const ops = [c, b, a];
    const ordered = orderPendingOperations(ops, index(ops));
    expect(ordered.map((o) => o.id)).toEqual(["1", "2", "3"]);
  });

  it("detects a dependency cycle rather than looping forever", () => {
    const a = op("1", { depends_on: "2" });
    const b = op("2", { depends_on: "1" });
    const ops = [a, b];
    expect(() => orderPendingOperations(ops, index(ops))).toThrow(
      DependencyCycleError,
    );
  });
});
