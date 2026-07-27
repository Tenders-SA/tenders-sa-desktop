# ADR: Offline Operation State Machine (TASK-0.6)

- **Status**: accepted
- **Refs**: REQ-7, REL-1, REL-2; design.md §Sync State Machine

## Pre-check: TASK-0.5 tables match the design

`sync_operations` and `sync_conflicts` (created in
`src-tauri/migrations/0001_init.sql`) carry every field this state
machine needs: operation id, idempotency key, entity type/id, base
payload, `depends_on`, `status`, `attempt_count`, `last_error`, and
timestamps; conflicts carry both `local_version` and `remote_version`
plus a `resolution_state`. The `status` CHECK constraint already
enumerates exactly the six states design.md's diagram defines, so the
database and this module cannot drift apart silently -- an invalid
status is rejected by SQLite regardless of what calling code does.

**Transaction APIs**: `tauri-plugin-sql` exposes `execute`/`select`
only -- it has no transaction/savepoint API surface across the IPC
boundary. This module is therefore written as *pure transition
functions* that compute the next state, with persistence left to the
caller as a single-statement `UPDATE`. That keeps each state change
atomic at the statement level (which is all SQLite needs here) without
pretending we have multi-statement transactions we cannot actually
open. A future task that genuinely needs multi-table atomicity will
need a native Rust command instead; that is noted rather than faked.

## The state machine

```
PENDING → SYNCING → COMPLETE
   │          │
   │          ├── transient → PENDING (bounded backoff)
   │          ├── conflict ─→ CONFLICTED
   │          └── terminal ─→ FAILED
   └── cancelled by user ───→ CANCELLED
```

`src/services/sync/state-machine.ts` implements this as pure
functions (`startSync`, `resolveAttempt`, `cancel`, `resolveConflict`)
that take the current status and return the next one, throwing
`InvalidTransitionError` for any transition the diagram doesn't allow.
Because they're pure, every edge is unit-testable without a database,
a network, or a running app -- `sync-state-machine.test.ts` covers all
16 of them, including the negative cases (you cannot start a
non-pending operation, resolve an attempt for one that isn't syncing,
or cancel one already in a terminal state).

`SyncOutcome` is the vocabulary the transport (TASK-0.7) will use to
report what happened: `success`, `transient`, `conflict`, or
`terminal`. Classifying a failure is the transport's job (it knows
about HTTP status codes); deciding what that classification *means for
the queue* is this module's job. Keeping the two separate means retry
policy lives in exactly one place.

Retries are bounded (`shouldRetry`) with capped exponential backoff
(`backoffMs`: 1s, 2s, 4s… max 60s). A `terminal` outcome never
retries -- re-sending a request the server has already rejected as
invalid just burns attempts.

## No silent overwrites

A `conflict` outcome moves the operation to CONFLICTED and stops.
There is deliberately no code path that resolves a conflict by
overwriting: `recordConflict` persists **both** versions, and
`resolveConflict` requires the caller to state explicitly which one
wins. Choosing `local` re-queues the mutation (back to PENDING with a
reset attempt count); choosing `remote` completes the operation as
superseded. Either way both versions remain on the `sync_conflicts`
row afterwards for audit -- `markConflictResolved` only sets
`resolution_state`/`resolved_at`, and its `WHERE` clause guards
against re-resolving an already-decided conflict, which would discard
a recorded human decision.

`requiresHumanResolution` flags `proposal` and `pricing` entity types,
per design.md's rule that those conflicts require explicit human
resolution. It's exposed now so the UI task that surfaces conflicts
cannot forget it; no automatic resolution policy exists for any entity
type yet, so nothing currently bypasses it.

## Dependency ordering

`src/services/sync/ordering.ts` topologically orders pending
operations so a mutation never runs before the one it depends on
(REQ-7), falling back to oldest-first for independents. Three cases
matter and are tested:

- A dependency that is already `complete` is satisfied.
- A dependency that `failed` or was `cancelled` **blocks** its
  dependents indefinitely rather than letting them run — applying a
  mutation whose precondition never happened is exactly the kind of
  silent corruption REL-1 prohibits. Same for a dependency that is
  missing from the queue entirely.
- A dependency cycle raises `DependencyCycleError` instead of looping
  forever.

## Not built yet

There is no runner/scheduler that actually drives operations through
these transitions — that needs the API transport (TASK-0.7) to exist
first, since "attempt the operation" means "issue a validated
request." This task deliberately delivers the decision logic and its
tests only, rather than a runner wired to a transport that doesn't
exist. The `sync_conflicts` repository functions live here (in
`conflicts.ts`) rather than in `src/db/repositories/`, since this is
the task that first consumes that table, as anticipated in
`docs/architecture/local-data.md`.
