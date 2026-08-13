# Desktop Workspace — Response Document Local-First Drafting — Requirements (Slice 10)

## Context note

### Recent related work

- Slice 8 (`desktop-workspace-response-doc-editor-hardening`) and Slice 9
  (`desktop-workspace-response-doc-authoring-enhancements`) harden and extend
  the full-screen editor. This slice adds local persistence underneath them.
- The canonical `desktop-tender-assistance-workflow` spec's SEC-1 states "Draft
  text stays in component memory until explicit Save", and its non-goals state
  "No automatic save of response content. Explicit Save remains the authority."
  This slice is a **deliberate, user-approved amendment** to that constraint —
  it persists drafts *locally* (not to the parent) for crash recovery and
  offline editing, while leaving the parent save (PUT) as the only authority.

### Reality check

- **Decision: Enhance Existing.** The SQLite layer already defines the local
  tables (`cache_entries`, `local_preferences`, `sync_operations`,
  `sync_conflicts`, `local_file_references`) and repositories
  (`src/db/repositories/*`). `sync_operations` is referenced only by
  `tests/db-repositories.test.ts` — the queue is built but wired to no feature
  (finding G4). `native-crypto.ts` provides at-rest encryption.
- The response editor holds its draft only in React state
  (`ResponseDocumentEditor.tsx:21`) and saves via a direct PUT
  (`use-response-blueprint-workspace.ts:92-98`). There is no crash recovery, no
  offline editing, and no rollback of a regeneration (findings G4, G8).

## Objective

- **Why:** A bidder under deadline must not lose an in-progress response to a
  crash or a lost connection, and must be able to undo a bad regeneration.
- **Goal:** Persist unsaved drafts locally, queue saves when offline, and record
  a local snapshot of each saved version so it can be restored — all desktop-only,
  with the parent remaining the single source of truth.
- **Primary outcome:** Editing a response document survives app restarts and
  connectivity loss, and a prior saved version is always recoverable.

## Non-goals

- No new parent API, schema, field, migration, prompt, embedding, vector,
  extraction or generation path.
- No automatic **parent** save. The PUT remains the only path to the parent, and
  only an explicit human press triggers it.
- No offline **generation**. AI generation requires the parent (subscription
  check + inference); it is never queued or replayed offline.
- No multi-user collaboration, no conflict resolution UI beyond the existing
  `sync_conflicts` scaffold.
- No WYSIWYG or second document format.

## Functional requirements

### LD-1 — Local draft persistence (G4)

Unsaved editor content is persisted to local SQLite, keyed by
`applicationId` + `documentKey`, independently of the parent:

- on every edit (debounced), the current draft is written to a local
  `response_doc_drafts` table (at-rest encrypted via the existing
  `native-crypto` pattern);
- on reopening the editor, the locally persisted draft is restored when it
  differs from the last parent-served content, and the editor shows an honest
  "unsaved local draft" indicator;
- a successful parent save clears the local draft for that key; Revert restores
  the last parent-confirmed content and clears the local draft;
- local persistence never triggers a parent mutation and never runs on a
  document the user has not edited.

### LD-2 — Offline save queue (G4)

When a save (PUT `saveResponseDocument`) fails because the app is offline or the
request times out, the save is enqueued:

- enqueued to the existing `sync_operations` queue with an idempotency key and
  `entity_type`/`operation_type` identifying the response-document save; the
  editor shows "Saved locally — pending sync";
- on reconnect (or explicit retry), pending response-document saves are replayed
  through the existing `saveResponseDocument`, in order, using the queue's
  status tracking (`pending → syncing → complete/failed/conflicted`);
- **only saves are queued** — Generate is never enqueued (it would re-spend AI
  inference and cannot pass the subscription check offline);
- a replayed save is idempotent by the queue's `idempotency_key` guard (REQ-7
  of the sync repository).

### LD-3 — Local version history and rollback (G8)

- on each successful parent save, the *previous* content is captured as a local
  snapshot (`response_doc_versions`, keyed by applicationId + documentKey, with
  timestamp + source: `save` | `generate` | `restore`);
- the editor offers "View history" and "Restore" so a prior saved version (or
  the pre-regeneration content) can be recovered;
- restore copies a snapshot back into the editor draft (and, on the user's next
  explicit Save, to the parent) — it never silently overwrites the parent;
- history is local-only, bounded (e.g. a cap per document), and pruned on
  application archival (matching the parent's existing archive behaviour).

### LD-4 — Amendment to SEC-1 and security

- This spec **supersedes** the canonical `desktop-tender-assistance-workflow`
  SEC-1 ("Draft text stays in component memory until explicit Save") and its
  "No automatic save of response content" non-goal **for local persistence
  only**. The parent save remains explicit. This amendment requires explicit
  user approval, recorded in `SPEC_CONTRACT.md`.
- Draft content is never written to logs, analytics, URLs, browser storage, or
  the parent beyond the existing PUT (canonical REQ-7). Local rows are
  encrypted at rest; keys and content never appear in plaintext SQLite.

## Non-functional requirements

- SQLite-only; additive migrations (new tables, no column drops/renames).
- Debounced writes; no write storm while typing (one row per key, upserted).
- Encryption at rest reuses `native-crypto`; no secrets in plaintext.
- No new timers beyond the debounce and the existing bounded generation refresh.
- Accessibility: pending-sync and unsaved-local indicators use text, not colour
  alone.

## Integration requirements

- Extend `use-response-blueprint-workspace` (or a thin `response-doc-store`
  service it owns) to read/write the new repositories through `SqlExecutor`.
- Reuse the existing `sync_operations` repository and `SqlExecutor`; do not
  create a second queue.
- Additive migration `0003_response_doc_drafts.sql` mirroring the schema types
  in `src/db/schema/types.ts`.

## Success criteria

- A crash/restart with unsaved edits restores the draft and shows "unsaved local
  draft"; a successful save clears it.
- An offline save shows "Saved locally — pending sync" and replays on reconnect;
  a Generate is never queued.
- A regeneration can be undone via View history → Restore; history is bounded.
- `vitest`, `tsc --noEmit`, `eslint`, `prettier --check` (and `cargo check` for
  any Rust touched) pass; new repository + screen tests cover LD-1..LD-3.
