# Desktop Workspace — Response Document Local-First Drafting — SPEC_CONTRACT (Slice 10)

- **Status**: `APPROVED`
- **Date**: 2026-08-13
- **Scope**: Slice 10 — local-first drafting (LD-1..LD-4). Closes gap-analysis
  findings G4 and G8.
- **Approved by**: user (2026-08-13)

> **Amendment notice (LD-4):** This slice supersedes the canonical
> `desktop-tender-assistance-workflow` SEC-1 ("Draft text stays in component
> memory until explicit Save") and its "No automatic save of response content"
> non-goal **for local persistence only**. The parent PUT remains the sole
> authority and is still triggered only by an explicit human press. Approval of
> this contract constitutes approval of that amendment.

## Contract checklist (mirrors tasks.md)

| # | Item | Contract |
|---|---|---|
| C1 | Additive schema | `0003_response_doc_drafts.sql` adds `response_doc_drafts` + `response_doc_versions`; no drops/renames (LD-1, LD-3) |
| C2 | Local draft persistence | debounced encrypted upsert; restore on open with "unsaved local draft" flag; cleared on save/revert; never a parent mutation (LD-1) |
| C3 | Offline save queue | offline/timeout save → `sync_operations` (idempotent), "Saved locally — pending sync"; replay in order on reconnect; Generate never queued (LD-2) |
| C4 | Version history | snapshot previous content on each save; "View history / Restore" places content in draft without a PUT; bounded + pruned (LD-3) |
| C5 | Security | content encrypted at rest via `native-crypto`; no plaintext SQLite; no logs/URLs/browser storage (LD-4, canonical REQ-7) |
| C6 | Verification gates | `vitest` full suite, `tsc --noEmit`, `eslint`, `prettier --check` (and `cargo check` if Rust changed) — zero errors (T4) |
| C7 | Human verification | user live-verifies crash recovery, offline sync, version restore; recorded in `INTEGRATION_EVAL.md` (T5) |

## Explicitly out of contract

- Offline **generation** (AI inference requires the parent; never queued).
- Multi-user collaboration and any conflict-resolution UI beyond the existing
  `sync_conflicts` scaffold.
- Parent repo changes: none. No new endpoint, schema, migration, prompt or
  analysis path. All persistence is desktop SQLite.

## Non-negotiable constraints

- Parent PUT remains the single source of truth; local rows are cache/offline
  state only, per the desktop parent-platform boundary.
- No mutation auto-retry; `retry: "never"` unchanged; replay is explicit/idempotent.
- Draft content never in plaintext SQLite, logs, URLs or browser storage.
- Additive migrations only; never drop or rename a column.
- No `npm run build` / `next build` / prisma migrations (repo rule).
