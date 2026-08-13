# Desktop tender assistance workflow — implementation tasks

> Status: specification complete; implementation is blocked pending explicit
> user approval. Read all five spec files and the execution protocol before
> editing code. Tasks must run in order and each requires its pre-check.

## Current status

- [x] Phase 1 — workflow foundation complete
- [x] Phase 2 — Understand and Qualify complete
- [x] Phase 3 — Plan and Draft complete
- [x] Phase 3A — dynamic tender-driven document fidelity approved and complete
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

## Phase 3A — Dynamic tender-driven document fidelity

- [x] **TASK-3A.1: Characterize the parent blueprint contract read-only**
  - *Refs:* REQ-6A, REQ-6B, INT-2, INT-5
  - *Files:* specification evidence and desktop endpoint/fixture tests only.
  - *Pre-check:* Re-read the parent `response-blueprint`, blueprint builder,
    enrichment merge and generate-response-doc implementations without editing
    them. Record the exact dynamic identity and content/status fields.
  - *Work:* Add contract fixtures containing deterministic conditional docs,
    cached AI-enriched docs, unknown kinds and URL-reserved keys. Confirm the
    permissive desktop schema retains every entry and field.
  - *Verify:* No parent file changes; parsed order/count/keys equal the response;
    endpoint parity and capability-scope tests remain green.
  - *Commit:* `test(assistance-workflow/3a.1): pin dynamic blueprint documents`

- [x] **TASK-3A.2: Make Draft selection strictly key-driven**
  - *Refs:* REQ-6A, REQ-7, REQ-8, REL-1
  - *Files:* `DraftStage.tsx`, `ResponseDocumentNavigator.tsx`, shared blueprint
    controller only if reconciliation requires it, and focused tests.
  - *Pre-check:* Inventory every fallback to `documents[0]`, title/kind switch
    and navigation redirect in the Draft path.
  - *Work:* Preserve selection across add/reorder refreshes, support every
    unknown kind, open saved content or an empty generatable editor, and replace
    silent missing-key fallback with the specified recovery state. Preserve the
    current dirty-document decision flow.
  - *Verify:* Capability Statement, Pricing Schedule and an AI-added unknown
    document switch within the full-screen editor; none routes to Understand;
    removal is explicit; no local document allow-list exists.
  - *Commit:* `fix(assistance-workflow/3a.2): honor dynamic draft inventory`

- [x] **TASK-3A.3: Separate working drafts from official returnables**
  - *Refs:* REQ-6B, UX-2, INT-3, INT-4
  - *Files:* Draft reference-pane presentation and focused screen tests; reuse
    existing tender document/download presentation where practical.
  - *Pre-check:* Confirm which source-document names/actions are already
    available in the application workflow without widening an endpoint.
  - *Work:* Add clear working-draft language, show `brief`/`requiredBy`, and
    surface the existing official attachment action/list for pricing schedules,
    BOQs and form-like returnables. Do not implement XLSX/PDF editing.
  - *Verify:* A pricing fixture cannot be mistaken for a completed official
    workbook; download/open remains explicit and uses the existing port.
  - *Commit:* `feat(assistance-workflow/3a.3): distinguish official returnables`

- [x] **TASK-3A.4: Dynamic-document integration evaluation**
  - *Refs:* REQ-6A, REQ-6B, REQ-8, INT-1–INT-8
  - *Files:* `INTEGRATION_EVAL.md`, `SPEC_CONTRACT.md`, task checkboxes only.
  - *Pre-check:* Run focused endpoint, Draft, Plan, navigation and tender-
    document tests plus TypeScript, ESLint, Prettier, Rust and diff checks.
  - *Verify:* Desktop remains a pure consumer; no endpoint/schema/pipeline/main-
    repo change; every server blueprint entry is usable; one editor/controller.
  - *Commit:* `docs(assistance-workflow/3a.4): evaluate dynamic documents`

## Phase 3B — Route-level WYSIWYG workbench (superseding amendment)

- [x] **TASK-3B.1: Replace modal route composition with the route-level workbench**
  - *Refs:* REQ-6, REQ-7, UX-1, A11Y-1
  - *Files:* router, `DraftStage`, application workspace and route tests.
  - *Work:* Mount the draft deep-link outside `AppLayout`, remove portal/dialog
    semantics and retain keyed switching plus dirty guards.
- [x] **TASK-3B.2: Replace raw Markdown textarea with WYSIWYG Markdown adapter**
  - *Refs:* REQ-6, UX-2, SEC-1
  - *Files:* editor components, package manifest and authoring tests.
  - *Work:* Import canonical Markdown into Tiptap, edit visually, serialize
    Markdown for every draft/save path, including tables and links.
- [x] **TASK-3B.3: Reuse export flow with save-before-export safety**
  - *Refs:* REQ-6C, REQ-7, REQ-9
  - *Files:* reusable export hook/buttons, Draft and Review, export tests.
  - *Work:* Share the endpoint/native-save flow; save dirty Markdown before
    package export and stop when save fails.
- [x] **TASK-3B.4: Verify authoring, routing, accessibility and round trips**
  - *Refs:* REQ-6–REQ-9, A11Y-1, REL-1
  - *Files:* focused and adjacent tests, changelog and evaluation.
  - *Work:* Cover Markdown rendering/round trips, formatting, tables, keyboard
    save, route ownership, dirty navigation/export and responsive rails.

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
