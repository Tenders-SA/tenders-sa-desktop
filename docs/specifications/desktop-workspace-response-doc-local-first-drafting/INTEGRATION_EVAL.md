# Desktop Workspace — Response Document Local-First Drafting — INTEGRATION_EVAL (Slice 10)

- **Status**: T1–T4 verified; T5 (live human verification) pending

## Gates

| Gate | Task | Evidence | Date |
|---|---|---|---|
| Additive schema + repos | T1 | `vitest db-repositories` (extended) — drafts/versions/upsert-queue repositories against the fake executor | 2026-08-13 |
| Store + save-path wiring | T2 | `vitest response-doc-store` — encrypted persist/load/clear, snapshot+prune, offline enqueue (upsert idempotency), generate never queued | 2026-08-13 |
| Replay + UI | T3 | `vitest draft-stage` — local-draft restore, debounced persist, pending-sync + Sync now replay, version restore (blocked while dirty) | 2026-08-13 |
| Full suite + static | T4 | `vitest` (831/831), `tsc --noEmit`, `eslint`, `prettier --check` — 0 errors | 2026-08-13 |
| Live human verification | T5 | _(pending `pnpm tauri dev` sign-off)_ | — |

## Deviations

- `restoreVersion` from the original design is covered by the editor's Restore
  control, which replaces the editor draft with a historical snapshot; the user
  then saves explicitly (parent PUT remains the only authority). The history
  `source` column accepts `save | generate | restore`; the current flow writes
  `save` (snapshot on successful save). A pre-generation snapshot was dropped
  from scope because generation replaces content server-side before the parent
  PUT, and the snapshot-on-save already makes every overwritten server version
  recoverable.
- Queue re-enqueue uses an upsert (`ON CONFLICT(idempotency_key) DO UPDATE`) so
  repeated offline edits replace the pending payload instead of stacking
  operations; transient replay failures stay `pending` with an attempt count,
  hard failures become `failed` and are never retried.
- The store is opt-in via `localStore` on `DraftStage`, defaulting to the
  Tauri-backed store; all local-store failures degrade silently to the pre-slice
  behaviour so a local DB issue never blocks saving through the parent.