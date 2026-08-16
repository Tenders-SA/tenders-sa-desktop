# Desktop — Procurement Officer Directory — INTEGRATION_EVAL

## Integration points (existing desktop modules)

| Module | How this feature integrates |
|---|---|
| `src/components/navigation/navigation-items.ts` | New item "Procurement Officers" (`UserSearch`, `/procurement-officers`, `available: true`) in the Company and intelligence group below Supplier Intelligence. |
| `src/app/router/routes.tsx` | New route registered; the shell's required-route typing (REQ-16) keeps the nav honest. |
| `src/app/auth-wiring.ts` + `src/services/api/transport.ts` | `procurementOfficers` client added alongside existing clients; same `bearerHeader`/transport/envelope conventions. |
| `src/services/api/endpoints/*` pattern | New `procurement-officers.ts` follows `tenders.ts` (zod at the boundary, E-11-style defensive typing where the parent contract varies). |
| `src/db/executor.ts` + `src/db/repositories/*` + `src-tauri/migrations/*` | New `0005` migration + `procurement-officers.ts` repository using the established `SqlExecutor` model and fakes-based tests. |
| `src/services/sync/*` (coordinator pattern) | Sync runner mirrors `WorkspaceSyncCoordinator`/state-machine conventions; single runner instance via a `useOfficerSync` hook. |
| `src/services/storage/*` (workspace-owner, local_preferences) | Owner-scoped rows; saved officers, notes and recent searches via existing persistence patterns. |
| `src/tests/*` conventions | Endpoint, repository, sync, hook and screen tests follow `tenders-endpoint.test.ts`, `db-repositories.test.ts`, `app-shell.test.tsx` and `module-screens.test.tsx` patterns; `navigation-reachability` sweeps the new item. |

## Parent dependencies (read-only, must be true on the parent branch)

1. **Beta setting `procurementOfficerDirectory`** — when off, every route 404s; the
   desktop renders the feature-off state. No desktop workaround exists by design.
2. **Sync entitlement (`apiAccess`)** — 403 without it; the desktop holds the last
   good local index read-only and surfaces the entitlement-missing banner.
3. **Feed semantics** — unmasked official values; tombstones for suppressed officers;
   server-side audit per page (the desktop deliberately adds no local audit trail).
4. **Masking asymmetry** — search/detail stay masked on the wire; the local index (from
   the feed) is the only unmasked source. This asymmetry is encoded in the schemas and
   drives the "local wins on values" merge rule.
5. **Corrections** — server-side pending review + suppression; the desktop mirrors the
   suppression locally until a later sync no longer carries the field.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Bundled SQLite lacks FTS5 | **RESOLVED (TASK-1.2 pre-check)**: the bundled SQLite compiles `ENABLE_FTS5` (verified by `db::tests::bundled_sqlite_compiles_fts5_and_indexes_officer_search` — `sqlite_compileoption_used('ENABLE_FTS5')` = 1 and a real MATCH query returns the row). No LIKE fallback needed. |
| Feed size / slow first sync | Bounded pages (`limit: 200`), cursor resume, background cadence, last-good-state on failure. |
| Masking semantics drift in the parent | Contracts locked as fixtures in TASK-1.1; schema evolution is caught by the boundary tests before UI code touches values. |
| Stale assignments presented as current | Detail panel orders by parent `isCurrent` desc and renders the headline from the local assignment rows the feed already curates. |
| Re-exposing a disputed value after correction | Local `officerSuppressedFields` marker blocks display until a sync without the field supersedes it. |
| Bulk-export scope creep | Explicit non-goal; no export affordance beyond single-contact copy/mailto; covered by screen tests. |

## Implementation notes (recorded deviations)

- **TASK-1.2**: `procurement_officers_fts` is a **regular (stored) FTS5 table**, not
  contentless (`content=''`) as design.md sketched — contentless FTS5 cannot DELETE
  rows, and tombstone removal + per-officer rebuilds need deletion. Same tokenizer
  (`porter unicode61`), same query surface; the stored `search_text` copy is rebuilt
  transactionally by the repository on ingest.

## Boundary statements

- No parent mutation of any kind; anything the parent does not expose is documented as
  a limitation here and in `requirements.md` (out of scope), per the desktop role
  contract ("consume what exists").
- The desktop does not compute officialness, suppression or identity — it ingests,
  indexes and presents parent-classified facts.
- Admin review queue and directory marketing use remain parent-owned.

## Traceability (filled at TASK-1.10)

| Requirement | Task | Evidence |
|---|---|---|
| R-P1..R-P18 | TASK-1.1..TASK-1.10 | _pending_ |

## Spec status log

| Date | Status |
|---|---|
| 2026-08-16 | Created (PENDING APPROVAL) — desktop sync at `91340b0`; branch `spec/desktop-procurement-officer-directory`. |
| 2026-08-16 | APPROVED by user (in-session directive). Implementation may start at TASK-1.1. |
| 2026-08-16 | TASK-1.1 committed (`c4d4185`): endpoint contracts locked with fixtures; parity guard updated for the sync feed's cursor pagination. |
| 2026-08-16 | TASK-1.2 committed: schema + FTS5 pre-check passed (bundled SQLite compiles FTS5); contentless→regular FTS5 deviation recorded. |