# Desktop tender assistance workflow — requirements

## Context note

### Recent related work

- `62e47e8` corrected application creation to use the existing parent route.
- `7c19a1e`, `a599174`, `4106611` and `7faf6dc` exposed existing tender
  intelligence and improved the tender-detail reading hierarchy.
- `4389020`, `04e1882` and `7b3cf89` verified response authoring, deep
  analysis and workspace package export against the live contracts.
- The current workspace is implemented in
  `src/features/applications/ApplicationWorkspace.tsx`. It renders every
  assistance panel in one long, two-column page.
- `ResponseBlueprintPanel.tsx` and `ResponseBlueprintDocRow.tsx` already own
  blueprint loading, generation, editing, bounded status refresh, enrichment
  and export. This specification reorganises those capabilities; it does not
  replace them.

### Reality check

- **Decision: Enhance Existing.** The assistance functionality already exists.
  The missing capability is a coherent desktop information architecture and a
  suitable authoring surface.
- The tender analysis workbench already consolidates stored analysis from all
  tender documents. The application workspace currently shows only a small
  analysis-status panel and basic tender fields.
- Existing parent read and mutation contracts are sufficient: application
  detail/cockpit, tender detail, compliance gaps, research, additional
  information, response blueprint, response-document generation/save,
  enrichment, validation, downloads and package export.
- The main application is read-only for this work. No parent endpoint, schema,
  query, AI prompt, analysis stage, cron, or service may be created or changed.

## Objective

- **Why:** Business users need to move from understanding a tender to producing
  a compliant response without hunting through an unstructured wall of panels.
- **Goal:** Turn the existing application workspace into a staged desktop bid
  preparation workflow and give generated response documents a dedicated,
  full-work-area editor.
- **Primary user:** A company owner, bid manager or administrator preparing a
  South African tender response, often under deadline pressure.
- **Primary outcome:** The user always knows what stage they are in, what is
  incomplete, what evidence supports the guidance, and what action comes next.

## Non-goals

- No new parent API, database field, migration, analysis process, prompt,
  embedding, vector, extraction or generation path.
- No local AI analysis and no recalculation of parent-owned matching,
  eligibility, readiness, confidence or compliance scores.
- No automatic bid submission, price approval, final-pack approval, or stage
  advancement without an explicit human action.
- No browser-style copy of the public tender page and no duplicate application
  workspace running beside the existing one.
- No simultaneous multi-user collaborative editing, tracked changes, DOCX
  round-trip editing, or WYSIWYG pagination in this iteration.
- No automatic save of response content. Explicit Save remains the authority.

## Workflow model

The application workspace shall expose five user-facing stages. These are a
presentation workflow over existing records, not a replacement for the
server-owned application status or assistance stage.

1. **Understand** — opportunity snapshot, AI summary/key requirements, complete
   multi-document analysis, source-document provenance and downloads.
2. **Qualify** — company-versus-tender comparison, eligibility, compliance
   gaps, missing evidence and risks.
3. **Plan** — response blueprint, required user documents, additional
   information, research, submission instructions, dates and preparation steps.
4. **Draft** — response-document list and dedicated authoring workspace for one
   generated document at a time.
5. **Review & Export** — readiness validation, unresolved blockers, checklist,
   timeline/events, generated-document coverage and export controls.

## Functional requirements

### REQ-1 — Persistent workflow shell

The existing application route shall render a persistent workspace shell with:

- tender title, buyer, reference, status and closing urgency;
- five named workflow destinations in the order above;
- completed/current/attention status conveyed by text and icon, never colour
  alone;
- a compact progress summary derived only from existing payload fields;
- Back to applications and View tender detail navigation;
- a main content region that shows one stage at a time.

The selected stage must be URL-addressable and survive refresh. Unknown stages
must redirect to Understand. Browser Back/Forward must traverse stage changes.

### REQ-2 — Honest stage state

Workflow indicators may summarise existing application, cockpit, blueprint and
validation data, but must not invent completion. When required data has not
loaded or cannot be interpreted, the stage reads **Not assessed**, not complete.
The parent-owned `application.status` and assistance stage remain visually
separate from the five presentation stages.

