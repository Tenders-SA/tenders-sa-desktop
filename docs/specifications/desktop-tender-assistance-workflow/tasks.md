# Desktop tender assistance workflow — implementation tasks

> Status: specification complete; implementation is blocked pending explicit
> user approval. Read all five spec files and the execution protocol before
> editing code. Tasks must run in order and each requires its pre-check.

## Current status

- [x] Phase 1 — workflow foundation complete
- [x] Phase 2 — Understand and Qualify complete
- [x] Phase 3 — Plan and Draft complete
- [ ] Phase 4 — Review, migration and verification complete
- [ ] Integration evaluation passed
- [ ] All requirements success criteria verified

## Phase 1 — workflow foundation

- [x] **TASK-1.1: Pin the current workspace behavior and route contract**
  - *Refs:* REQ-1, REQ-10, REQ-11, INT-7
  - *Files:* `src/tests/module-screens.test.tsx`,
    `src/tests/navigation-reachability.test.tsx`
  - *Pre-check:* Read current `ApplicationWorkspace`, routes and all existing
    workspace screen tests; list each capability that must remain reachable.
  - *Work:* Add characterization tests for current calls, panels, route entry,
    explicit mutations and failure isolation before restructuring.
  - *Verify:* New tests fail only for the not-yet-built staged navigation; all
    existing workspace tests remain green.
  - *Commit:* `test(assistance-workflow/1.1): pin workspace behavior`

- [x] **TASK-1.2: Add pure workflow stage model and derivation**
  - *Refs:* REQ-1, REQ-2, PERF-1
  - *Files:* create `workflow/workflow-state.ts`; add focused unit tests.
  - *Pre-check:* Enumerate available application/cockpit/blueprint fields and
    prove each proposed indicator has an existing source.
  - *Work:* Define stage slugs/order/labels and pure honest status derivation;
    unknown data returns Not assessed.
  - *Verify:* Unit tests cover current, attention, complete and unknown without
    recalculating server-owned scores.
  - *Commit:* `feat(assistance-workflow/1.2): define workflow stages`

- [x] **TASK-1.3: Implement addressable workflow routes and shell**
  - *Refs:* REQ-1, UX-1, A11Y-1, INT-4, INT-7
  - *Files:* `routes.tsx`, `ApplicationWorkspace.tsx`; create
    `ApplicationWorkflowShell.tsx`, `WorkflowNavigation.tsx`.
  - *Pre-check:* Confirm installed React Router nested-route and navigation
    APIs; confirm no existing deep link is lost.
  - *Work:* Add default redirect, stage/document URLs, opportunity header,
    responsive navigation and stage outlet/work area.
  - *Verify:* Router tests cover five stages, default/invalid redirects,
    refresh, Back/Forward, headings and keyboard focus.
  - *Commit:* `feat(assistance-workflow/1.3): add staged workspace shell`

- [x] **TASK-1.4: Phase 1 integration evaluation**
  - *Refs:* REQ-1, REQ-2, REQ-11
  - *Files:* `INTEGRATION_EVAL.md`, task/contract checkboxes only.
  - *Pre-check:* Run Phase 1 focused tests and inspect scoped diff.
  - *Verify:* Existing application entry remains reachable; no parent or API
    client change; checklist mirrors `SPEC_CONTRACT.md`.
  - *Commit:* `docs(assistance-workflow/1.4): evaluate workflow foundation`

## Phase 2 — Understand and Qualify

- [x] **TASK-2.1: Extract reusable tender intelligence presentation**
  - *Refs:* REQ-3, INT-3
  - *Files:* `TenderDetail.tsx`, `TenderAnalysisWorkbench.tsx`, optional small
    reusable tender presentation components, tender-detail tests.
  - *Pre-check:* Confirm the existing tender detail and workbench remain the
    only owners of analysis transformation and source grouping.
  - *Work:* Extract composition seams only; preserve tender-detail output and
    every honest empty/partial state.
  - *Verify:* Existing tender-detail tests pass unchanged or with structural,
    not semantic, assertion updates.
  - *Commit:* `refactor(assistance-workflow/2.1): share tender intelligence`

