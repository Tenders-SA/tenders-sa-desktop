# SPEC CONTRACT — Desktop Tender Radar parity refactor

**Generated:** 2026-08-14

**Status:** APPROVED

## Coder instructions

This contract governs all implementation of the desktop Tender Radar parity refactor.
Read `requirements.md`, `design.md`, `tasks.md`, this file, and
`INTEGRATION_EVAL.md` completely before writing code. Implement tasks in order. Do not
modify this contract during implementation without explicit user approval.

## Feature summary

Refactor the existing desktop `/radar` implementation in place so it adopts the main
application's private Radar information architecture and decision workflow. The desktop
must remain a contract-backed native client: stored scores and scenario results come
from existing parent APIs, while filtering, presentation, tier capping, and temporary
overlays are desktop projections.

## Key constraints

- Parent repository and parent runtime are read-only.
- No new parent endpoint, database query, schema, migration, matching pipeline, auth
  path, payment logic, cron, or external dependency.
- One canonical desktop route, component owner, and recommendation adapter; no V2 path.
- Never calculate live matching locally or alter an authoritative stored base score.
- Never infer eligibility, stale state, publication type, dismissed state, or AI summary
  from fields the current contract does not expose.
- Do not ship Not Relevant/undo, fake email-digest persistence, or unavailable JV links.
- Subscription failures are errors, not free-tier/upgrade decisions.
- Saved toggles run once without retry and adopt the server-returned state.
- Scenario scans remain server-gated and temporary.
- Preserve account-scoped local-first cache behavior and compact embedded Radar use.
- No release build; the user owns release packaging.

## Integration warnings

- `GET /api/v1/recommendations` is not the same read model as main `/radar`: it does
  not expose stale/publication/eligibility/saved/dismissed/summary fields and excludes
  applied tenders by default.
- The parent API returns an older `good_match` category. Desktop presentation must use
  the main `70/50/30` thresholds from the numeric score.
- The existing CIDB route does not support GET. Use the already-existing extended
  company profile GET route.
- The saved list is paginated. First-page presence is not a complete saved-state test,
  and per-card status requests are prohibited.
- The scenario response is an API envelope whose row IDs are matching-score IDs.
- `useWorkspaceAsync`, OS credential reads, unauthorized handling, and mutation retry
  rules are existing contracts and must not be bypassed.
- The main web digest toggle is local storage only and must not be represented as a
  server email preference in the desktop.

## Task checklist

- [x] **TASK-0.1: Lock the current desktop and parent Radar contracts with fixtures**
- [x] **TASK-0.2: Confirm the desktop-only boundary and unsupported parity matrix**
- [x] **TASK-1.1: Extend the existing RecommendationsEndpoint for Radar parity inputs**
- [x] **TASK-1.2: Project the existing extended company profile contract**
- [x] **TASK-1.3: Add complete saved-ID reconciliation without N+1 requests**
- [x] **TASK-2.1: Implement the pure Radar workspace model**
- [x] **TASK-2.2: Refactor TenderRadar into the composite local-first controller**
- [x] **TASK-3.1: Add the Radar header, tier states, and headline metrics**
- [x] **TASK-3.2: Add match navigation, filters, sorting, and local reveal**
- [x] **TASK-3.3: Replace generic rows with desktop-native Radar cards**
- [x] **TASK-3.4: Add authoritative saved-state actions**
- [x] **TASK-3.5: Add profile guidance and top improvement sidebar**
- [x] **TASK-3.6: Add paid scenario scanning and temporary score overlay**
- [x] **TASK-3.7: Wire the full route, preserve embedded use, and remove obsolete standalone controls**
- [x] **TASK-4.1: Run focused Radar integration and regression tests**
- [x] **TASK-4.2: Run desktop quality gates and manual Tauri smoke**
- [x] **TASK-4.3: Complete specification traceability and handoff**

## Commit format

Use the exact commit subject recorded by each task in `tasks.md`. Every implementation
commit must reference its task and satisfied requirement IDs in the body. Stage only
desktop files belonging to the active task.

## Approval

Changing `Status` to `APPROVED` requires explicit user approval. Approval authorizes
only the tasks and desktop file scope in this contract; it does not authorize parent
application changes.