### REQ-3 — Full tender document analysis in Understand

Understand must show the full existing tender intelligence experience for the
tender being applied for:

- AI summary and key requirements when present;
- AI-analysed compliance/submission requirements with special emphasis;
- evaluation, technical, financial, date and contact findings;
- source-document grouping and analysis coverage;
- document inventory and existing download/open actions;
- honest pending, partial, failed and no-analysis states.

It must reuse `TendersEndpoint.get(tenderId)` and the existing tender analysis
presentation logic. It must not trigger analysis, call generation endpoints, or
infer that missing analysis means no requirements.

### REQ-4 — Qualify stage

Qualify must bring together the existing company snapshot, tender requirements,
eligibility check and compliance-gaps result. It must separate:

- recorded matches;
- remediable gaps;
- potential disqualifiers;
- missing or unverified company information.

The eligibility computation remains user-triggered. A link to the existing
company profile editor must remain available.

### REQ-5 — Plan stage

Plan must present the response blueprint as a preparation plan rather than an
embedded authoring surface. It includes required evidence, response-document
coverage, additional-information questions, research, submission details,
risks, steps and dates. Each response-document row opens the Draft stage for
that document. Deep-analyse remains an explicit, entitlement-aware action.

### REQ-6 — Route-level full-screen response-document workbench

Selecting **Edit** for a generated response document must navigate to a
dedicated, viewport-filling route-level workbench. The normal application shell
and assistance workspace must not be mounted underneath it. The editor must not
be embedded inside a response-document row or constrained by the normal page
container.
It shall contain:

- a document navigator showing every blueprint response document and its
  Saved, Generating, Failed or Not started state;
- document title, purpose/brief, mandatory marker and provenance;
- a large editable canvas for the selected generated document;
- an optional side reference pane containing relevant blueprint instructions,
  key requirements and source-linked analysis without replacing the draft;
- explicit Save, Cancel/Revert draft, Generate, Regenerate and Retry controls
  according to current document state;
- Save state and last successful save feedback;
- keyboard-accessible movement between response documents.

The workbench must provide a clearly labelled Close control, page/workbench
semantics (not dialog semantics), and move focus to the document editor on
open. Close and document switching must preserve the existing dirty-document
decision. At narrow widths the navigator and reference pane collapse into
labelled drawers while the editing canvas retains the available height and
width.

The editor must preserve the current string/Markdown-compatible content
contract while presenting a WYSIWYG document model by default. Markdown import
and serialization must preserve headings, emphasis, lists, blockquotes, links,
horizontal rules and tables. Visual controls must cover headings 1–4, bold,
italic, strike, lists/indentation,
links, tables, clear formatting and undo/redo. Source Markdown may be exposed
only as an optional advanced view.

The formatting toolbar must use compact, familiar icon controls with accessible
names, tooltips, visible focus and selection-aware states. Paragraph and heading
levels 1–4 use one text-style selector, related commands are separated into
visual groups, and table row/column operations use one compact table menu.
Save, Revert and response-package export actions remain visually separate from
formatting and use labelled icon controls; Generate/Regenerate may retain text
because its changing lifecycle state is meaningful.

The document navigator uses compact file rows and distinct Saved, Unsaved,
Generating, Failed and Not started status icons. The drafting-reference pane
normalizes source filenames into readable labels, truncates them within the
rail, retains the original filename as a tooltip and exposes open/download as
labelled icon actions.

The editor canvas integrates with the application theme rather than simulating
a white printed page; this presentation must not affect canonical Markdown or
server-generated PDF/DOCX styling. A persistent multiline AI composer below
the canvas replaces the toolbar instructions field. Enter submits and
Shift+Enter inserts a line break, using the existing keyed generation contract
and bounded refresh. Duplicate submission is disabled while generating, and
dirty manual edits must be saved or reverted before AI regeneration starts.

### REQ-6C — Editor export and latest-content safety

