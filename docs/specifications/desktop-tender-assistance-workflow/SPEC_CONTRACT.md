# SPEC CONTRACT — Desktop tender assistance workflow

**Generated:** 2026-08-12
**Status:** APPROVED — user authorised implementation on 2026-08-12

## Coder instructions

This contract governs the workflow redesign. Read `requirements.md`,
`design.md`, `tasks.md`, this file and `INTEGRATION_EVAL.md` completely before
implementation. Implement tasks in order, run every pre-check and keep this
checklist identical to `tasks.md`. Do not implement while status is pending.

## Feature summary

Enhance the existing desktop application workspace into five addressable tender
preparation stages. Reuse stored tender analysis and existing application
assistance contracts, and move response-document editing into a dedicated
full-work-area authoring environment with unsaved-change protection.

## Key constraints

- Desktop repository only; parent repository is read-only.
- No new/changed parent endpoint, schema, service, AI process or analysis path.
- Extend `ApplicationWorkspace`; remove the old one-page composition once the
  staged replacement is complete. No parallel workspace.
- One shared blueprint controller, one generation refresh owner and one
  response editor.
- Full analysis is read through existing `TendersEndpoint.get`; never generated
  or recalculated locally.
- Explicit human actions remain required for eligibility, generation, saving,
  enrichment, validation and export.
- Draft content is component memory until Save; never log/store/place it in URL.
- Existing endpoint retry, entitlement, error and owner-authorization behavior
  must remain intact.
- Implementation was explicitly approved by the user on 2026-08-12.

## Integration warnings

- Application and presentation workflow stages are different concepts; do not
  overwrite or reinterpret server-owned `application.status`/assistance stage.
- Plan and Draft must consume the same blueprint state to avoid duplicate reads
  and timers.
- Missing analysis is unknown, not proof that the tender has no requirements.
- Router unsaved-change behavior must be verified against installed React
  Router APIs before coding.
- Existing slice specs remain authoritative for endpoint behavior.

## Task checklist

- [x] TASK-1.1: Pin the current workspace behavior and route contract
- [x] TASK-1.2: Add pure workflow stage model and derivation
- [x] TASK-1.3: Implement addressable workflow routes and shell
- [x] TASK-1.4: Phase 1 integration evaluation
- [ ] TASK-2.1: Extract reusable tender intelligence presentation
- [ ] TASK-2.2: Build Understand stage with full analysis
- [ ] TASK-2.3: Compose Qualify stage from existing capability
- [ ] TASK-2.4: Phase 2 integration evaluation
- [ ] TASK-3.1: Extract one blueprint workspace controller
- [ ] TASK-3.2: Build Plan stage
- [ ] TASK-3.3: Build response document navigator and editor
- [ ] TASK-3.4: Protect unsaved edits
- [ ] TASK-3.5: Phase 3 integration evaluation
- [ ] TASK-4.1: Build Review & Export stage
- [ ] TASK-4.2: Remove old all-panels composition and reconcile capability
- [ ] TASK-4.3: Accessibility, responsive and recovery verification
- [ ] TASK-4.4: Complete quality gates and changelog

## Commit format

Use the exact task commit listed in `tasks.md`. Every implementation commit must
identify its task and satisfied requirement IDs in the body.
