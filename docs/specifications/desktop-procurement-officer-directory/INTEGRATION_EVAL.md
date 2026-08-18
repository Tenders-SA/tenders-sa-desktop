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
| R-P1 | TASK-1.5 | Nav item "Procurement Officers" (`UserSearch`, `/procurement-officers`, `available: true`) below Supplier Intelligence in `navigation-items.ts`; shell reachability assertions updated. |
| R-P2 | TASK-1.5 | `/procurement-officers` registered in `routes.tsx` (REQ-16 satisfied); feature code in `src/features/procurement-officers/`. |
| R-P3 | TASK-1.1 | `src/services/api/endpoints/procurement-officers.ts` with zod-per-endpoint validation (search, detail, tenders, sync, corrections); fixtures encode masked summaries, tombstones, cursor pagination, envelope; parity guard locked to parent fixtures. |
| R-P4 | TASK-1.2 | Migration `0005_procurement_officers.sql` (owner-scoped tables + `procurement_officers_fts` FTS5 + indexes); FTS5 pre-check passed; contentless→regular FTS5 deviation recorded. |
| R-P5 | TASK-1.4 | Cursor-resume runner (`limit: 200`), tombstone → local removal of officer + linked rows, 404 → `off`, 403 → `entitlement-missing` (index read-only), no overlapping runs; `useOfficerSync` boot sync + 15-min cadence (TASK-1.5). |
| R-P6 | TASK-1.2/1.3 | Every officer/saved/notes/sync-state row carries the workspace owner id (matches `workspace-owner.ts`); repository queries owner-scoped; verified in owner-scoped repository tests. |
| R-P7 | TASK-1.6 | 200 ms debounce; local FTS5 pass first, coalesced server refresh after settle; merged rows never carry a value the local index lacks (local values win, server wins on status/organisation/tenders count/freshness). |
| R-P8 | TASK-1.6 | Province, organisation, role/title, kind, status filters; organisation/role suspend the local pass (server-side filter), kind/status post-filter merged rows. |
| R-P9 | TASK-1.6 | `officer-quality.ts` thresholds (12/24 months from `lastSeenAt`) → Verified / Recently observed / Historical / Unverified; `QualityLabel` chip with honest copy. |
| R-P10 | TASK-1.7 | `useOfficerDetail` local-first merge; headline assignment = `is_current DESC, valid_from DESC` (never stale); organisation + physical address; official contacts; related tenders; organisation profile link (latent — routes pass no `ownCompanyId`; limitation recorded). |
| R-P11 | TASK-1.7 | `OfficerActions`: copy email/telephone, mailto, save/unsave, private notes (`officer_notes` upsert), view tenders. |
| R-P12 | TASK-1.8 | `CorrectionDialog` → `POST /api/v1/procurement-officers/[id]/corrections`; `officerSuppressedFields` pending marker keyed `${officerId}:${field}`; `pruneSuppressed` never re-shows before a later sync drops the value; explicit 404/400 error states. |
| R-P13 | TASK-1.7 | Copy/export per contact only; no "export all" affordance anywhere in the feature. |
| R-P14 | TASK-1.7 | Directory data consumed for the officer directory only; no marketing affordance, consent, or mail-merge UI exists. |
| R-P15 | TASK-1.5/1.9 | Parent 404 → feature-off state: honest "not yet available" copy; nav item remains; app never crashes. |
| R-P16 | TASK-1.9 | Sync 403 → orange entitlement banner; local index read-only at last good state; search still works against the server (screen test: `keeps search working under the entitlement banner`). |
| R-P17 | TASK-1.9 | Local FTS5 search works offline (screen test with offline ApiError); freshness banner shows the last sync time (`shows the offline banner with the last sync time`); server refresh silently degrades. |
| R-P18 | TASK-1.9 | `saved_officers` persisted per account via the repository; recent searches under `officerRecentSearches` in `local_preferences` (cap 10); `Saved only` toggle + honest empty state. |

Contract items C1..C10 (SPEC_CONTRACT): C1=TASK-1.1 (parent contracts only), C2=TASK-1.1 (zod boundary), C3=TASK-1.2 (migration + FTS5 pre-check), C4=TASK-1.3 (repository), C5=TASK-1.4 (runner), C6=TASK-1.5 (nav + route), C7=TASK-1.6 (search), C8=TASK-1.7 (detail + actions, no bulk export), C9=TASK-1.8 (corrections), C10=TASK-1.9/1.10 (states, saved officers, gates + this table + CHANGELOG entry).

## Spec status log

