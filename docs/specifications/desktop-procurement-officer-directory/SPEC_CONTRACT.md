# Desktop — Procurement Officer Directory — SPEC_CONTRACT

- **Status**: `APPROVED`
- **Date**: 2026-08-16
- **Scope**: Build the Procurement Officer Directory on the desktop: nav item, local
  FTS5 index from the parent sync feed, local-first search, officer detail, actions,
  corrections, and honest feature states (requirements R-P1..R-P18).
- **Approved by**: user (in-session directive, 2026-08-16)
- **Approval date**: 2026-08-16

## Contract checklist (mirrors tasks.md)

| # | Item | Contract |
|---|---|---|
| C1 | Parent contracts | Consume only the existing parent routes: search, detail, tenders, sync (apiAccess-gated, unmasked, tombstones), corrections. No new parent endpoint, schema, setting or mutation (TASK-1.1). |
| C2 | Contract layer | `endpoints/procurement-officers.ts` zod schemas encoding masked summaries, tombstone rows and cursor pagination; wired into `ApiClients` (TASK-1.1). |
| C3 | Local schema | Migration `0005_procurement_officers.sql`: owner-scoped tables + `procurement_officers_fts` FTS5 + indexes; FTS5 availability pre-checked, fallback deviation recorded if needed (TASK-1.2). |
| C4 | Repository | Transactional upsert with FTS rebuild, tombstone removal, FTS5 search + filters, saved/notes/sync-state CRUD, owner-scoped (TASK-1.3). |
| C5 | Sync runner | Cursor-resume incremental runner, `limit: 200`, tombstone → local removal, 404 → `featureState: off`, 403 → `entitlement-missing` read-only, no overlapping runs (TASK-1.4). |
| C6 | Nav + route | "Procurement Officers" (`UserSearch`, `/procurement-officers`, available) below Supplier Intelligence; route registered; reachability tested (TASK-1.5). |
| C7 | Search | 150–250 ms debounce; local FTS5 first; coalesced server refresh; dedupe (server wins on status/freshness, local wins on values); province/organisation/role/kind/status filters; quality labels with 12/24-month thresholds (TASK-1.6). |
| C8 | Detail + actions | Headline isCurrent assignment, organisation + physical address, official contacts, related tenders; copy/mailto/save/notes/org-link actions; no bulk export affordance (TASK-1.7, R-P11/R-P13). |
| C9 | Corrections | `POST corrections`; local pending-suppression marker; never re-shown before server resolution; error states (TASK-1.8). |
| C10 | States + gates | Feature-off / entitlement-missing / offline states honest (REQ-16); saved officers + recent searches; full `vitest`, `tsc`, `eslint`, `prettier` green; `INTEGRATION_EVAL.md` + traceability complete; CHANGELOG entry; commit per task with recorded subjects (TASK-1.9, TASK-1.10). |

## Explicitly out of scope

Parent-application changes of any kind (endpoints, schema, beta setting, unmasking
search/detail, audit behaviour); bulk/CSV/JSON export; full organisation profile
parity; the parent admin review queue; any identity re-resolution or officialness
computation on the desktop; marketing use of directory data.

## Non-negotiable constraints

- Parent repository is read-only during desktop work (desktop AGENTS.md role contract).
- Local SQLite is a cache/offline index only — the parent stays authoritative.
- Never show a value the local index does not hold; never compute officialness or
  suppression locally.
- No `npm run build` / `next build` / prisma migrations (repo rule); Windows Tauri
  release build is a user gate.
- No bulk export affordance anywhere in the UI.
- Implement tasks in order; do not modify this contract without explicit user approval.