# Desktop Workspace — Response Document Editor Hardening — Requirements (Slice 8)

## Context note

### Recent related work

- The staged assistance workflow shipped in `desktop-tender-assistance-workflow`
  (APPROVED 2026-08-12, dynamic-document amendment 2026-08-13). Its REQ-6
  defines the full-screen response editor; REQ-6A makes
  `blueprint.responseDocuments[]` the only Draft inventory; REQ-7 covers
  unsaved-change protection; REQ-8 covers the generation lifecycle.
- The gap analysis in
  [`reports/response-document-creator-gap-analysis.md`](../../reports/response-document-creator-gap-analysis.md)
  catalogued 12 findings. This slice closes the seven *defect* findings — G1,
  G2, G3, G5, G6, G10, G11 — none of which requires a new parent contract.
- Findings G4/G8 (local persistence) and G7/G9/G12 (new authoring features) are
  deliberately split into Slice 9 and Slice 10; they are feature-shaped and
  touch the canonical spec's non-goals (SEC-1), so they get their own specs.

### Reality check

- **Decision: Enhance Existing.** The full-screen editor (`DraftStage.tsx`,
  `ResponseDocumentEditor.tsx`, `ResponseDocumentNavigator.tsx`,
  `DraftDocumentReferences.tsx`) already exists and works for the happy path.
  This slice fixes its honesty and robustness gaps in place; it builds no
  parallel surface.
- The canonical spec's non-goals state "No local AI analysis…", "No automatic
  save of response content", and "the editor must preserve the current
  string/Markdown contract". Nothing here changes those.
- REQ-6A.204 forbids the desktop from recreating the parent's "keyword rules,
  AI prompt, document taxonomy or merge logic". The current
  `DraftDocumentReferences.tsx` ships a `REFERENCE_TERMS` keyword table — a
  direct contradiction this slice must remove (G11).

## Objective

- **Why:** The full-screen editor is the flagship authoring surface, but it
  silently drops Generate failures, hides generation outcomes, and can lock
  itself in a stuck "Generating…" state. Its error/status rules also drift from
  the inline row, and two of its reference-pane behaviours diverge from the
  canonical workflow spec.
- **Goal:** Make the full-screen editor as honest and recoverable as the inline
  row already is, remove the duplicated authoring surface, and bring the
  reference pane into conformance with REQ-6A and UX-1.
- **Primary outcome:** A user never presses Generate in the full-screen editor
  and gets silence; a failed, templated or placeholder-bearing document is
  visible as such; a stuck generation can always be recovered; and the desktop
  stops shipping its own document-keyword rules.

## Non-goals

- No new parent API, schema, field, migration, prompt, embedding, vector,
  extraction or generation path.
- No local persistence of draft content (that is Slice 10, and it amends
  SEC-1 — out of scope here).
- No custom prompt, batch generate, or draft-list landing view (Slice 9).
- No version history / regenerate rollback (Slice 10).
- No WYSIWYG or second document format.

## Functional requirements

### RH-1 — Generate failures surface in the full-screen editor (G1)

Pressing Generate/Regenerate in the full-screen editor must catch a rejected
`generateResponseDocument` call and render an inline `role="alert"` message in
the editor, using component-owned copy — never a server string:

- `409` with code `PRECONDITIONS_NOT_MET` →
  *"Complete the required additional information before generating."*
- `402` (`payment-required`) → *"Generating this document needs a paid plan."*
- every other failure → `describeApiError(error, "this document").message`.

The message must appear next to the editor controls and clear when a new action
starts. This mirrors the inline row's existing `describeGenerateError`
(`ResponseBlueprintDocRow.tsx:216`); the editor must not remain the one silent
surface.

### RH-2 — Generation outcome is visible in the editor (G2)

The editor must surface the per-document generation outcome it currently
ignores, using `ResponseDocStatus` fields already read by the blueprint GET:

- `state === "failed"` → the editor shows a "Generation failed" notice with a
  **Retry** affordance (the primary button relabels to "Retry"), never a raw
  `error` string.
- `isFallback === true` → the editor shows a "Saved · template" indicator so the
  user knows the content is a template, not AI-authored.
