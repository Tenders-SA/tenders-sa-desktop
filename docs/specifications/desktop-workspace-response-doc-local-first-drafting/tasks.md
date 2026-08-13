# Desktop Workspace — Response Document Local-First Drafting — Tasks (Slice 10)

Status legend: `[ ]` open · `[x]` done. Implementation order is top-down. Tasks
reference requirements LD-1..LD-4. **Dependency**: Slice 8 (shared helper) merged.
**Gate**: this slice amends the canonical SEC-1 — implementation must not start
while `SPEC_CONTRACT.md` is `PENDING APPROVAL`.

## T1 — Additive schema + repositories

- **Pre-check**: `src-tauri/migrations/*` and `src/db/schema/types.ts` read;
  migration naming convention noted.
- **Files**: `src-tauri/migrations/0003_response_doc_drafts.sql`,
  `src/db/schema/types.ts`, new `src/db/repositories/response-doc-drafts.ts`,
  new `src/db/repositories/response-doc-versions.ts`.
- **Work**:
  1. Add `response_doc_drafts` and `response_doc_versions` tables (additive only,
     encrypted `content` columns) (LD-1, LD-3).
  2. Add row types; write upsert/get/delete + insert/list/prune repositories.
- **Verification**: `pnpm exec vitest run src/tests/db-repositories.test.ts` (extended)
  — repository behaviour against a fake `SqlExecutor`; `cargo check` if Rust touched.

## T2 — Persistence store + save-path wiring

- **Pre-check**: T1 merged; `use-response-blueprint-workspace.ts` read.
- **Files**: new `src/services/storage/response-doc-store.ts`,
  `src/features/applications/workflow/use-response-blueprint-workspace.ts`.
- **Work**:
  1. Implement debounced `persistDraft` / `loadDraft` / `clearDraft` and
     `snapshotVersion` / `restoreVersion` over the repositories (LD-1, LD-3).
  2. `save()` clears the local draft and snapshots the previous content on
     success; on offline/timeout failure enqueues the save via
     `enqueueSyncOperation` and returns a "pending sync" result (LD-2).
  3. Generate is never enqueued.
- **Verification**: `pnpm exec vitest run` new store + hook tests — draft persisted
  and cleared on save; offline save enqueued; generate not enqueued.

## T3 — Replay + UI indicators

- **Pre-check**: T2 merged; `sync-operations.ts` repository read.
- **Files**: `src/services/storage/response-doc-store.ts`,
  `src/features/applications/workflow/ResponseDocumentEditor.tsx`.
- **Work**:
  1. `replayPendingSaves(executor, endpoint)` replays pending response-doc saves
     in order, updating queue status (LD-2); wired to reconnect / explicit "Sync now".
  2. Editor shows "unsaved local draft" on restore and "Saved locally — pending
     sync" after an offline save; add "View history / Restore" control (LD-1/2/3).
- **Verification**: `pnpm exec vitest run` screen + sync-replay tests — restore,
  pending-sync indicator, restore-version-without-PUT.

## T4 — Full gates + changelog

- **Pre-check**: T1–T3 merged.
- **Files**: tests; `CHANGELOG.md` (local draft recovery, offline save queue,
  version history).
- **Verification**: `pnpm exec vitest run`, `pnpm exec tsc --noEmit`,
  `pnpm exec eslint .`, `pnpm exec prettier --check .` — zero errors; `cargo check`
  if Rust changed.

## T5 — Live verification (human)

- **Pre-check**: T4 merged; app running via `pnpm tauri dev`.
- **Work**: user confirms draft survives restart, offline save queues and syncs,
  and a regeneration can be rolled back via history.
- **Verification**: user sign-off recorded in `INTEGRATION_EVAL.md`.

## Status (2026-08-13)

- T1: DONE - `0003_response_doc_drafts.sql`; `ResponseDocDraftRow` /
  `ResponseDocVersionRow` types; `response-doc-drafts` (upsert/get/delete) and
  `response-doc-versions` (insert/list/prune) repositories; `upsertSyncOperation`
  (idempotency-key upsert) added to the existing sync-operations owner.
- T2: DONE - `response-doc-store.ts` (`createResponseDocStore` +
  `createTauriResponseDocStore`); DraftStage wires the store; save clears the
  local draft and snapshots the previous content (source `save`); offline/timeout
  saves enqueue via `upsertSyncOperation` and surface "pending sync" instead of
  an error; Generate is never enqueued.
- T3: DONE - `replayPendingSaves` replays oldest-first through the workspace
  save, marking transient failures pending and hard failures failed; editor shows
  "Unsaved local draft restored", "Saved locally — pending sync" + Sync now, and
  "Local history" with Restore (disabled while dirty).
- T4: DONE - full suite 831/831, `tsc --noEmit`, `eslint`, `prettier --check`
  clean; `CHANGELOG.md` updated.
- T5: OPEN - human verification pending (requires `pnpm tauri dev`).