The workbench header must expose honest **Download response PDF** and
**Download response Word** actions using the existing
`exportWorkspacePackage` and native `saveDownload` path. When the selected
document is dirty, export must first save its serialized Markdown through
`saveResponseDocument`; export may proceed only after that save succeeds.
The controls export the full branded response package, not only the selected
document.

### REQ-6A — Tender-driven document inventory

The Draft document list is owned exclusively by the response blueprint returned
from the existing parent application. The desktop must not define a fixed
catalogue of cover letters, capability statements, methodologies, pricing
schedules or any other response type. It must render every valid entry in
`blueprint.responseDocuments[]`, in server order, using the server-provided
`key`, `title`, `kind`, `brief`, `requiredBy` and `mandatory` values.

- An unknown or newly introduced `kind` must remain usable as a normal response
  document; it must not be filtered, renamed to a known type or redirect the
  workspace.
- A document with saved content in `responseDocs[key]` opens that content.
- A document without saved content opens an empty editor with Generate enabled
  when the existing generation preconditions permit it.
- Generate, Save, status and placeholder lookups must use the exact blueprint
  key. Positional indexes, titles and desktop-owned aliases are not document
  identities.
- Blueprint refresh may add, remove or reorder documents after server-side AI
  enrichment. The navigator must reconcile by key, keep the current selection
  when it still exists, and choose the first available document only when the
  selected key genuinely disappears.
- No default document may be silently substituted when a requested key is
  present in the route but absent from the current blueprint. The UI must show
  an honest “document is no longer in this response plan” recovery state with a
  return to the document list.
- Opening or moving between documents must not call document analysis or
  blueprint enrichment. Enrichment and generation remain explicit existing
  parent actions.

The response blueprint is already produced from stored tender/document
analysis and optional cached AI enrichment by the parent application. The
desktop consumes that result and must not recreate its keyword rules, AI prompt,
document taxonomy or merge logic.

### REQ-6B — Generated drafts versus official returnables

The workbench must distinguish assistant-authored response content from an
official tender attachment that the bidder must complete in its original
format. In particular, a blueprint item titled “Pricing Schedule” currently
uses the existing string/Markdown response-document contract; it is not proof
that a buyer-supplied XLSX, PDF form or bill of quantities has been completed.

For each blueprint document, the reference pane must show its `brief` and
`requiredBy` source text. Where related tender source documents are available
through the existing tender-detail/document data, the workbench must offer the
existing download/open action and use clear copy such as “Working draft” and
“Complete the official returnable” rather than claiming the source file was
edited. No spreadsheet or PDF mutation, upload or new artifact endpoint is in
scope for this specification.

### REQ-7 — Unsaved-change protection

While a response document contains unsaved edits:

- moving to another workflow stage or response document must ask the user to
  Save, Discard, or Stay;
- browser/desktop route navigation must be blocked where React Router permits;
- closing or reloading the webview must receive a native before-unload warning;
- closing the full-screen editor, pressing Escape, or clicking its backdrop
  must use the same Save, Discard, or Stay decision;
- Cancel/Revert must restore the last server-confirmed content;
- a failed save must retain the draft and display an inline actionable error.

No draft content may be written to logs, analytics, URLs or browser storage.

### REQ-8 — Generation lifecycle

Generate/Regenerate/Retry must reuse the existing endpoint and bounded refresh
behaviour. A generating document remains usable as navigation context but its
editor is read-only until ready. The workflow must preserve current 402 plan,
409 precondition, failed-generation and timeout guidance. It must never start
generation simply because the Draft stage was opened.

Generation must accept every key present in the current blueprint, including
AI-enriched `other` kinds. The desktop must never gate Generate by a local
allow-list of document names or kinds.

### REQ-9 — Review and export

Review & Export must consolidate existing validation, checklist, events,
document coverage and export actions. Validation is run only on explicit user
request. Export remains an explicit PDF/DOCX action and must not imply that the
pack has been submitted or approved. Blockers and unresolved placeholders must
be visible before export controls.

### REQ-10 — Progressive loading and failure isolation

The shell and currently selected stage must render independently. A failure in
tender analysis, research, blueprint, validation or export may degrade only its
own surface and must not blank the entire workspace. Stages not yet visited
must not start expensive or mutating requests merely because the workspace
opened.

