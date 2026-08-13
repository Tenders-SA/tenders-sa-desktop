# Desktop Workspace — Response Document Editor Hardening — Design (Slice 8)

Extends the shipped full-screen editor. No new endpoint methods, no schema, no
parent change. Requirements RH-1..RH-7.

## Shared helper — one authoring error/status owner (RH-4, RH-5)

New file `src/features/applications/workflow/response-doc-status.ts` (single
owner; imported by both surfaces):

```ts
export function describeGenerateError(error: unknown): string {
  if (error instanceof ApiError && error.code === "PRECONDITIONS_NOT_MET") {
    return "Complete the required additional information before generating.";
  }
  return describeApiError(error, "this document").message;
}

export type ResponseDocLabel =
  | { label: string; className: string }
  | { label: string; className: string; tone: "template" | "failed" | "saved" | "generating" };

export function describeResponseDocStatus(
  status: { state?: string; error?: string; isFallback?: boolean },
  hasContent: boolean,
): ResponseDocLabel | undefined { /* single source for Saved/Generating/Failed/Not started + template */ }
```

- `ResponseBlueprintDocRow.tsx` deletes its local `describeGenerateError` and
  `docStatusChip` and imports these (RH-4, RH-5).
- `ResponseDocumentEditor.tsx` / `DraftStage.tsx` import the same helpers.
- The `error`/`blockedReason`/stored `error` strings are never rendered (RH-5).

## Full-screen editor — generate failure + outcome (RH-1, RH-2, RH-3)

`DraftStage.tsx` already computes merged `responseDocs`, `statuses` and passes a
`generating` boolean to the editor. Changes:

1. Pass the full merged status for the selected key into
   `ResponseDocumentEditor` as a new prop (e.g. `status: { state?, error?,
   isFallback?, unresolvedPlaceholders? }`) instead of only `generating`.
2. In `ResponseDocumentEditor`, replace `void onGenerate()` with a handler that
   catches the rejection and sets a local error string via `describeGenerateError`
   (RH-1); render it with `role="alert"` beside the controls; clear on new action.
3. Derive the primary button label from status: `failed` → "Retry", else
   `content ? "Regenerate" : "Generate"` (RH-2).
4. Render, under the toolbar, component-owned notices for:
   - `failed` → "Generation failed — try again." (RH-2);
   - `isFallback` → "Saved · template" (RH-2);
   - `unresolvedPlaceholders?.length` → "N unresolved placeholders remain in
     this document — verify them before submitting." (RH-2).
5. `readOnly` is driven by `status.state === "generating"` only; a `failed`,
   `ready` or absent state is always editable (RH-3).

## Stuck-generation recovery (RH-3)

`use-response-blueprint-workspace.ts` is the single generation-refresh owner:

- Expose a `recheck()` method that performs one direct
  `endpoint.getResponseBlueprint(applicationId)` and merges
  `responseDocs`/`responseDocStatus` into the overlay — the same merge the poll
  tick already does, reused so it is not a second refresh path.
- Track, per key, when the bounded window ended while that key was still
  `generating` (the poll already clears `pendingKeys` on `remaining <= 0`). When
  that happens, surface a `staleGenerating` flag for the key.
- `ResponseDocumentEditor` shows a "Check again" button when
  `generating && staleGenerating`; pressing it calls `recheck()`.

No new timers: "Check again" is one read per press (RH-3, PERF-1).

## Reference pane (RH-6, RH-7)

`DraftDocumentReferences.tsx`:

- Delete the `REFERENCE_TERMS` table and `relatedDocuments` substring matcher
  (RH-7, conforms REQ-6A.204).
- Related files = tender documents, listed directly (server-provided
  `fileName`/`documentCategory`); no desktop taxonomy or keyword matching.
- When no tender documents exist for the selected doc, render "No related tender
  files identified." instead of "Official tender files".
- Replace the `max-lg:hidden` hiding with a labelled drawer/toggle so the pane is
  reachable below `lg` (RH-6, UX-1); the editing canvas keeps remaining space.

## Orchestrator wiring

`ApplicationWorkspace.tsx` — no structural change; `DraftStage` already receives
`tenderDocuments` and the documents endpoint. RH-4's inline-editor removal is
coordinated with the workflow spec's TASK-4.2: the old all-panels composition
mounts `ResponseBlueprintPanel` without `onEditDocument`; once that composition
is removed (its own task), no mounting site uses the inline editor path, and
`ResponseBlueprintDocRow`'s embedded editor can be deleted. Until then the row
keeps navigating to the full-screen editor when `onEditDocument` is provided.

## Tests

- `src/tests/draft-stage.test.tsx` — full-screen editor: Generate rejects with
  402/409 → fixed copy visible (`role="alert"`); `failed` status → "Generation
  failed" + Retry; `isFallback` → "Saved · template"; `unresolvedPlaceholders` →
  warning; stale `generating` after window → "Check again" recovers to `ready`.
- `src/tests/module-screens.test.tsx` — row no longer renders raw `status.error`;
  template chip via shared helper; shared helper parity between row and editor.
- `src/tests/` reference-pane cases — no keyword table: a no-match case shows
  "No related tender files identified"; related files come from server fields.
- New/updated unit tests for `describeGenerateError` and
  `describeResponseDocStatus` if a `response-doc-status.test.ts` is warranted.

## Files touched

| File | Change |
|---|---|
| `src/features/applications/workflow/response-doc-status.ts` | new — shared error/label helpers (RH-4) |
| `src/features/applications/workflow/ResponseDocumentEditor.tsx` | generate error + outcome notices + Retry/Check-again (RH-1/2/3) |
| `src/features/applications/workflow/DraftStage.tsx` | pass full status to editor (RH-2/3) |
| `src/features/applications/workflow/use-response-blueprint-workspace.ts` | `recheck()` + `staleGenerating` (RH-3) |
| `src/features/applications/workflow/ResponseDocumentNavigator.tsx` | template label via shared helper (RH-2) |
| `src/features/applications/workflow/DraftDocumentReferences.tsx` | remove keyword table; drawer; honest empty state (RH-6/7) |
| `src/features/applications/workspace/ResponseBlueprintDocRow.tsx` | use shared helpers; drop raw `status.error` (RH-4/5) |
| `src/tests/draft-stage.test.tsx`, `src/tests/module-screens.test.tsx` (+ any helper test) | new coverage |
