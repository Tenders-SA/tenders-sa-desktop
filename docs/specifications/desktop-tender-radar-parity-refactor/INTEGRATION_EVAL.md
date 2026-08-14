# Integration evaluation — Desktop Tender Radar parity refactor

**Status:** IN PROGRESS — implementation approved

Run the relevant section at the end of every implementation phase. Do not mark the
implementation complete until the final result is PASS.

## Pre-implementation check

- [x] User explicitly approved `SPEC_CONTRACT.md`.
- [x] Desktop `main` and parent reference have been re-synchronized/read.
- [x] Recent Radar history and every current `TenderRadar` consumer were reviewed.
- [x] Parent API shapes still match the requirements contract matrix.
- [x] No canonical parent Radar read endpoint has appeared since spec creation.
- [x] No Tier 1/Tier 2 parent file or desktop auth transport requires modification.
- [x] User-owned `AGENTS.md` and `.codex-runtime/` state remains outside task scope.

## Phase 0 evaluation — reality and boundary

- [x] Fixtures reproduce current recommendation, entitlement, saved, profile, and
  scenario response shapes.
- [x] The existing desktop route/component/adapter are confirmed as canonical owners.
- [x] Unsupported fields/actions are still unavailable through a complete contract.
- [x] No parent product file was modified.
- [x] Enhance-existing remains the correct decision.

## Phase 1 evaluation — endpoint projections

- [x] Recommendations at `minScore=30`, `limit=50` validate without changing the
  server-authoritative numeric score.
- [x] Scenario scan uses the existing authenticated transport and never retries.
- [x] Scenario 403, 500, malformed body, and abort remain distinct handled failures.
- [x] Extended profile projects the six required main-Radar signals.
- [x] Missing extended profile is distinct from endpoint failure.
- [x] Saved IDs are complete across pagination with no per-card request.
- [x] Save mutation behavior remains one non-retried authoritative toggle.
- [x] Existing endpoint consumers and endpoint tests remain green.

## Phase 2 evaluation — model and orchestration

- [x] Score bands pass boundary tests at 29/30/49/50/69/70.
- [x] Free/Starter/Professional/Enterprise caps are 0/10/50/50.
- [x] Counts are computed after cap and before user filters.
- [x] Freshness text refers to Radar calculation/update, not publication.
- [x] Completeness uses exactly the documented six signals and `20/20/20/20/10/10`.
- [x] Top-gap selection is normalized and deterministic.
- [x] Filters/sorts do not mutate cached base matches.
- [x] Scenario overlay does not mutate or persist base scores.
- [x] Required-source failures block honestly; auxiliary failures degrade locally.
- [x] Cached data renders account-scoped and reconciles through existing status UI.
- [x] Embedded and full modes share endpoint/model ownership without sharing the full layout.

## Phase 3 evaluation — user experience

- [ ] Existing menu reaches exactly one `/radar` route and one canonical screen owner.
- [ ] Header, tier state, counts, freshness, and profile score are text-accessible.
- [ ] Match tabs, supported filters, sorts, and 15-row reveal work by keyboard.
- [ ] Cards show only contract-backed fields and link to native tender detail.
- [ ] Unknown factor/field values are omitted or labelled unknown, never rendered as zero.
- [x] Saved state is known before mutation controls enable.
- [x] Save/unsave adopts the server-returned boolean and reports failures without drift.
- [ ] Profile sidebar links to `/company` and isolates profile read failures.
- [ ] Scenario scan appears only for Professional/Enterprise presentation and remains
  server-authorized.
- [ ] Scenario preview announces projected values, restores prior sort, and exits cleanly.
- [ ] No Eligible Only, Not Relevant/undo, AI summary, fake email digest, or unavailable
  JV action is present.
- [ ] No minimum-score selector, previous/next listing, or fire-and-forget recalculate
  control remains in standalone mode.
- [ ] Full workspace works at 1024×768 and narrow shell width without horizontal scroll.
- [ ] Reduced-motion behavior and focus visibility were manually checked.

## Final regression evaluation

- [ ] All REQ, INT, PERF, SEC, REL, A11Y, UX, and DATA requirements have code/test evidence.
- [ ] Focused Radar endpoint, model, screen, cache, and navigation tests pass.
- [ ] TenderList embedded Radar tests pass.
- [ ] Tender detail, Opportunities, Settings, Command Centre links, and account-isolated
  cache tests pass.
- [ ] `pnpm run typecheck` passes.
- [ ] `pnpm run lint` passes.
- [ ] `pnpm run format:check` passes.
- [ ] `git diff --check` passes.
- [ ] Manual `pnpm run tauri dev` smoke covers free/paid shell, full/embedded Radar,
  filtering, save/unsave, profile action, scenario preview, and offline cached state.
- [ ] No build command, migration, parent edit, external dependency, or broad process
  termination was used.
- [ ] Impact map matches the actual desktop diff.
- [ ] `tasks.md` and `SPEC_CONTRACT.md` checklists match exactly.
- [ ] Changelog decision is documented and any required entry is included.

## Known accepted limitations to re-verify at completion

- [ ] Recommendation feed may include stale/non-tender-notice rows because the current
  public contract does not expose those filters.
- [ ] Recommendation feed excludes already-applied tenders by parent service default.
- [ ] Eligibility, dismiss/undo, inline AI summary, and publication freshness remain
  unavailable rather than inferred.
- [ ] Tier cap in the desktop is presentation behavior; parent scenario gate remains the
  only security boundary in this scope.
- [ ] Exact data parity is not claimed without a future canonical parent Radar read contract.

## Result

- **Status:** NOT STARTED
- **Passed:** 0
- **Failed:** 0
- **Remaining issues:** Implementation in progress.
- **Approved by:** User, 2026-08-14
