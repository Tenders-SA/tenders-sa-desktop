# Desktop Tender Radar parity refactor — implementation tasks

> **READ BEFORE STARTING:** Read `requirements.md`, `design.md`, this file,
> `SPEC_CONTRACT.md`, and `INTEGRATION_EVAL.md` in that order. Then load
> `.agent/skills/create-specification/EXECUTION_PROTOCOL.md` from the parent
> repository. Do not implement while the contract is pending approval. Do not
> reorder, combine, or skip tasks without updating the specification and obtaining
> user approval.

## Current status

- [x] Specification approved
- [x] Phase 0 complete
- [x] Phase 1 complete
- [x] Phase 2 complete
- [ ] Phase 3 complete
- [ ] Phase 4 complete
- [ ] Integration evaluation passed
- [ ] All success criteria verified

## Phase 0 — protect current contracts and scope

- [x] **TASK-0.1: Lock the current desktop and parent Radar contracts with fixtures**
  - **Refs:** REQ-1, REQ-2, REQ-12, INT-4, Design §Canonical product mapping
  - **Files:** Modify `src/tests/module-endpoints.test.ts`, `src/tests/module-screens.test.tsx`
  - **Pre-check:** Re-read the live parent route files named in `requirements.md`; confirm desktop `HEAD` and parent reference lines have not changed since spec approval.
  - **Work:** Add/adjust fixtures for the 30-score feed, no-profile, entitlement states, saved pagination, extended profile, and scenario response without changing production code.
  - **Verify:** Focused tests demonstrate the old standalone screen behavior and the exact existing endpoint shapes; record any contract drift before proceeding.
  - **Commit:** `test(tender-radar-parity/0.1): lock existing radar contracts`

- [x] **TASK-0.2: Confirm the desktop-only boundary and unsupported parity matrix**
  - **Refs:** REQ-7, REQ-12, REQ-14, INT-6, DATA-1
  - **Files:** Review-only gate; update these specification files only if repo reality changed
  - **Pre-check:** Search again for a canonical parent Radar API, idempotent dismiss/undo, eligibility status, AI summary, and server-backed digest preference.
  - **Work:** Confirm no newly available contract closes a documented gap; if one exists, stop and revise the spec rather than implementing around stale assumptions.
  - **Verify:** `git diff --name-only` shows no parent product edits and the contract matrix remains accurate.
  - **Commit:** None unless the approved specification requires a user-approved correction.

## Phase 1 — existing endpoint projections

- [x] **TASK-1.1: Extend the existing RecommendationsEndpoint for Radar parity inputs**
  - **Refs:** REQ-2, REQ-3, REQ-11, INT-1, INT-4, REL-1, REL-2
  - **Files:** Modify `src/services/api/endpoints/recommendations.ts`, `src/tests/module-endpoints.test.ts`
  - **Pre-check:** Confirm `RecommendationsEndpoint` is still the sole Radar adapter and `AuthenticatedEndpoint` still applies no-retry semantics to mutations.
  - **Work:** Validate the current list shape at a 30 minimum, add the existing scenario-scan request/response projection, and preserve current consumers.
  - **Verify:** Focused endpoint tests cover valid scan results, invalid envelopes, 403 entitlement denial, server error, abort, and no mutation retry.
  - **Commit:** `feat(tender-radar-parity/1.1): extend radar recommendation contracts`

- [x] **TASK-1.2: Project the existing extended company profile contract**
  - **Refs:** REQ-9, INT-1, INT-4, REL-1
  - **Files:** Modify `src/services/api/endpoints/company.ts`, `src/tests/module-endpoints.test.ts`
  - **Pre-check:** Re-read parent `src/app/api/v1/company/profile/extended/route.ts`; do not use the non-existent CIDB GET contract.
  - **Work:** Add a narrow Zod projection and `getExtendedProfile` method with honest missing-profile handling.
  - **Verify:** Tests cover complete, partial, null-profile, 404, malformed, and server-failure responses.
  - **Commit:** `feat(tender-radar-parity/1.2): project extended company profile`

- [x] **TASK-1.3: Add complete saved-ID reconciliation without N+1 requests**
  - **Refs:** REQ-8, INT-1, INT-4, PERF-1, REL-2
  - **Files:** Modify `src/services/api/endpoints/saved-tenders.ts`, `src/tests/module-endpoints.test.ts`
  - **Pre-check:** Confirm the parent list route's current maximum page size and returned `totalPages`; confirm toggle remains a non-idempotent mutation.
  - **Work:** Add an abortable paginated ID collector or an equivalently scoped helper that follows server pagination and never calls status per card.
  - **Verify:** A fixture whose relevant tender is beyond page one reconciles correctly; abort and intermediate-page failure remain explicit.
  - **Commit:** `feat(tender-radar-parity/1.3): reconcile complete saved radar state`

## Phase 2 — pure workspace model and orchestration

