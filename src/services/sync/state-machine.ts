import type { SyncOperationStatus } from "../../db/schema/types";

/**
 * Why a SYNCING attempt ended. The transport (TASK-0.7) classifies its
 * failures into these; the state machine decides what each one means
 * for the queue, so retry/conflict policy lives in one place rather
 * than being re-derived at every call site.
 */
export type SyncOutcome =
  | { kind: "success" }
  | { kind: "transient"; error: string }
  | { kind: "conflict" }
  | { kind: "terminal"; error: string };

export type SyncTransition =
  | { status: "pending"; attemptCount: number; lastError?: string }
  | { status: "syncing"; attemptCount: number }
  | { status: "complete" }
  | { status: "conflicted" }
  | { status: "failed"; lastError: string }
  | { status: "cancelled" };

export class InvalidTransitionError extends Error {
  constructor(from: SyncOperationStatus, action: string) {
    super(`cannot ${action} an operation in state '${from}'`);
    this.name = "InvalidTransitionError";
  }
}

/** Terminal states never transition again. */
const TERMINAL: readonly SyncOperationStatus[] = [
  "complete",
  "failed",
  "cancelled",
];

export function isTerminal(status: SyncOperationStatus): boolean {
  return TERMINAL.includes(status);
}

/**
 * PENDING -> SYNCING. Increments the attempt counter so bounded
 * backoff (see `shouldRetry`) has something to count against.
 */
export function startSync(
  status: SyncOperationStatus,
  attemptCount: number,
): SyncTransition {
  if (status !== "pending") {
    throw new InvalidTransitionError(status, "start syncing");
  }
  return { status: "syncing", attemptCount: attemptCount + 1 };
}

/**
 * Resolves a SYNCING attempt per design.md's state machine:
 *   success   -> COMPLETE
 *   transient -> PENDING (bounded backoff) or FAILED once exhausted
 *   conflict  -> CONFLICTED (never a silent overwrite)
 *   terminal  -> FAILED
 */
export function resolveAttempt(
  status: SyncOperationStatus,
  attemptCount: number,
  outcome: SyncOutcome,
  maxAttempts: number,
): SyncTransition {
  if (status !== "syncing") {
    throw new InvalidTransitionError(status, "resolve an attempt for");
  }
  switch (outcome.kind) {
    case "success":
      return { status: "complete" };
    case "conflict":
      return { status: "conflicted" };
    case "terminal":
      return { status: "failed", lastError: outcome.error };
    case "transient":
      return attemptCount >= maxAttempts
        ? { status: "failed", lastError: outcome.error }
        : { status: "pending", attemptCount, lastError: outcome.error };
  }
}

/**
 * User-initiated cancellation. Allowed only before an operation
 * reaches a terminal state; an in-flight SYNCING operation may be
 * cancelled, since the queue re-checks status before applying a
 * result.
 */
export function cancel(status: SyncOperationStatus): SyncTransition {
  if (isTerminal(status)) {
    throw new InvalidTransitionError(status, "cancel");
  }
  return { status: "cancelled" };
}

/**
 * A CONFLICTED operation leaves that state only by explicit
 * resolution (REQ-7): the caller states which version won, and both
 * versions remain recorded in sync_conflicts either way.
 */
export function resolveConflict(
  status: SyncOperationStatus,
  resolution: "local" | "remote",
): SyncTransition {
  if (status !== "conflicted") {
    throw new InvalidTransitionError(status, "resolve a conflict for");
  }
  // Re-applying the local version means re-queueing the mutation;
  // accepting the remote version means the local mutation is
  // superseded and the queue entry is done.
  return resolution === "local"
    ? { status: "pending", attemptCount: 0 }
    : { status: "complete" };
}

export function shouldRetry(
  status: SyncOperationStatus,
  attemptCount: number,
  maxAttempts: number,
): boolean {
  return status === "pending" && attemptCount < maxAttempts;
}

/** Exponential backoff, capped, for transient retries (REL-2). */
export function backoffMs(
  attemptCount: number,
  baseMs = 1000,
  maxMs = 60_000,
): number {
  if (attemptCount < 1) {
    return baseMs;
  }
  return Math.min(baseMs * 2 ** (attemptCount - 1), maxMs);
}
