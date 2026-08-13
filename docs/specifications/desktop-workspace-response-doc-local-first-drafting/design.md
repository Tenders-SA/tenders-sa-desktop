# Desktop Workspace — Response Document Local-First Drafting — Design (Slice 10)

Desktop-only. Additive SQLite schema + a thin store + queue wiring. Requirements
LD-1..LD-4.

## Schema (additive migration)

New `src-tauri/migrations/0003_response_doc_drafts.sql`; mirror rows in
`src/db/schema/types.ts`:

- `response_doc_drafts` — `application_id`, `document_key`, `content`
  (encrypted), `updated_at`; PK `(application_id, document_key)`.
- `response_doc_versions` — `id`, `application_id`, `document_key`, `content`
  (encrypted), `source` (`save|generate|restore`), `created_at`; indexed on
  `(application_id, document_key)`.

Both `content` columns are encrypted at rest via the existing `native-crypto`
helper (same pattern as `cache_entries.encrypted`).

## Repositories

`src/db/repositories/response-doc-drafts.ts`:

- `upsertDraft(executor, {applicationId, documentKey, content, encrypted})`
- `getDraft(executor, applicationId, documentKey)`
- `deleteDraft(executor, applicationId, documentKey)`

`src/db/repositories/response-doc-versions.ts`:

- `insertVersion(...)`, `listVersions(...)` (bounded), `getVersion(id)`,
  `pruneVersions(...)` (cap per document).

`sync_operations` repository is reused unchanged (LD-2) — no new queue.

## Store — one persistence owner

New `src/services/storage/response-doc-store.ts` (or a hook-level owner inside
`use-response-blueprint-workspace`) with `SqlExecutor` injected:

- `persistDraft(applicationId, key, content)` — debounced upsert (LD-1);
- `loadDraft(applicationId, key)` — restore on open, compare against parent
  content, return a `localDirty` flag;
- `clearDraft(applicationId, key)` on successful save/revert;
- `snapshotVersion(...)` before each successful save (LD-3);
- `restoreVersion(id)` → returns content to place into the draft (LD-3).

`use-response-blueprint-workspace.save()` becomes the single write path: on
success it clears the local draft and snapshots the previous content; on a
network/offline/timeout failure it enqueues the save (LD-2).

## Offline queue wiring (LD-2)

- `save()` catches `ApiError` of kind `offline`/`timeout` (and network errors),
  calls `enqueueSyncOperation(executor, { idempotencyKey, entityType:
  "response-doc", entityId: key, operationType: "save", payload: {applicationId,
  key, content} })`, and returns a "pending sync" result to the UI.
- A small `replayPendingSaves(executor, endpoint)` runs on reconnect / explicit
  "Sync now": lists `pending` response-doc ops, replays via
  `saveResponseDocument`, updates status (`complete`/`failed`) with `lastError`.
- Generate (`generateResponseDocument`) is never enqueued (LD-2 non-goal).

## UI

- `ResponseDocumentEditor.tsx` gains an "unsaved local draft" indicator (restored
  from the store) and a "Saved locally — pending sync" state after an offline
  save (LD-1, LD-2).
- A "View history / Restore" control lists local versions and restores one into
  the draft (LD-3). Restore is explicit; it does not PUT until the next Save.

## Files touched

| File | Change |
|---|---|
| `src-tauri/migrations/0003_response_doc_drafts.sql` | new — two additive tables |
| `src/db/schema/types.ts` | + `ResponseDocDraftRow`, `ResponseDocVersionRow` |
| `src/db/repositories/response-doc-drafts.ts`, `response-doc-versions.ts` | new repositories |
| `src/services/storage/response-doc-store.ts` | new — persistence/snapshot/queue owner |
| `src/features/applications/workflow/use-response-blueprint-workspace.ts` | save path → store + queue on failure |
| `src/features/applications/workflow/ResponseDocumentEditor.tsx` | local-draft + pending-sync + history UI |
| `src/tests/*` | repository + screen + sync-replay tests |

## Tests

- Repository tests against a fake `SqlExecutor`: draft upsert/get/delete;
  version insert/list/prune.
- Screen tests: offline save → "pending sync"; restart restores draft; Revert
  clears draft; restore version places content in draft without a PUT.
- Sync-replay test: enqueued saves replay in order with idempotency; generate is
  never enqueued.

## Backward compatibility

Additive only: no column drop/rename. Existing editors that never call the store
behave exactly as today (the store is opt-in through `use-response-blueprint-workspace`).