- `unresolvedPlaceholders` non-empty → the editor shows a warning (component
  copy, e.g. "N unresolved placeholders remain in this document — verify them
  before submitting."), not the raw placeholder list.

The left navigator already shows "Saved / Generating / Failed / Not started"
(`ResponseDocumentNavigator.tsx:27`); it must also distinguish the template
state for consistency.

### RH-3 — Stuck or stale generation is recoverable (G3)

A generation that outlives the bounded refresh window (4 s × 15 ≈ 60 s) or whose
refresh tick fails must never leave the editor permanently locked. After the
bounded refresh ends while a key is still `generating`, the editor must offer a
**Check again** action that re-reads the blueprint directly (no loading flash)
and updates the status overlay. A `failed` outcome must be reachable and offer
**Retry**. `readOnly` is removed as soon as the status is no longer `generating`.

### RH-4 — One owner of authoring error/status rules (G5)

Generate/Regenerate/Save error description and the status→label derivation must
live in one shared module, imported by both the full-screen editor and the
inline row, so the two surfaces cannot drift again:

- extract `describeGenerateError` from `ResponseBlueprintDocRow.tsx` into a
  shared helper (e.g. `src/features/applications/workflow/response-doc-errors.ts`
  or alongside `describe-error.ts` in `services/api`);
- extract the status-chip/label logic (`docStatusChip`,
  `ResponseDocumentNavigator` label derivation) into one helper.

The inline row's authoring path is then aligned to the canonical "one response
editor" rule (REQ-6): the row's own embedded editor/`startEdit`/`saveNow` path is
removed once every mounting site routes Edit to the full-screen editor, so there
is exactly one editor. (Removal is coordinated with the workflow spec's
TASK-4.2 old-composition removal; see design.)

### RH-5 — No raw server strings in authoring UI (G6)

`ResponseBlueprintDocRow.tsx:104-106` currently renders `status.error` verbatim.
This slice replaces it with component-owned copy via the shared helper from
RH-4. The full-screen editor continues to never show `ApiError.message`,
`blockedReason`, or the parent's stored `error` string (per `describe-error.ts`
docblock and REQ-8).

### RH-6 — Reference pane available at every width (G10)

`DraftDocumentReferences.tsx:66` hides the reference column below `lg` with no
fallback, while the canonical UX-1 requires the reference pane to become a
drawer at narrow widths. The reference pane (brief, required-by, official-file
downloads) must remain reachable below `lg` — as a labelled drawer/toggle rather
than disappearing — with the editing canvas keeping the remaining width/height.

### RH-7 — Remove the desktop keyword table; honest "no related files" (G11)

`DraftDocumentReferences.tsx:14-41` defines a `REFERENCE_TERMS` keyword table
and matches tender files by naive substring — a desktop re-creation of the
parent's document taxonomy, which REQ-6A.204 forbids. This slice:

- removes `REFERENCE_TERMS` and the substring matcher;
- derives related files from server-provided fields only (document `fileName` /
  `documentCategory` already on the tender payload), without desktop taxonomy;
- when no server-side association exists, shows an honest "No related tender
  files identified" state instead of silently listing every document under a
  "likely related" heading.

## Non-functional requirements

- Component-owned copy everywhere; server strings are never rendered.
- Steady state remains timer-free; only the existing bounded generation refresh
  polls, and only after an explicit Generate press (RH-3's "Check again" is a
  single direct read, not a timer).
- No mutation auto-retries; existing `retry: "never"` policies are unchanged.
- Accessibility: every new notice/alert uses `role="alert"` or `role="status"`;
  the reference drawer is labelled and keyboard-reachable.
- No parent changes; `ApplicationsEndpoint` and its schemas are unchanged.

## Integration requirements

- Extend the existing `DraftStage`, `ResponseDocumentEditor`,
  `ResponseDocumentNavigator` and `DraftDocumentReferences`; do not create new
  editor surfaces.
- Reuse `useResponseBlueprintWorkspace` as the single blueprint/status owner.
- Shared helpers introduced in RH-4 are imported by both editors; no duplicated
  error logic.

## Success criteria

- A forced 402 and 409 on Generate in the **full-screen** editor each render the
  fixed copy inline; the editor is not silent.
- A `failed` document shows the failure notice and a Retry action; a template
  document shows "Saved · template"; unresolved placeholders show the warning —
  all without raw server strings.
- After a generation that outlives the refresh window, the editor offers "Check
  again" and recovers; it never stays read-only forever.
- The reference pane is reachable below `lg` via a drawer; the desktop keyword
  table is gone and a no-match case shows "No related tender files identified".
- `vitest`, `tsc --noEmit`, `eslint`, `prettier --check` pass; new screen tests
  cover every RH item.
