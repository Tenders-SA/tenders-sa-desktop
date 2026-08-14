# Desktop Local-First User Workspace — Tasks

## Status

All tasks are `BLOCKED — AWAITING USER APPROVAL`. Specification creation does not authorize implementation.

| # | Task | Primary files/owners | Pre-check | Verification |
|---|---|---|---|---|
| T1 | Characterize every current read/write/cache/file flow and pin test fixtures | endpoint consumers, current specs/tests | clean tree; current contract inventory | audit matrix names cacheability, sensitivity, owner and remote authority |
| T2 | Add account ownership migration and schema/repository mirrors | `src-tauri/migrations`, `src-tauri/src/db`, `src/db/**` | migration 0001–0003 fixtures; no destructive migration | empty/upgrade/retention/cross-owner Rust + TS tests |
| T3 | Add active workspace identity and app-data directory port | auth composition root, storage ports | `SessionSummary.userId` confirmed; no email paths | login A/logout/login B isolation and path traversal tests |
| T4 | Extend cache repository with owner, freshness/retention and corruption-safe invalidation | existing cache repository/service | T2/T3 green | encrypted payload, owner binding, stale readable, corrupt fallback tests |
| T5 | Implement canonical query keys, entity policies and shared SWR query coordinator | new focused modules under existing storage/sync ownership | enumerate effective endpoint defaults | ordering-independent key tests; fake-clock freshness and single-flight tests |
| T6 | Migrate All Tenders, filters/search and Radar reads incrementally | tender/recommendation screen adapters | existing screen/API tests green | cached immediate render, background refresh, manual force, offline first-use tests |
| T7 | Migrate Tender Detail and document inventory reads | TenderDetail route/adapter | T6 green; detail schema reused for cache validation | offline revisit, stale refresh, corrupt cache retention tests |
| T8 | Implement owner-scoped `local_file_references` repository and atomic WorkspaceDocumentService | existing document endpoint + native file port | app-data scope confirmed; no raw URL path | download once/reuse, missing file, partial write, changed fingerprint and cross-owner tests |
| T9 | Route internal Tender Document Viewer bytes through WorkspaceDocumentService; leave Download unchanged | viewer route/component, shared download control | T8 green | viewer local hit does zero network calls; explicit Download still calls save flow |
| T10 | Migrate application list/detail/cockpit/blueprint/analysis reads | application hooks/workspace | identify independent projections and sensitivity | immediate snapshot, partial background refresh, offline workspace tests |
| T11 | Strengthen existing response-document save to local-before-remote for online and offline cases | existing response store/DraftStage | preserve Slice 10 behavior and migrations | call-order, crash boundary, restart, remote success/failure tests |
| T12 | Move response-save replay into one owner-scoped background coordinator | existing queue/store + composition root | only idempotent response save allowlisted | reconnect replay, bounded retry, duplicate prevention, account-switch abort tests |
| T13 | Implement conflict detection, encrypted preservation and explicit resolution UI | existing `sync_conflicts`, response editor | document remote-base limitation; no invented CAS | local/remote preservation and keep-local/remote/merge tests |
| T14 | Add shared subtle cache/sync status UX and maintenance | `SyncStatus`, affected screens | status semantics pinned | keyboard/live-region and honest local-vs-remote wording tests |
| T15 | Complete security/performance review, changelog, full gates and manual Windows verification | tests/spec/changelog | inspect final diff and permissions | permitted full suite; user verifies offline/restart/account switching |

## Sequencing gates

- T2–T5 form the foundation and must land before feature consumers.
- Each consumer migration (T6–T10) must preserve the existing network path as safe fallback.
- T11–T13 may not broaden the queue beyond response-document saves without a new approved amendment.
- No task modifies the parent checkout.