| Date | Status |
|---|---|
| 2026-08-16 | Created (PENDING APPROVAL) — desktop sync at `91340b0`; branch `spec/desktop-procurement-officer-directory`. |
| 2026-08-16 | APPROVED by user (in-session directive). Implementation may start at TASK-1.1. |
| 2026-08-16 | TASK-1.1 committed (`c4d4185`): endpoint contracts locked with fixtures; parity guard updated for the sync feed's cursor pagination. |
| 2026-08-16 | TASK-1.2 committed: schema + FTS5 pre-check passed (bundled SQLite compiles FTS5); contentless→regular FTS5 deviation recorded. |
| 2026-08-16 | TASK-1.3 committed (`27c4c94`): local repository with FTS search; parity guard exempts sync-state persistence files. |
| 2026-08-16 | TASK-1.4 committed (`df4df80`): cursor-resume runner; 404→off / 403→entitlement-missing; in-flight run sharing. |
| 2026-08-17 | TASK-1.5 committed (`19b704e`): nav item + `/procurement-officers` route; `useOfficerSync` (one runner per account, boot sync, 15-min cadence); shell screen with sync state; reachability/app-shell assertions updated. |
| 2026-08-17 | TASK-1.6 committed (`6dbf60e`): local-first search surface — `useOfficerSearch` (200 ms debounce, coalesced server refresh, honest filter split: organisation/role suspend the local pass, kind/status post-filter server rows), `mergeOfficerRows` (server wins on status/organisation/tenders count, local freshness), `officer-quality` thresholds + `QualityLabel` chip, recent searches persisted under `officerRecentSearches` (cap 10). Hook (10) + screen (12) tests green; parity guard extended with sync runner + fixture files; full suite 60/60; tsc/eslint clean. |
| 2026-08-17 | TASK-1.7 committed (`88c7056`): detail panel + actions — `useOfficerDetail` (local-first merge: unmasked local contacts/assignments authoritative; server contributes organisation address, evidence summary, rich tenders; masked server contacts only when the local index is empty, flagged `masked`; headline = `is_current DESC, valid_from DESC`, never a stale assignment; refresh failure keeps the local record in `error` phase), `OfficerDetailPanel` (headline assignment, organisation + physical address, official contacts, related tenders, Back) and `OfficerActions` (copy email/telephone, mailto, save toggle, private notes via `officer_notes` upsert, view tenders). Row selection replaces the list; no bulk export (R-P13). Organisation profile link resolves to desktop `/company` only when `ownCompanyId` matches — routes pass no `ownCompanyId` today, so the affordance is currently latent; documented as a limitation. Hook (11) + panel (15) + screen (13) tests green; full suite 998/998; tsc/eslint clean. |
| 2026-08-17 | TASK-1.8: corrections + pending suppression — `CorrectionDialog` (field + reason → `POST /api/v1/procurement-officers/[id]/corrections`; pending status copy; explicit 404/400 rejection messages; per-field Report affordances in the panel), `useOfficerCorrections` (`officerSuppressedFields` map in `local_preferences`, keyed `${officerId}:${field}` with the disputed value; `pruneSuppressed` expires a marker only when a later sync no longer carries the value — never re-shown before resolution; pruning auto-persists). Panel hides disputed email/telephone/mobile contacts, title, organisation and name while the value is carried. Hook (7) + dialog (6) + panel (19) + screen (14) tests green; full suite 1016/1016; tsc/eslint clean. |
| 2026-08-17 | TASK-1.9 committed (`4c95e27`): feature states + saved officers — `useOfficerSearch` gains a local `saved` filter (`applySavedFilter`, applied after merge; `hasAnyFilter` unchanged) and the directory renders honest states: entitlement banner (orange, search still works against the server — index read-only), offline alert appending the last sync time when known, and a `Saved only` toggle with a dedicated empty state. Post-boot sync read intentionally skipped under `entitlement-missing` (lastSyncAt kept from the view), so the local FTS pass shifts one select earlier in that state — tests seed accordingly; the `Saved only` toggle re-runs the pipeline (one extra local pass). Screen (18) tests green; full suite 1020/1020; tsc/eslint clean. |
| 2026-08-17 | TASK-1.10: quality gates + handoff — full `vitest` 64 files / 1020 tests green, `tsc --noEmit` clean, `eslint . --max-warnings 0` clean, `prettier --check .` clean; traceability table filled (R-P1..R-P18 with task + evidence; C1..C10 mapped); CHANGELOG entry added; manual Tauri smoke remains a user gate. |