- [x] **TASK-2.2: Build Understand stage with full analysis**
  - *Refs:* REQ-3, REQ-10, PERF-1, INT-3, INT-4
  - *Files:* create `UnderstandStage.tsx`; modify workflow wiring, fixtures and
    application screen tests.
  - *Pre-check:* Verify application detail supplies tender ID and route wiring
    can pass the existing `TendersEndpoint` and download ports.
  - *Work:* Lazy-load tender detail on first Understand visit and compose AI
    overview, full analysis and document actions.
  - *Verify:* Multi-document fixture shows every category/source, partial and
    pending states; no analysis/generation mutation is called.
  - *Commit:* `feat(assistance-workflow/2.2): add full analysis stage`

- [x] **TASK-2.3: Compose Qualify stage from existing capability**
  - *Refs:* REQ-4, REQ-10, REQ-11
  - *Files:* create `QualifyStage.tsx`; extract reusable eligibility/company
    comparison presentation where required; update tests.
  - *Pre-check:* Read `TenderActions`, compliance gaps and current comparison
    panels; preserve user-triggered eligibility semantics.
  - *Work:* Present matches, remediable gaps, disqualifiers and unknown company
    data with company-profile correction path.
  - *Verify:* Eligibility is not called on mount; errors isolate; partial stays
    distinct from yes/no; profile link works.
  - *Commit:* `feat(assistance-workflow/2.3): compose qualification stage`

- [x] **TASK-2.4: Phase 2 integration evaluation**
  - *Refs:* REQ-3, REQ-4, INT-3, INT-4
  - *Files:* `INTEGRATION_EVAL.md`, task/contract checkboxes only.
  - *Pre-check:* Run tender detail, tender endpoint, application screen,
    endpoint parity and capability tests.
  - *Verify:* Full analysis is read-only; no duplicated transformation or
    request; parent repository untouched.
  - *Commit:* `docs(assistance-workflow/2.4): evaluate analysis and qualify`

## Phase 3 — Plan and full-work-area Draft

- [x] **TASK-3.1: Extract one blueprint workspace controller**
  - *Refs:* REQ-5, REQ-8, REQ-10, INT-2
  - *Files:* create `use-response-blueprint-workspace.ts`; modify
    `ResponseBlueprintPanel.tsx` and focused tests.
  - *Pre-check:* Characterize GET, overlay, timer, enrich, generate/save and
    export states currently inside the panel.
  - *Work:* Move orchestration without changing endpoint methods, polling
    bounds, retry policies, error copy or mutation triggers.
  - *Verify:* Existing blueprint/generation/authoring tests pass; one GET owner
    and at most one bounded timer are observable.
  - *Commit:* `refactor(assistance-workflow/3.1): centralise blueprint state`

- [x] **TASK-3.2: Build Plan stage**
  - *Refs:* REQ-5, REQ-10, REQ-11
  - *Files:* create `PlanStage.tsx`; modify blueprint plan presentation,
    `ResponseBlueprintDocRow.tsx` and tests.
  - *Pre-check:* Confirm every current blueprint section has a destination and
    generation blockers route the user to Additional Information.
  - *Work:* Compose plan hierarchy and make response-document rows navigate to
    Draft; preserve Deep-analyse and entitlement behavior.
  - *Verify:* All blueprint sections render; selected document URL is encoded;
    no inline textarea remains in Plan.
  - *Commit:* `feat(assistance-workflow/3.2): organise response planning`

- [x] **TASK-3.3: Build response document navigator and editor**
  - *Refs:* REQ-6, REQ-8, UX-1, UX-2, A11Y-1
  - *Files:* create `DraftStage.tsx`, `ResponseDocumentNavigator.tsx`,
    `ResponseDocumentEditor.tsx`, reference-pane presentation and tests.
  - *Pre-check:* Verify save/generate contracts, unknown document keys,
    generated Markdown content and current 402/409/failed states.
  - *Work:* Implement a route-backed, viewport-filling modal workbench,
    document selection, formatting transforms, Save/Revert and generation
    actions through the shared controller. Make the underlying workspace inert
    and lock its scroll while the editor is open.
  - *Verify:* Tests cover Edit launch, dialog semantics, focus trap/restore,
    clean Close/Escape, all document states, long content, key navigation,
    Ctrl/Cmd+S, narrow drawer layout and no implicit mutation.
  - *Commit:* `feat(assistance-workflow/3.3): add full document editor`