### REQ-11 — Existing capability preservation

All currently working capabilities must remain reachable: stage updates,
urgency, value estimate, checklist, events, compliance gaps, research,
additional information, blueprint enrichment, response generation/editing,
tender downloads, readiness validation and package export.

## Non-functional requirements

### UX-1 — Desktop composition

- At widths of 1180px and above, use a persistent workflow rail and broad work
  area. Draft may use a document rail + editor + collapsible reference pane.
- From 768–1179px, workflow navigation becomes a horizontal/compact step bar;
  the reference pane becomes a drawer.
- Below 768px, stages remain usable sequentially; no content is hidden solely
  because the desktop application window is narrow.
- The primary action and next recommended action must be visible without
  scanning unrelated panels.

### UX-2 — Readability

Long tender references, buyer names, requirements and generated text must wrap
without horizontal page scrolling. Content width inside the editor should
remain readable while the editing canvas can use available desktop width.

### A11Y-1 — Accessibility

The workflow uses semantic navigation and headings, visible focus, keyboard
operation, labelled icon controls, status text in addition to colour, and a
logical focus move when stages/documents change. Dialogs trap focus, restore it
to the initiating control and support Escape only when dismissal will not lose
unsaved work.

### PERF-1 — Request discipline

- Initial workspace load remains bounded to application detail plus the
  existing cockpit request.
- Tender detail and stage-specific reads load on first visit and may be cached
  for the workspace lifetime.
- Steady-state screens do not poll. Only existing bounded generation refresh
  may poll, at its current maximum window.
- Large generated content must not be duplicated into global state.

### SEC-1 — Data and authority

Bearer-token, Tauri transport, redaction and owner-scoped parent authorization
remain unchanged. Draft text stays in component memory until explicit Save.
AI guidance must remain labelled as derived and subject to source verification.

### REL-1 — Recovery

Retrying a failed read must not reset other loaded stages or unsaved editor
content. Mutation controls remain disabled while their own request is active.

## Integration requirements

- **INT-1:** Extend `ApplicationWorkspace`; do not create a parallel workspace.
- **INT-2:** Reuse `ResponseBlueprintPanel` logic by separating plan summary,
  orchestration and document editor responsibilities; do not duplicate endpoint
  calls or generation timers.
- **INT-3:** Reuse `TenderAnalysisWorkbench`/analysis presentation with tender
  data loaded through the existing `TendersEndpoint`.
- **INT-4:** Extend the existing application route wiring to supply the tender
  read client and preserve document download ports.
- **INT-5:** Preserve all existing `ApplicationsEndpoint` routes and response
  schemas. No new parent contract is assumed.
- **INT-6:** Preserve endpoint-parity and Tauri capability-scope protections.
- **INT-7:** Preserve existing URLs `/applications` and
  `/applications/:applicationId`; the latter redirects to its default workflow
  stage rather than disappearing.
- **INT-8:** Existing completed slice specifications remain historical owners
  of their API behaviour. This specification owns only workflow composition
  and authoring presentation.

## Success criteria

- Opening an application shows Understand rather than every panel at once.
- The user can reach every stage directly by URL and navigate with Back/Forward.
- Understand displays the full stored multi-document analysis for that tender.
- A response document opens in a dedicated editor using the majority of the
  application work area and saves through the existing mutation.
- Unsaved changes cannot be silently lost through stage/document navigation.
- A fixture blueprint containing base, conditional and AI-enriched documents
  (including `pricing`, an unknown kind and a key with URL-reserved characters)
  renders every item and opens the correct saved or empty editor.
- A blueprint refresh that adds or reorders documents preserves selection by
  key; removal produces an explicit recovery state rather than silently opening
  Cover Letter or returning to Understand.
- Pricing Schedule is presented as editable generated working content alongside
  an honest path to the official tender attachment, never as an edited XLSX/PDF.
- Review & Export identifies blockers before presenting export actions.
- No parent files, endpoints, schemas or analysis pipeline components change.
- Focused tests, full TypeScript check, lint, formatting and Rust check pass.
