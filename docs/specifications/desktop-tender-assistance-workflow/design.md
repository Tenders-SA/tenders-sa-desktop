# Desktop tender assistance workflow — design

## Implementation strategy

- **Approach:** Enhance Existing.
- **Owner:** `ApplicationWorkspace` remains the canonical application-assistance
  route owner. Existing panels and endpoint clients remain canonical for their
  domain operations.
- **Risk:** Splitting a long screen into routes can duplicate reads or lose local
  state. Mitigate with a route-level workspace controller, stage-local loading,
  one blueprint controller and explicit unsaved-change guards.
- **Boundary:** Parent repository and document-analysis pipeline are read-only.

## Information architecture

```text
/applications/:applicationId/:stage
┌──────────────────────────────────────────────────────────────────────┐
│ Tender title · buyer · reference       status · closes · progress    │
├────────────────┬─────────────────────────────────────────────────────┤
│ Understand     │                                                     │
│ Qualify        │              selected stage work area               │
│ Plan           │                                                     │
│ Draft          │                                                     │
│ Review & Export│                                                     │
└────────────────┴─────────────────────────────────────────────────────┘

/applications/:applicationId/draft/:documentKey
┌──────────────┬───────────────────────────────────┬───────────────────┐
│ response docs│ full-screen modal editor canvas   │ references        │
│ + statuses   │ toolbar · content · save state    │ brief/requirements│
└──────────────┴───────────────────────────────────┴───────────────────┘
```

Canonical stage slugs: `understand`, `qualify`, `plan`, `draft`, `review`.
`/applications/:applicationId` redirects to `understand`. Draft with no key
selects the first response document without changing server state. Invalid
stage/document values resolve to the closest safe parent route with an honest
empty state.

## Task hierarchy

| Stage | Question answered | Primary action | Secondary action |
|---|---|---|---|
| Understand | What is this tender asking for? | Review critical requirements | Open/download sources |
| Qualify | Can this company bid credibly? | Check eligibility | Resolve profile/gaps |
| Plan | What must we prepare, and in what order? | Complete required information | Open a response document |
| Draft | What will we submit? | Save selected document | Generate/regenerate |
| Review | Is the package ready to export? | Check readiness | Export PDF/DOCX |

## State architecture

### Workspace route controller

`ApplicationWorkspace` owns only stable route-wide state:

- application detail `useAsync` result;
- existing cockpit `useAsync` result;
- active stage/document from route params;
- stage summaries derived from loaded results;
- document-download ports.

It does not copy server records into Zustand or SQLite. Stage components own
their asynchronous reads and errors. Loaded stage data remains mounted/cached
for the route lifetime where practical, but only the selected stage is visible.

### Blueprint controller

Extract the stateful core of `ResponseBlueprintPanel` into a single
`useResponseBlueprintWorkspace` hook/controller. It owns:

- blueprint GET state and reload;
- response content/status overlay;
- bounded generation refresh and cleanup;
- enrich state;
- save/generate callbacks;
- export state only where Review consumes it.

Plan and Draft consume the same controller instance provided by the workflow
shell. This prevents two GETs, two generation timers, or conflicting overlays.
Existing endpoint methods and retry policies remain unchanged.

### Editor state

`ResponseDocumentEditor` owns `serverContent`, `draft`, `dirty`, save state and
selection. It resets only after:

- a different document is selected with Save/Discard approval;
- server save succeeds; or
- the user explicitly reverts.

Draft content is component memory only. The URL contains `documentKey`, never
content. A route blocker and `beforeunload` guard share one `dirty` authority.

## Component design

| Component | Purpose |
|---|---|
| `ApplicationWorkflowShell` | Persistent opportunity header, stage navigation and main work area |
| `WorkflowNavigation` | Semantic stage links, state labels and compact responsive form |
| `UnderstandStage` | Tender overview, complete analysis and source documents |
| `QualifyStage` | Company comparison, eligibility and compliance gaps |
| `PlanStage` | Blueprint plan, evidence, questions, research, steps and dates |
| `DraftStage` | Response-document overview and route-backed full-screen editor launcher |
| `ResponseDocumentNavigator` | Response docs with statuses and keyboard selection |
| `ResponseDocumentEditor` | Large controlled editor, formatting actions, save/revert/generate controls |
| `DraftReferencePane` | Selected-document brief plus relevant tender intelligence |
| `UnsavedChangesDialog` | Save/Discard/Stay decision for internal navigation |
| `ReviewStage` | Validation, blockers, checklist/events, coverage and export |
| `useResponseBlueprintWorkspace` | One blueprint/generation/save orchestration authority |