- [x] **TASK-3.4: Protect unsaved edits**
  - *Refs:* REQ-7, REL-1, SEC-1, A11Y-1
  - *Files:* create `UnsavedChangesDialog.tsx`; modify editor/shell navigation
    coordination and tests.
  - *Pre-check:* Verify React Router blocker API and Tauri/webview unload
    behavior in the installed versions before choosing the adapter.
  - *Work:* Implement one dirty authority, Save/Discard/Stay for stage,
    document, Close, Escape and backdrop attempts, unload warning, focus
    management and failed-save retention.
  - *Verify:* Stage/document navigation cannot silently lose content; no draft
    appears in URL, storage or logs; dialog is keyboard accessible.
  - *Commit:* `feat(assistance-workflow/3.4): guard unsaved response drafts`

- [x] **TASK-3.5: Phase 3 integration evaluation**
  - *Refs:* REQ-5–REQ-8, INT-2
  - *Files:* `INTEGRATION_EVAL.md`, task/contract checkboxes only.
  - *Pre-check:* Run blueprint endpoint/screen tests with fake timers and router
    navigation tests.
  - *Verify:* One blueprint controller, bounded refresh cleanup, no duplicate
    editor, no lost drafts and no new API contract.
  - *Commit:* `docs(assistance-workflow/3.5): evaluate planning and authoring`

## Phase 4 — Review, migration and verification

- [x] **TASK-4.1: Build Review & Export stage**
  - *Refs:* REQ-9, REQ-10, REQ-11
  - *Files:* create `ReviewStage.tsx`; adapt readiness/export/checklist/events
    presentation and tests.
  - *Pre-check:* Confirm validation and export remain explicit and list every
    existing blocker/coverage source available without invention.
  - *Work:* Order blockers, readiness, coverage and export; retain export
    format/cancel/error behavior and non-submission notice.
  - *Verify:* Validation/export never run on mount; blockers precede export;
    PDF/DOCX paths remain tested.
  - *Commit:* `feat(assistance-workflow/4.1): add review and export stage`

- [ ] **TASK-4.2: Remove old all-panels composition and reconcile capability**
  - *Refs:* REQ-10, REQ-11, INT-1, INT-8
  - *Files:* `ApplicationWorkspace.tsx`, obsolete presentation sections,
    affected tests and fixtures.
  - *Pre-check:* Produce a capability-to-stage matrix proving every old panel
    has exactly one reachable destination.
  - *Work:* Delete old one-page composition and old inline editor after staged
    equivalents pass. Do not leave parallel flows.
  - *Verify:* Matrix has no missing or duplicated mutation authority; `rg`
    finds one response editor and one blueprint polling owner.
  - *Commit:* `refactor(assistance-workflow/4.2): retire scrolling workspace`

- [ ] **TASK-4.3: Accessibility, responsive and recovery verification**
  - *Refs:* UX-1, UX-2, A11Y-1, PERF-1, REL-1, SEC-1
  - *Files:* focused components/tests only.
  - *Pre-check:* Review at 320, 768, 1180 and 1440 widths plus 200% zoom,
    keyboard-only flow and long tender/generated content.
  - *Work:* Correct issues found within spec scope.
  - *Verify:* Focus order, dialog behavior, status text, wrapping, stage lazy
    reads, mutation locks and retry isolation pass.
  - *Commit:* `fix(assistance-workflow/4.3): harden desktop workflow`

- [ ] **TASK-4.4: Complete quality gates and changelog**
  - *Refs:* all requirements and success criteria.
  - *Files:* `CHANGELOG.md`, `INTEGRATION_EVAL.md`, task/contract checkboxes.
  - *Pre-check:* Review complete scoped diff and git history against task IDs.
  - *Work:* Add user-facing changelog notice and complete evaluation evidence.
  - *Verify:* focused/full Vitest as proportionate, `tsc --noEmit`, ESLint,
    Prettier, Rust check and `git diff --check`; no build.
  - *Commit:* `chore(assistance-workflow/4.4): complete workflow verification`
