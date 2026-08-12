# Integration evaluation — desktop tender assistance workflow

> Updated at each implementation phase. The current result is planning-only;
> no product code has been changed.

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

- [ ] Existing `/applications/:applicationId` link remains valid.
- [ ] Five stage URLs, default redirect and invalid-stage fallback work.
- [ ] Stage state uses existing data and reports unknown as Not assessed.
- [ ] Parent application status remains separate from presentation progress.
- [ ] Initial requests remain application detail plus cockpit only.
- [ ] Existing workspace capability characterization tests pass.

## Phase 2 evaluation — Understand and Qualify

- [ ] Understand uses existing `TendersEndpoint` and shared analysis logic.
- [ ] All stored analysis categories and source filenames remain visible.
- [ ] Pending/partial/no-analysis states remain honest.
- [ ] Document downloads retain existing R2-backed route and ports.
- [ ] Eligibility remains explicit and preserves three-way result.
- [ ] Compliance/company failures isolate to Qualify.
- [ ] No parent or pipeline file changed.

## Phase 3 evaluation — Plan and Draft

- [ ] One blueprint controller owns GET, overlays and generation refresh.
- [ ] Plan retains all blueprint, questions, research, submission and risk data.
- [ ] Draft uses a dedicated work-area editor, not inline card editing.
- [ ] Save/generate/enrich semantics and error copy remain unchanged.
- [ ] Bounded generation refresh stops early and cleans up on unmount.
- [ ] Save/Discard/Stay prevents silent draft loss.
- [ ] Draft content is absent from URLs, logs and persistent browser state.
- [ ] Keyboard, focus and narrow-window flows pass.

## Phase 4 evaluation — Review and migration

- [ ] Validation and export run only on explicit action.
- [ ] Blockers and unresolved items precede export controls.
- [ ] Export remains clearly distinct from bid submission.
- [ ] Every old workspace capability maps to exactly one staged destination.
- [ ] Old all-panels composition and inline textarea are removed.
- [ ] One response editor and one blueprint refresh owner remain.
- [ ] User-visible changelog entry added.

## Final evaluation

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
- **Remaining issues:** Implementation has not started.
- **Approved by:** User on 2026-08-12.
