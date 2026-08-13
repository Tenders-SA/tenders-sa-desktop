# Desktop Workspace — Response Document Authoring Enhancements — Tasks (Slice 9)

Status legend: `[ ]` open · `[x]` done. Implementation order is top-down. Tasks
reference requirements RA-1..RA-3. **Dependency**: Slice 8 (shared helper) merged.

## T1 — Draft list landing view

- **Pre-check**: Slice 8 merged; `DraftStage.tsx` no-key path read.
- **Files**: new `src/features/applications/workflow/ResponseDocumentList.tsx`,
  `src/features/applications/workflow/DraftStage.tsx`.
- **Work**:
  1. Extract a `ResponseDocumentList` component rendering
     `blueprint.responseDocuments[]` in server order with title, `kind`,
     mandatory marker and the shared `describeResponseDocStatus` label (RA-3).
  2. `DraftStage` renders the list when no key is selected instead of opening
     the first document; selecting a row opens the editor. The deep-link route
     still opens directly (RA-3).
  3. "Document no longer in this response plan" recovery points at the list.
- **Verification**: `pnpm exec vitest run src/tests/draft-stage.test.tsx` — no-key
  renders the list; select opens editor; deep-link unchanged.

## T2 — Batch generate remaining

- **Pre-check**: T1 merged; `use-response-blueprint-workspace.ts` read.
- **Files**: `src/features/applications/workflow/use-response-blueprint-workspace.ts`,
  `src/features/applications/workflow/ResponseDocumentList.tsx`.
- **Work**:
  1. Add `generateMany(keys)` that issues `generateResponseDocument` per eligible
     key (no content, not generating), sets `generating` overlay + `pendingKeys`,
     and returns per-key results (RA-1).
  2. "Generate all N remaining" action on the list, disabled in flight / when none
     remain; per-key failures surface via `describeGenerateError` (RA-1).
- **Verification**: `pnpm exec vitest run src/tests/draft-stage.test.tsx` — one
  request per eligible key; 402/409 aggregated, not silent.

## T3 — Optional regeneration instructions

- **Pre-check**: T1 merged; `applications.ts` `prompt` arg confirmed.
- **Files**: `src/features/applications/workflow/ResponseDocumentEditor.tsx`,
  `src/features/applications/workflow/DraftStage.tsx`,
  `src/features/applications/workflow/use-response-blueprint-workspace.ts`.
- **Work**:
  1. `generate(key, prompt?)` forwards `prompt` to `generateResponseDocument` (RA-2).
  2. Editor gains a labelled optional instructions field; `onGenerate` passes it;
     field clears after the 202 is acknowledged; never logged/rendered back (RA-2).
- **Verification**: `pnpm exec vitest run src/tests/draft-stage.test.tsx` — prompt
  passed through; field cleared after press.

## T4 — Full gates + changelog

- **Pre-check**: T1–T3 merged.
- **Files**: tests; `CHANGELOG.md` (user-visible behaviour: draft list, Generate
  all, optional instructions).
- **Verification**: `pnpm exec vitest run`, `pnpm exec tsc --noEmit`,
  `pnpm exec eslint .`, `pnpm exec prettier --check .` — zero errors.

## T5 — Live verification (human)

- **Pre-check**: T4 merged; app running via `pnpm tauri dev`.
- **Work**: user confirms the draft list landing, Generate-all, and optional
  instructions in a live workspace.
- **Verification**: user sign-off recorded in `INTEGRATION_EVAL.md`.

## Status (2026-08-13)

- T1: DONE — `ResponseDocumentList` renders the draft index in server order; no-key
  Draft shows the list; select opens the editor; deep link unchanged.
- T2: DONE — `generateMany` issues one request per eligible key; "Generate all N
  remaining" surfaces per-key 402/409 via `describeGenerateError`.
- T3: DONE — optional instructions passed as `prompt`; cleared after the press.
- T4: DONE — full suite 808/808, `tsc --noEmit`, `eslint`, `prettier --check` clean.
- T5: OPEN — human verification pending (requires `pnpm tauri dev`).