- [x] **TASK-2.1: Implement the pure Radar workspace model**
  - **Refs:** REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-9, REQ-10, Design §View model
  - **Files:** Create `src/features/radar/radar-workspace-model.ts`, `src/tests/radar-workspace-model.test.ts`
  - **Pre-check:** Reconfirm main thresholds, completeness weights, freshness fallback, and tier caps from the referenced main files.
  - **Work:** Implement immutable normalization, banding, entitlement cap, counts, profile completeness, top-gap selection, filters, sorts, reveal slicing, and scenario overlay helpers.
  - **Verify:** Pure tests cover all threshold edges, null/invalid fields, deterministic ties, unknown values, 0/10/50 caps, filter combinations, and base-score immutability.
  - **Commit:** `feat(tender-radar-parity/2.1): add canonical radar workspace model`

- [x] **TASK-2.2: Refactor TenderRadar into the composite local-first controller**
  - **Refs:** REQ-1, REQ-4, REQ-8, REQ-12, REQ-13, INT-2, INT-5, PERF-1, PERF-2
  - **Files:** Modify `src/features/radar/TenderRadar.tsx`, `src/tests/module-screens.test.tsx`
  - **Pre-check:** Read `useWorkspaceAsync`, `workspaceQueryKey`, `AsyncSection`, and `WorkspaceDataStatus`; preserve their account-isolation and stale-refresh semantics.
  - **Work:** Add discriminated full/embedded props, concurrent full-workspace loading, versioned cache schema/key, isolated auxiliary failures, state ownership, and compact embedded reuse.
  - **Verify:** Tests cover cached render/reconcile, required-source failures, auxiliary degradation, no profile, empty results, abort, and embedded/full separation.
  - **Commit:** `refactor(tender-radar-parity/2.2): compose radar workspace state`

## Phase 3 — replace the standalone listing with the parity workspace

- [x] **TASK-3.1: Add the Radar header, tier states, and headline metrics**
  - **Refs:** REQ-4, REQ-5, REQ-12, A11Y-1, UX-1
  - **Files:** Create `src/features/radar/RadarHeader.tsx`; modify `src/features/radar/TenderRadar.tsx`, `src/tests/module-screens.test.tsx`
  - **Pre-check:** Compare the main `RadarHeader` and `radar/layout.tsx` with desktop theme and subscription patterns.
  - **Work:** Implement title/purpose, calculation freshness, text-backed counts, plan label, free state, and error-vs-denial behavior.
  - **Verify:** Tier fixtures and entitlement failure render distinct, accessible outcomes at narrow and wide widths.
  - **Commit:** `feat(tender-radar-parity/3.1): add radar header and tier states`

- [x] **TASK-3.2: Add match navigation, filters, sorting, and local reveal**
  - **Refs:** REQ-3, REQ-6, REQ-12, A11Y-1, UX-1
  - **Files:** Create `src/features/radar/RadarControls.tsx`; modify `src/features/radar/TenderRadar.tsx`, `src/tests/module-screens.test.tsx`
  - **Pre-check:** Confirm every control is supported by the projected fields; do not add Eligible Only.
  - **Work:** Implement tabs with counts, two honest filters, four sorts, reset behavior, filtered-empty state, and 15-row reveal increments.
  - **Verify:** Keyboard/control tests prove each state change produces deterministic rows and resets reveal count without changing base data.
  - **Commit:** `feat(tender-radar-parity/3.2): add radar navigation and controls`

- [ ] **TASK-3.3: Replace generic rows with desktop-native Radar cards**
  - **Refs:** REQ-7, REQ-8, REQ-12, A11Y-1
  - **Files:** Create `src/features/radar/RadarCard.tsx`; modify `src/features/radar/MatchFactors.tsx`, `src/features/radar/TenderRadar.tsx`, `src/tests/module-screens.test.tsx`
  - **Pre-check:** Enumerate fields actually returned by the recommendation schema; confirm `/tenders/:tenderId` remains the native detail route.
  - **Work:** Add score/band, procurement facts, factors, reasoning, gaps/actions, AI recommendation details, closing urgency, and explicit absent-field behavior. Do not add unsupported eligibility, summary, dismiss, or JV claims.
  - **Verify:** Full, partial, near-miss, invalid-date, and missing-field fixtures remain legible and accessible without invented values.
  - **Commit:** `feat(tender-radar-parity/3.3): add decision-ready radar cards`

- [ ] **TASK-3.4: Add authoritative saved-state actions**
  - **Refs:** REQ-8, REQ-12, REL-2, A11Y-1
  - **Files:** Modify `src/features/radar/RadarCard.tsx`, `src/features/radar/TenderRadar.tsx`, `src/tests/module-screens.test.tsx`
  - **Pre-check:** Confirm initial saved state is known before enabling the toggle and transport mutations still never retry.
  - **Work:** Wire one-call save/unsave, returned-state reconciliation, pending/disabled state, cache update, and announced success/error.
  - **Verify:** Save, unsave, duplicate-click prevention, unknown initial state, mutation error, and cache-view consistency tests pass.
  - **Commit:** `feat(tender-radar-parity/3.4): wire authoritative saved actions`

