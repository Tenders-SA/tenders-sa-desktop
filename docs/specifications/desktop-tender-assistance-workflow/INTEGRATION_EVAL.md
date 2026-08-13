# Integration evaluation — desktop tender assistance workflow

> Updated at each implementation phase.

## Pre-implementation check

- [x] Recent desktop git history reviewed through `62e47e8`.
- [x] Existing `ApplicationWorkspace`, route wiring, assistance panels,
  blueprint editor and completed slice specifications identified.
- [x] Decision recorded: enhance existing; no parallel workspace.
- [x] Main application classified as read-only reference.
- [x] Document-analysis pipeline rule loaded; no pipeline change proposed.
- [x] Existing read/mutation contracts are sufficient for the design.
- [x] User approved this specification on 2026-08-12.
- [x] Implementation baseline rechecked immediately before TASK-1.1.

## Phase 1 evaluation — workflow foundation

- [x] Existing `/applications/:applicationId` link remains valid.
- [x] Five stage URLs, default redirect and invalid-stage fallback work.
- [x] Stage state uses existing data and reports unknown as Not assessed.
- [x] Parent application status remains separate from presentation progress.
- [x] Initial requests remain application detail plus cockpit only.
- [x] Existing workspace capability characterization tests pass (114 focused
  tests plus 6 pure state tests; TypeScript, lint and formatting pass).

## Phase 2 evaluation — Understand and Qualify

- [x] Understand uses existing `TendersEndpoint` and shared analysis logic.
- [x] All stored analysis categories and source filenames remain visible.
- [x] Pending/partial/no-analysis states remain honest.
- [x] Document downloads retain existing R2-backed route and ports.
- [x] Eligibility remains explicit and preserves three-way result.
- [x] Compliance and eligibility failures isolate within Qualify panels.
- [x] No parent or pipeline file changed.
- [x] Phase boundary passed 179 focused tests plus TypeScript, ESLint,
  Prettier, Rust and diff checks.

## Phase 3 evaluation — Plan and Draft

- [x] One blueprint controller owns GET, overlays and generation refresh.
- [x] Plan retains all blueprint, questions, research, submission and risk data.
- [x] Draft uses a viewport-filling dialog editor, not inline card editing.
- [x] Save/generate/enrich semantics and error copy remain unchanged.
- [x] Bounded generation refresh stops early and cleans up on unmount.
- [x] Save/Discard/Stay prevents silent draft loss.
- [x] Draft content is absent from URLs, logs and persistent browser state.
- [x] Keyboard, focus and narrow-window composition checks pass.
- [x] Phase boundary passed 119 focused tests plus TypeScript, ESLint,
  Prettier, Rust and diff checks.

## Phase 4 evaluation — Review and migration

- [ ] Validation and export run only on explicit action.
- [ ] Blockers and unresolved items precede export controls.
- [ ] Export remains clearly distinct from bid submission.
- [ ] Every old workspace capability maps to exactly one staged destination.
- [ ] Old all-panels composition and inline textarea are removed.
- [ ] One response editor and one blueprint refresh owner remain.
- [ ] User-visible changelog entry added.

## Phase 3A pre-implementation evaluation — dynamic documents

- [x] Main application inspected read-only: deterministic blueprint derivation,
  cached AI enrichment merge and generic keyed generation already exist.
- [x] Desktop inspected: response schema is permissive and Draft currently maps
  `blueprint.responseDocuments[]`; document names seen in tests are fixtures,
  not a runtime catalogue.
- [x] Decision: enhance this workflow specification; do not create a parallel
  spec, endpoint, generator, analysis path or desktop document taxonomy.
- [x] Existing parent contracts are sufficient for dynamic Markdown response
  authoring; no endpoint or schema change is proposed.
- [x] Contract limitation recorded: existing string content cannot represent
  in-place editing of an official XLSX/PDF returnable.
- [x] User approved the Phase 3A amendment on 2026-08-13.
- [x] Dynamic fixture and selection/reconciliation implementation verified:
  server order and arbitrary kinds survive parsing; refreshed additions and
  reordering retain the selected exact key; stale keys show recovery.
- [x] Official-returnable presentation verified: Pricing Schedule is labelled
  as a working draft and existing tender files remain available through the
  established download/open component and ports.
- [x] Main application remained read-only; no endpoint, schema, AI prompt,
  analysis path or parent service changed.

## Final evaluation

## Phase 3B evaluation — route-level WYSIWYG workbench

- [x] Existing editor, blueprint controller, local-first store, dirty guard,
  official references and package export identified as canonical owners.
- [x] Decision: enhance the existing workflow specification; no parallel spec,
  persistence mechanism, export pipeline or parent change.
- [x] Draft deep-link mounts without `AppLayout`/workspace underneath.
- [x] Canonical Markdown renders and round-trips through the WYSIWYG model.
- [x] Dirty PDF/DOCX export saves first and never exports after save failure.
- [x] Focused and full desktop gates pass (focused 22/22; full 835/835,
  TypeScript, ESLint, Prettier and Rust clean).

- [ ] Every REQ, INT and success criterion has implementation evidence.
- [ ] Focused and adjacent Vitest suites pass.
- [ ] Full TypeScript check passes.
- [ ] ESLint and Prettier pass.
- [ ] Rust check passes.
- [ ] `git diff --check` passes.
- [ ] No prohibited build or parent operation was run.
- [ ] Commit history follows task IDs and contract checklist mirrors tasks.

## Result

- **Status:** IN PROGRESS
- **Remaining issues:** Phase 3 and Phase 4 remain.
- **Approved by:** User on 2026-08-12.
