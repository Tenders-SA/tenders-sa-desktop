# Desktop Workspace — Response Document Authoring Enhancements — Requirements (Slice 9)

## Context note

### Recent related work

- Slice 8 (`desktop-workspace-response-doc-editor-hardening`) closes the defect
  findings G1/G2/G3/G5/G6/G10/G11 and introduces the shared status/error helper
  this slice builds on. It is a dependency: this slice assumes the full-screen
  editor already surfaces failures and generation outcomes.
- The canonical `desktop-tender-assistance-workflow` spec defines the Draft
  stage as "response-document list and dedicated authoring workspace for one
  generated document at a time" (REQ-6) and requires generation to reuse the
  existing 202-idempotent endpoint and bounded refresh (REQ-8).

### Reality check

- **Decision: Enhance Existing.** Batch generation, an optional prompt, and a
  draft list landing are extensions of the existing `useResponseBlueprintWorkspace`
  / `DraftStage` / `ResponseDocumentEditor` surfaces — not new parallel modules.
- `generateResponseDocument(id, key, prompt?)` already accepts an optional
  `prompt` argument (`applications.ts:1061`) that the UI currently never sends
  (finding G7). No parent change is needed.
- The Draft stage today opens the first document full-screen when no key is in
  the route (`DraftStage.tsx:135-136`); there is no index/list landing (G12).

## Objective

- **Why:** A bidder preparing many response documents must generate them one at
  a time, cannot give the AI any targeted instruction, and has no at-a-glance
  draft list before entering an editor.
- **Goal:** Add a draft-list landing view, a single "generate all remaining"
  action, and an optional instructions field for regeneration — all reusing the
  existing endpoint and bounded refresh, and only ever on explicit human action.
- **Primary outcome:** The Draft stage reads as a menu of drafts, and producing
  or refining every response document is a smaller number of explicit, informed
  actions.

## Non-goals

- No new parent API, schema, field, migration, prompt, embedding, vector,
  extraction or generation path. The `prompt` argument already exists.
- No automatic generation; every generate press (single or batch) is explicit.
- No batch *save*, no submission, no pricing approval.
- No local persistence or version history (Slice 10).
- No WYSIWYG or second document format.

## Functional requirements

### RA-1 — Batch generate remaining documents (G9)

The draft-list landing view exposes a single **Generate all** action that:

- triggers `generateResponseDocument` once per response document that has no
  saved content and no in-flight generation, in server order;
- runs through the existing bounded follow-up refresh so statuses update
  without a loading flash;
- surfaces per-document 402/409 failures through the shared
  `describeGenerateError` helper (from Slice 8), aggregated honestly rather than
  failing silently;
- is disabled while a batch is in flight and never re-issues a key that is
  already generating (parent 202-idempotency is the backstop, not the policy).

Because each generate spends real AI inference, the action must be labelled with
its consequence ("Generate all N remaining documents") and require a single
explicit press; there is no auto-run on opening the Draft stage.

### RA-2 — Optional instructions for (re)generation (G7)

The full-screen editor's Generate/Regenerate control gains an optional plain-text
instructions field:

- the text is passed as the `prompt` argument to `generateResponseDocument`;
- the field is clearly labelled as optional guidance and cleared after the
  generate press is acknowledged (202);
- the prompt is never persisted to the parent independently, never shown back
  from a server string, never logged, and never auto-submitted;
- the same `retry: "never"` mutation policy and 402/409/unknown handling from
  Slice 8 apply unchanged.

### RA-3 — Draft list landing view (G12)

Navigating to the Draft stage without a document key
(`/applications/:applicationId/draft`) renders a draft index first, instead of
opening the first document:

- every `blueprint.responseDocuments[]` entry is listed in server order with its
  title, `kind`, mandatory marker, and a Saved / Generating / Failed / Not
  started status (reusing the shared `describeResponseDocStatus` helper);
- selecting a row opens the full-screen editor for that document; the existing
  deep link `/applications/:applicationId/draft/:documentKey` continues to open
  directly into a document;
- the "Generate all" action (RA-1) lives on this landing view;
- an empty blueprint shows the existing honest "No response documents are
  available yet" state.

## Non-functional requirements

- Component-owned copy; no server strings.
- Steady state timer-free; polling only during an in-flight generation refresh.
- Accessibility: the list is a labelled `nav`/list; Generate-all and per-row
  actions are keyboard-reachable; status conveyed by text, not colour alone.
- No mutation auto-retry; existing transport policies unchanged.

## Integration requirements

- Extend `DraftStage` (or a small `ResponseDocumentList` extracted from it) and
  `ResponseDocumentEditor`; reuse `useResponseBlueprintWorkspace` as the single
  blueprint/status owner.
- The shared helper from Slice 8 (`response-doc-status.ts`) is the only source
  of status labels and generate-error copy.

## Success criteria

- The Draft stage without a key shows a list of all documents with correct
  statuses; selecting one opens its editor; the deep link still opens directly.
- "Generate all" issues one request per unsaved, non-generating document and
  reflects statuses via the bounded refresh; a forced 402/409 is surfaced, not
  silent.
- The optional instructions field is passed as `prompt` and never shown back or
  persisted independently.
- `vitest`, `tsc --noEmit`, `eslint`, `prettier --check` pass with new coverage
  for RA-1/RA-2/RA-3.
