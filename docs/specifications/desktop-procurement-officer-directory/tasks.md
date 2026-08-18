# Desktop — Procurement Officer Directory — Tasks

Read `requirements.md`, `design.md`, this file, `SPEC_CONTRACT.md` and
`INTEGRATION_EVAL.md` completely before writing code. Implement tasks in order. Each
task's pre-check must pass before the task starts; each task's verification must pass
before the next task. Commit subjects are exact; stage only desktop files belonging to
the active task.

## TASK-1.1 — Lock the parent contract with endpoint fixtures

- **Pre-check**: `SPEC_CONTRACT.md` is APPROVED; parent routes exist on the live
  parent branch (read-only confirmation via repo source, not new requests).
- **Do**: `src/services/api/endpoints/procurement-officers.ts` with zod schemas for
  search, detail, tenders, sync, corrections — encoding masked summaries, tombstones
  (empty arrays + `suppressed: true`), cursor pagination and envelope wrappers. Wire
  `procurementOfficers` into `ApiClients` (`auth-wiring.ts`).
- **Verify**: schema tests against fixture payloads (masked summary, tombstone row,
  full sync page, correction response) in `src/tests/procurement-officers-endpoint.test.ts`;
  `vitest` green.
- **Commit**: `feat(procurement-officers/1.1): lock parent contracts with endpoint schemas`

## TASK-1.2 — Local schema: tables + FTS5 (verify FTS5 first)

- **Pre-check**: confirm the bundled SQLite has FTS5 (`pragma compile_options` contains
  `FTS5`) — see design §"FTS5". If absent, record the fallback deviation in
  `INTEGRATION_EVAL.md` and proceed with LIKE + indexes.
- **Do**: `src-tauri/migrations/0005_procurement_officers.sql` per design schema
  (owner-scoped tables, FTS5 virtual table, indexes).
- **Verify**: upgrade test applies 0005 over the 0004 state and the FTS5 table exists
  and accepts a MATCH query; `vitest` green.
- **Commit**: `feat(procurement-officers/1.2): add owner-scoped local index schema and FTS5`

## TASK-1.3 — Repository layer

- **Pre-check**: migration 0005 green.
- **Do**: `src/db/repositories/procurement-officers.ts` — `upsertOfficer` (transactional
  with FTS rebuild), `applyTombstone`, `searchOfficers` (FTS5 MATCH + filters),
  `getOfficer`, `getOfficerTenders`, `getOfficerAssignments`, saved/notes CRUD,
  `getSyncState`/`setSyncState`.
- **Verify**: repository tests over the fakes SQL executor
  (`src/tests/db-repositories.test.ts` conventions) covering upsert, tombstone removal,
  FTS rebuild and owner scoping; `vitest` green.
- **Commit**: `feat(procurement-officers/1.3): add local officer repository with FTS search`

## TASK-1.4 — Incremental sync runner

- **Pre-check**: repository layer green; parent feed contract fixtures green.
- **Do**: `src/services/sync/procurement-officers-sync.ts` — cursor loop
  (`limit: 200`), tombstone → `applyTombstone`, row → `upsertOfficer`, persisted
  `sync_state`, 404 → `featureState: 'off'`, 403 → `featureState: 'entitlement-missing'`
  (read-only last good index), no overlapping runs.
- **Verify**: runner tests with a fake transport — cursor resume, tombstone drop,
  feature-off and entitlement-missing states, no duplicate runs; `vitest` green.
- **Commit**: `feat(procurement-officers/1.4): add incremental sync runner with cursor resume`

## TASK-1.5 — Navigation item + route

- **Pre-check**: sync runner green.
- **Do**: nav item "Procurement Officers" (`UserSearch`, `/procurement-officers`,
  `available: true`) in the Company and intelligence group below Supplier Intelligence;
  route in `routes.tsx`; empty shell screen wired to the sync hook.
- **Verify**: `app-shell.test.tsx` nav assertions updated; `navigation-reachability.test.tsx`
  sweeps the new item; screen renders with sync state; `vitest` green.
- **Commit**: `feat(procurement-officers/1.5): add navigation item and route shell`

## TASK-1.6 — Search UI (local-first + server refresh)

- **Pre-check**: nav item green.
- **Do**: `use-officer-search.ts` (150–250 ms debounce, FTS5 first, coalesced server
  refresh, dedupe by id — server wins on status/freshness, local wins on values);
  search bar, filters (province, organisation, role, kind, status), result rows with
  data-quality label chips (12/24-month thresholds), recent searches.
- **Verify**: search hook tests (debounce, dedupe, filter combination) +
  `procurement-officers-screen.test.tsx` (render, filter, empty state); `vitest` green.
- **Commit**: `feat(procurement-officers/1.6): add local-first search with debounce and filters`

## TASK-1.7 — Detail panel and actions

- **Pre-check**: search UI green.
- **Do**: `OfficerDetailPanel` (headline isCurrent assignment, organisation +
  physicalAddress, official contacts, related tenders), `OfficerActions` (copy
  email/telephone, mailto, save officer, notes, organisation profile link, view
  tenders); local + server refresh.
- **Verify**: detail/actions tests (copy, save, notes persistence, organisation link
  target, stale-assignment ordering); `vitest` green.
- **Commit**: `feat(procurement-officers/1.7): add officer detail panel and actions`

## TASK-1.8 — Corrections and local suppression

- **Pre-check**: detail panel green.
- **Do**: `CorrectionDialog` (field + reason → `POST corrections` → local
  `officerSuppressedFields` marker; field stays hidden until a later sync no longer
  carries it); status/error states.
- **Verify**: correction tests (post payload, pending status, local suppression,
  server 404/400 handling, no re-show on sync before resolution); `vitest` green.
- **Commit**: `feat(procurement-officers/1.8): add correction flow with local pending suppression`

## TASK-1.9 — States: feature-off, entitlement, offline; saved officers; recent searches

- **Pre-check**: corrections green.
- **Do**: `FeatureOff` (parent 404), `EntitlementMissing` (403 banner, read-only
  index), `OfflineBanner` (last sync time); saved-officers list + recent searches via
  `local_preferences`.
- **Verify**: state tests (each state renders honestly, no crash, no fake enabled
  affordance), saved/recent persistence tests; `vitest` green.
- **Commit**: `feat(procurement-officers/1.9): add feature states, saved officers and recent searches`

## TASK-1.10 — Quality gates, traceability and handoff

- **Pre-check**: TASK-1.1..1.9 committed.
- **Do**: full `vitest`, `npx tsc --noEmit`, `eslint .`, `prettier --check .` — zero
  errors; confirm every contract item (SPEC_CONTRACT C1..C10) and requirement
  (R-P1..R-P18) is satisfied and traced; update `INTEGRATION_EVAL.md`; decide
  `CHANGELOG.md` entry (feature → required); manual Tauri smoke is a user gate.
- **Verify**: gates green; traceability table in `INTEGRATION_EVAL.md` complete.
- **Commit**: `feat(procurement-officers/1.10): complete quality gates and handoff`