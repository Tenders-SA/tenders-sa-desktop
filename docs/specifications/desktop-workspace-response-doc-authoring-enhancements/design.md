# Desktop Workspace — Response Document Authoring Enhancements — Design (Slice 9)

Extends the Slice 8 editor. No new endpoint methods (the `prompt` argument
already exists). Requirements RA-1..RA-3.

## Draft list landing (RA-3)

`DraftStage.tsx` currently computes `selected = selectedDocumentKey ? … : usableDocuments[0]`.
Change the no-key path:

- Extract the list into `src/features/applications/workflow/ResponseDocumentList.tsx`
  (renders `usableDocuments` in server order; each row shows title, `kind`,
  mandatory marker, and the `describeResponseDocStatus` label; `onSelect` opens
  the editor).
- When `documentKey` is absent and no key is selected, `DraftStage` renders the
  list in the existing modal chrome (or as the Draft stage body) instead of the
  first document. `useResponseBlueprintWorkspace` remains the single data owner.
- Selecting a row sets `selectedDocumentKey`; the deep-link route
  `/applications/:applicationId/draft/:documentKey` is unchanged and still opens
  the editor directly (the `selectedDocumentKey` init from `documentKey` already
  covers this).
- The existing "Document no longer in this response plan" recovery state
  (stale key) already offers "return to the document list"; it now points at
  this real list view.

## Batch generate (RA-1)

`use-response-blueprint-workspace.ts` gains `generateMany(keys: string[])`:

- for each key with no saved content and status not `generating`, call
  `endpoint.generateResponseDocument` sequentially, collecting per-key
  success/failure;
- set the `generating` overlay and `pendingKeys` for every accepted key (the
  existing poll then tracks them all);
- return a per-key result map so the UI can aggregate failures via
  `describeGenerateError` (402/409/other) without re-deriving error copy;
- never auto-run; only called from the explicit "Generate all" press.

`ResponseDocumentList.tsx` renders "Generate all N remaining" (disabled while a
batch is in flight or when no remaining docs). Consequences are labelled; a
failed key keeps its own inline failure message.

## Optional instructions (RA-2)

`ResponseDocumentEditor.tsx`:

- add a local `instructions` state and a small labelled input ("Optional
  instructions for the AI", placeholder e.g. "Keep it under two pages…");
- `onGenerate` gains an optional `prompt` argument; `DraftStage` passes
  `workspace.generate(key, prompt)`;
- `use-response-blueprint-workspace.ts` `generate(key, prompt?)` forwards
  `prompt` to `generateResponseDocument` (already supported, `applications.ts:1061`);
- clear `instructions` after the 202 is acknowledged; never display a server
  string; the field is not part of `dirty` tracking (instructions are not saved
  content) and is not sent to any log.

## Files touched

| File | Change |
|---|---|
| `src/features/applications/workflow/ResponseDocumentList.tsx` | new — draft index + Generate-all (RA-1, RA-3) |
| `src/features/applications/workflow/DraftStage.tsx` | no-key path renders list; pass `prompt` through (RA-2, RA-3) |
| `src/features/applications/workflow/ResponseDocumentEditor.tsx` | optional instructions field → `prompt` (RA-2) |
| `src/features/applications/workflow/use-response-blueprint-workspace.ts` | `generateMany` + `generate(key, prompt?)` (RA-1, RA-2) |
| `src/tests/draft-stage.test.tsx`, `src/tests/module-screens.test.tsx` | new coverage |

## Tests

- `src/tests/draft-stage.test.tsx` — no-key Draft renders the list, not the first
  doc; select opens editor; deep-link still opens directly; Generate-all issues
  one request per eligible key and reflects statuses; a forced 402/409 aggregates
  via shared copy; optional instructions are passed as `prompt` and cleared.
- `src/tests/module-screens.test.tsx` — status labels come from the shared helper
  on the list; no raw strings.