Existing panels should be composed or adapted rather than copied. Presentational
extraction is permitted where a panel currently mixes fetching and rendering.

## Full document analysis integration

`UnderstandStage` receives `tenderId` from application detail and calls the
existing `TendersEndpoint.get`. It composes:

1. opportunity/AI overview presentation already used by tender detail;
2. `TenderAnalysisWorkbench` for consolidated multi-document findings;
3. the existing document list/download controls.

To avoid duplicating tender-detail markup, extract reusable presentation from
`TenderDetail.tsx` only where needed. The analysis point transformation remains
in `analysis-presentation.ts`. No application endpoint schema is widened to
pretend it owns analysis it does not return.

## Response blueprint decomposition

The current 565-line `ResponseBlueprintPanel` becomes three responsibilities:

- controller/hook: fetch, overlay, generation refresh, enrich;
- Plan presentation: required documents, response document coverage, steps,
  submission and risks;
- Draft presentation: selected document and authoring actions.

`ResponseBlueprintDocRow` ceases to host the textarea. It becomes a compact
plan/navigator row that routes to Draft. Its current mutation/error semantics
move intact into `ResponseDocumentEditor`.

## Editor interaction design

### Layout

- Edit opens a fixed, viewport-filling modal (`role="dialog"`, `aria-modal`) at
  the application root, above the persistent workflow shell. It uses the full
  webview rather than inheriting page width or padding constraints.
- A compact modal header identifies the response document and contains status,
  Save/Revert/Generate actions and an explicit Close control.
- Left: 14–18rem response-document navigator.
- Centre: flexible editor with a readable inner measure and large vertical
  canvas; no card-within-card treatment.
- Right: 18–22rem collapsible reference pane.
- A sticky editor command bar contains Save, Revert, Generate/Regenerate,
  document status and dirty/saved feedback.
- The modal body owns its overflow. The application page behind it does not
  scroll and is inert while editing. At narrow widths, navigator and references
  become explicit drawers; the editor remains the primary surface.

### Formatting

Use the existing string content contract. A lightweight toolbar performs
selection-aware Markdown-compatible transformations for heading, bold, bullet
and numbered list. Keyboard shortcuts include Ctrl/Cmd+S for Save and standard
text editing. No HTML persistence and no new rich-text dependency are required.

### Navigation guard

When dirty, a stage or document navigation request opens
`UnsavedChangesDialog`:

- **Save and continue:** await existing save mutation, then navigate;
- **Discard:** restore server content, then navigate;
- **Stay:** close dialog and restore focus.

Failed Save keeps the dialog/editor open. `beforeunload` covers application
window refresh/close. Router blocker availability must be verified against the
installed React Router version before implementation; if the stable blocker API
is unavailable, navigation flows must go through shell-owned guarded handlers.
The same guard handles Close, Escape and backdrop attempts. Clean Close returns
to Plan (or the prior workflow route) and restores focus to the launching Edit
control; dirty Close never dismisses the editor without a decision.

## Stage composition

### Understand

- tender intelligence heading and verification notice;
- full `TenderAnalysisWorkbench`;
- source documents/downloads;
- analysis coverage and partial/pending states.

### Qualify

- existing tender/company comparison;
- eligibility control/report extracted from `TenderActions` for reuse;
- `ComplianceGapsPanel`;
- company-profile link and explicit missing-data status.

### Plan

- `AdditionalInfoPanel` first when required answers block generation;
- blueprint response-document coverage/navigator;
- required user documents;
- research;
- steps, submission instructions, dates and risks;
- Deep-analyse action with current entitlement/error behavior.

### Draft

- controller-backed response documents;
- dedicated editor and reference pane;
- existing bounded generation refresh;
- no export control competing with authoring.

### Review

- explicit readiness check;
- unresolved compliance gaps/placeholders and missing docs;
- `ChecklistPanel`, `EventsPanel`, value estimate and relevant status;
- export format choice after blockers;
- human-responsibility notice: export is not submission.

## API and data contracts

No new routes. Existing calls only:

| Existing client method | Stage | Behavior |
|---|---|---|
| `ApplicationsEndpoint.get/getCockpit` | shell | initial bounded reads |
| `TendersEndpoint.get` | Understand | full stored tender/document analysis |
| `checkEligibility/getComplianceGaps` | Qualify | existing explicit/read behavior |
| `getResearch/getAdditionalInfo/saveAdditionalInfo` | Plan | existing behavior |
| `getResponseBlueprint/enrichBlueprint` | Plan/Draft | shared controller |
| `generateResponseDocument/saveResponseDocument` | Draft | explicit mutations |
| `validate/exportWorkspacePackage` | Review | explicit actions |
| document download client | Understand | existing R2-backed path |

