import { describe, expect, it } from "vitest";
import {
  backoffMs,
  cancel,
  InvalidTransitionError,
  isTerminal,
  resolveAttempt,
  resolveConflict,
  shouldRetry,
  startSync,
} from "../services/sync/state-machine";

const MAX_ATTEMPTS = 3;

describe("sync state machine", () => {
  describe("pending -> syncing", () => {
    it("increments the attempt count", () => {
      expect(startSync("pending", 0)).toEqual({
        status: "syncing",
        attemptCount: 1,
      });
    });

    it("refuses to start from a non-pending state", () => {
      for (const status of [
        "syncing",
        "complete",
        "failed",
        "cancelled",
      ] as const) {
        expect(() => startSync(status, 0)).toThrow(InvalidTransitionError);
      }
    });
  });

  describe("syncing -> outcome", () => {
    it("completes on success", () => {
      expect(
        resolveAttempt("syncing", 1, { kind: "success" }, MAX_ATTEMPTS),
      ).toEqual({ status: "complete" });
    });

    it("returns to pending on a transient failure within the attempt budget", () => {
      expect(
        resolveAttempt(
          "syncing",
          1,
          { kind: "transient", error: "network timeout" },
          MAX_ATTEMPTS,
        ),
      ).toEqual({
        status: "pending",
        attemptCount: 1,
        lastError: "network timeout",
      });
    });

    it("fails once the transient retry budget is exhausted", () => {
      expect(
        resolveAttempt(
          "syncing",
          MAX_ATTEMPTS,
          { kind: "transient", error: "network timeout" },
          MAX_ATTEMPTS,
        ),
      ).toEqual({ status: "failed", lastError: "network timeout" });
    });

    it("moves to conflicted rather than overwriting on conflict", () => {
      expect(
        resolveAttempt("syncing", 1, { kind: "conflict" }, MAX_ATTEMPTS),
      ).toEqual({ status: "conflicted" });
    });

    it("fails immediately on a terminal error without retrying", () => {
      expect(
        resolveAttempt(
          "syncing",
          1,
          { kind: "terminal", error: "422 validation failed" },
          MAX_ATTEMPTS,
        ),
      ).toEqual({ status: "failed", lastError: "422 validation failed" });
    });

    it("refuses to resolve an attempt for a non-syncing operation", () => {
      expect(() =>
        resolveAttempt("pending", 0, { kind: "success" }, MAX_ATTEMPTS),
      ).toThrow(InvalidTransitionError);
    });
  });

  describe("cancellation", () => {
    it("cancels a pending or syncing operation", () => {
      expect(cancel("pending")).toEqual({ status: "cancelled" });
      expect(cancel("syncing")).toEqual({ status: "cancelled" });
      expect(cancel("conflicted")).toEqual({ status: "cancelled" });
    });

    it("refuses to cancel an operation already in a terminal state", () => {
      for (const status of ["complete", "failed", "cancelled"] as const) {
        expect(() => cancel(status)).toThrow(InvalidTransitionError);
      }
    });
  });

  describe("conflict resolution", () => {
    it("re-queues the mutation when the local version wins", () => {
      expect(resolveConflict("conflicted", "local")).toEqual({
        status: "pending",
        attemptCount: 0,
      });
    });

    it("completes the operation when the remote version wins", () => {
      expect(resolveConflict("conflicted", "remote")).toEqual({
        status: "complete",
      });
    });

    it("refuses to resolve a conflict for a non-conflicted operation", () => {
      expect(() => resolveConflict("pending", "local")).toThrow(
        InvalidTransitionError,
      );
    });
  });

  describe("terminal states", () => {
    it("identifies terminal and non-terminal states", () => {
      expect(isTerminal("complete")).toBe(true);
      expect(isTerminal("failed")).toBe(true);
      expect(isTerminal("cancelled")).toBe(true);
      expect(isTerminal("pending")).toBe(false);
      expect(isTerminal("syncing")).toBe(false);
      expect(isTerminal("conflicted")).toBe(false);
    });
  });

  describe("retry policy", () => {
    it("retries a pending operation within budget only", () => {
      expect(shouldRetry("pending", 0, MAX_ATTEMPTS)).toBe(true);
      expect(shouldRetry("pending", MAX_ATTEMPTS, MAX_ATTEMPTS)).toBe(false);
      expect(shouldRetry("conflicted", 0, MAX_ATTEMPTS)).toBe(false);
    });

    it("backs off exponentially and caps", () => {
      expect(backoffMs(1)).toBe(1000);
      expect(backoffMs(2)).toBe(2000);
      expect(backoffMs(3)).toBe(4000);
      expect(backoffMs(20)).toBe(60_000);
    });
  });
});