- [ ] **TASK-3.5: Add profile guidance and top improvement sidebar**
  - **Refs:** REQ-9, REQ-10, REQ-12, INT-3, A11Y-1, UX-1
  - **Files:** Create `src/features/radar/RadarSidebar.tsx`; modify `src/features/radar/TenderRadar.tsx`, `src/tests/module-screens.test.tsx`
  - **Pre-check:** Confirm all six signals exist in the extended-profile projection and `/company` remains reachable.
  - **Work:** Render weighted completeness, signal checklist, top normalized gap when present, profile action, and isolated unavailable state.
  - **Verify:** Complete, partial, missing, unavailable, and no-gap fixtures render accurately with no local AI or fake digest control.
  - **Commit:** `feat(tender-radar-parity/3.5): add radar profile guidance`

- [ ] **TASK-3.6: Add paid scenario scanning and temporary score overlay**
  - **Refs:** REQ-4, REQ-11, REQ-12, SEC-2, REL-2, A11Y-1
  - **Files:** Create `src/features/radar/RadarScenarioPanel.tsx`; modify `src/features/radar/RadarSidebar.tsx`, `src/features/radar/TenderRadar.tsx`, `src/tests/module-screens.test.tsx`
  - **Pre-check:** Confirm server still gates the route and response row IDs are matching-score IDs used by loaded recommendations.
  - **Work:** Implement inputs, validation, result comparison, temporary overlay, delta labels, previous-sort restoration, exit, and error handling. Do not persist or recompute locally.
  - **Verify:** Starter absence, paid success, 403, empty scan, malformed response, overlay sorting, and exit-with-base-restored tests pass.
  - **Commit:** `feat(tender-radar-parity/3.6): add server-backed scenario preview`

- [ ] **TASK-3.7: Wire the full route, preserve embedded use, and remove obsolete standalone controls**
  - **Refs:** REQ-1, REQ-13, REQ-14, INT-3, INT-5
  - **Files:** Modify `src/app/router/routes.tsx`, `src/features/tenders/TenderList.tsx`, `src/features/radar/TenderRadar.tsx`, `src/tests/navigation-reachability.test.tsx`, `src/tests/module-screens.test.tsx`
  - **Pre-check:** Search every `TenderRadar` consumer and every `/radar` link before changing props.
  - **Work:** Pass existing clients to the full route, retain compact embedded use, remove the old standalone minimum-score/previous-next/recalculate UI, and verify no second owner remains.
  - **Verify:** Consumer audit, navigation tests, `/tenders` embedded test, and `rg` confirm one route/owner and no obsolete standalone labels.
  - **Commit:** `refactor(tender-radar-parity/3.7): complete radar workspace replacement`

## Phase 4 — verification and delivery gates

- [ ] **TASK-4.1: Run focused Radar integration and regression tests**
  - **Refs:** All REQ, INT, REL, SEC, PERF, A11Y, UX requirements
  - **Files:** Test files listed above; production fixes only where a failing requirement demands them
  - **Pre-check:** Read `INTEGRATION_EVAL.md` and map every check to a test or manual step.
  - **Work:** Run focused endpoint, model, screen, cache, navigation, Opportunities, Settings, and tender-detail tests; complete Phase 1–3 evaluation sections.
  - **Verify:** All scoped tests pass with no skipped parity assertion and no unrelated file edits.
  - **Commit:** `test(tender-radar-parity/4.1): complete radar integration coverage`

- [ ] **TASK-4.2: Run desktop quality gates and manual Tauri smoke**
  - **Refs:** REL-1, REL-2, A11Y-1, UX-1, Success Criteria
  - **Files:** All files changed by this specification
  - **Pre-check:** `git diff --name-only` must match the approved impact map; run the changelog decision before any commit.
  - **Work:** Run targeted tests, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`, `git diff --check`, and a manual `pnpm run tauri dev` journey for full/embedded, saved, and scenario states.
  - **Verify:** All gates are green, the integration evaluation is PASS, no parent file changed, and no release build was run.
  - **Commit:** `chore(tender-radar-parity/4.2): complete desktop verification`

- [ ] **TASK-4.3: Complete specification traceability and handoff**
  - **Refs:** All requirements and Success Criteria
  - **Files:** Modify `requirements.md`, `tasks.md`, `SPEC_CONTRACT.md`, `INTEGRATION_EVAL.md`; update `CHANGELOG.md` only if the changelog skill says required
  - **Pre-check:** Compare task and contract checklists mechanically and inspect the implementation commit range.
  - **Work:** Mark satisfied requirements with file evidence, mirror task completion, record remaining parent-contract limitations, and complete the evaluation result.
  - **Verify:** Every requirement maps to code/tests, task and contract lists match, documented limitations remain honest, and the desktop-only diff is ready for user review.
  - **Commit:** `docs(tender-radar-parity/4.3): complete implementation handoff`