## Files to create

| Path | Purpose |
|---|---|
| `src/features/applications/workflow/ApplicationWorkflowShell.tsx` | persistent shell |
| `src/features/applications/workflow/WorkflowNavigation.tsx` | responsive stage navigation |
| `src/features/applications/workflow/workflow-state.ts` | pure stage/status derivation |
| `src/features/applications/workflow/UnderstandStage.tsx` | full tender intelligence |
| `src/features/applications/workflow/QualifyStage.tsx` | eligibility/gaps composition |
| `src/features/applications/workflow/PlanStage.tsx` | blueprint preparation plan |
| `src/features/applications/workflow/DraftStage.tsx` | full authoring composition |
| `src/features/applications/workflow/ReviewStage.tsx` | readiness/export composition |
| `src/features/applications/workspace/use-response-blueprint-workspace.ts` | shared blueprint controller |
| `src/features/applications/workspace/ResponseDocumentEditor.tsx` | editor and save/generate actions |
| `src/features/applications/workspace/ResponseDocumentNavigator.tsx` | document list/status navigation |
| `src/features/applications/workspace/UnsavedChangesDialog.tsx` | guarded navigation decision |

The implementer may combine tiny presentational files only by updating this
spec before implementation; no component may become another 500-line owner.

## Files to modify

| Path | Change |
|---|---|
| `src/app/router/routes.tsx` | nested/addressable workflow routes; pass tender client/download ports |
| `src/features/applications/ApplicationWorkspace.tsx` | reduce to loading/controller orchestration and shell wiring |
| `src/features/applications/workspace/ResponseBlueprintPanel.tsx` | retain/recast plan presentation using shared controller |
| `src/features/applications/workspace/ResponseBlueprintDocRow.tsx` | compact row/navigation; remove inline editor |
| `src/features/tenders/TenderDetail.tsx` | extract reusable intelligence/document presentation only if required |
| `src/features/tenders/detail/TenderAnalysisWorkbench.tsx` | accept reusable context/presentation props only if required |
| `src/tests/module-screens.test.tsx` | workflow, authoring and regression coverage |
| `src/tests/navigation-reachability.test.tsx` | route reachability and fallback coverage |
| `src/tests/fixtures/api-clients.ts` | provide any newly required existing client stubs |
| `CHANGELOG.md` | implementation-time user-facing entry |

No change is planned for `ApplicationsEndpoint`, parent code, schemas or Tauri
capabilities. If implementation discovers a missing read contract, it must
record the limitation and stop that task; it must not modify the parent.

## Backward compatibility and rollout

1. Add workflow routes while retaining `/applications/:applicationId` as a
   redirect to Understand.
2. Extract the shared blueprint controller without changing visible behavior.
3. Move existing panels stage by stage, keeping tests green at each boundary.
4. Introduce Draft editor and only then remove the old inline textarea.
5. Remove the old all-panels-at-once composition in the same implementation;
   leaving both is a defect.

Rollback is component-level: restore the previous composition while retaining
endpoint clients and server records. No data migration or rollback is needed.

## Verification plan

- Pure tests for stage derivation and unknown/unloaded state.
- Router tests for all stage URLs, default redirect, invalid stage and Back.
- Screen tests for lazy stage reads and failure isolation.
- Tender analysis tests proving all source-document findings render in
  Understand and no analysis mutation occurs.
- Authoring tests for open/edit/save/revert, Ctrl/Cmd+S, dirty guard,
  Save/Discard/Stay, save failure, generation lifecycle and cleanup.
- Accessibility tests for navigation semantics, focus movement, dialog focus
  restoration and text status.
- Long-content/narrow-window tests for reference and generated text wrapping.
- `vitest` focused suites, full `tsc --noEmit`, ESLint, Prettier, Rust check and
  `git diff --check`. No build command.

## Impact map

```text
routes.tsx
  └─ ApplicationWorkspace
      └─ ApplicationWorkflowShell
          ├─ Understand ── TendersEndpoint + analysis + downloads
          ├─ Qualify ───── eligibility + compliance gaps + company
          ├─ Plan ──────── shared blueprint controller + info/research
          ├─ Draft ─────── shared blueprint controller + editor
          └─ Review ────── validation + checklist/events + export
```

Blast radius is limited to desktop application workflow presentation, related
screen/router tests and reusable tender presentation. Authentication, billing,
database, parent routes and analysis production are outside scope.
