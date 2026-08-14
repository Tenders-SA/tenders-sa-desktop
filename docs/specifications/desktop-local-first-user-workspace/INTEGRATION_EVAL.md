# Desktop Local-First User Workspace — Integration Evaluation

- **Status:** specification complete; implementation not started
- **Date:** 2026-08-14

## Pre-implementation evidence

- [x] Recent Git history reviewed; Slice 10 already shipped local-first response drafting.
- [x] Existing SQLite migrations and repositories reviewed.
- [x] Generic cache exists but has no production read consumer.
- [x] Existing sync state/conflict foundations reviewed; general background coordinator absent.
- [x] Tender, Radar, tender detail and application screens verified network-first.
- [x] Tender Document Viewer verified to download bytes on every selected-document load.
- [x] Session exposes `userId`; local schema verified unscoped by account.
- [x] Parent remains read-only and no new endpoint is required by the design.
- [x] Enhance-existing decision recorded; no parallel persistence system proposed.

## Existing capability disposition

| Capability | Reality | Spec action |
|---|---|---|
| SQLite/migrations | implemented | extend additively |
| Generic encrypted cache | foundation only | wire through shared local-first query layer |
| Draft persistence/versioning | implemented | preserve; add owner and strict save ordering |
| Response save queue | implemented | centralize replay; keep operation allowlist narrow |
| Conflict schema/state machine | foundation only | wire to response content and resolution UI |
| Document viewer | implemented, network bytes each open | source through workspace document service |
| Local file references | schema only | add repository and consume it |
| Tender/application cache | absent | add as validated projections in existing cache |
| Background refresh | absent | one coordinator, no per-screen timers |
| Account isolation | absent | mandatory first implementation slice |

## Spec validation

- [x] `requirements.md`, `design.md`, `tasks.md`, `SPEC_CONTRACT.md` and this evaluation agree.
- [x] Tasks and contract both contain T1–T15 in identical order.
- [x] Cache and file freshness limitations reflect fields actually exposed by existing desktop schemas.
- [x] Migration, rollback, security, privacy, performance and corruption behavior are specified.
- [x] No claim that unimplemented local-first reads already exist.
- [x] No implementation is marked approved or complete.

## Implementation gates

- [ ] User approves SPEC_CONTRACT.
- [ ] T1 audit matrix reviewed before migrations.
- [ ] T2 ownership migration proves no data loss.
- [ ] T3 account switching/isolation tests pass.
- [ ] T4–T5 local-first foundation passes fake-clock and concurrency tests.
- [ ] T6–T10 read/document consumers pass offline and fallback tests.
- [ ] T11–T13 local-save/sync/conflict tests pass.
- [ ] T14 UX accessibility tests pass.
- [ ] T15 permitted full gates and manual Windows checks pass.

