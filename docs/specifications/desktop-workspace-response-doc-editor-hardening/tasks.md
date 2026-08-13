# Desktop Workspace — Response Document Editor Hardening — Tasks (Slice 8)

Status legend: `[ ]` open · `[x]` done. Implementation order is top-down. Tasks
reference requirements RH-1..RH-7 and the design's shared helper.

## T1 — Shared authoring status/error helper

- **Pre-check**: `ResponseBlueprintDocRow.tsx` and `ResponseDocumentEditor.tsx`
  read; canonical REQ-6A (no desktop keyword rules) noted.
- **Files**: new `src/features/applications/workflow/response-doc-status.ts`,
  `src/features/applications/workspace/ResponseBlueprintDocRow.tsx`.
- **Work**:
  1. Move `describeGenerateError` and `docStatusChip` logic into the shared
     helper; export `describeResponseDocStatus` with an explicit
     `template`/`failed`/`saved`/`generating` tone (RH-4).
  2. Row imports the helpers; delete its local copies (RH-4).
  3. Row stops rendering `status.error` verbatim; failed state uses
     component-owned copy from the helper (RH-5).
- **Verification**: `pnpm exec vitest run src/tests/module-screens.test.tsx` —
  row chips unchanged except the template tone; no raw `status.error` rendered.

## T2 — Full-screen editor generate failure + outcome

- **Pre-check**: T1 merged; `DraftStage`/`ResponseDocumentEditor` structure known.
- **Files**: `src/features/applications/workflow/DraftStage.tsx`,
  `src/features/applications/workflow/ResponseDocumentEditor.tsx`.
- **Work**:
  1. `DraftStage` passes the selected key's full merged status to the editor
     (new `status` prop) instead of only `generating` (RH-2).
  2. Editor catches a rejected `onGenerate` and renders `describeGenerateError`
     copy with `role="alert"`, cleared on the next action (RH-1).
  3. Editor renders `failed`/`isFallback`/`unresolvedPlaceholders` notices and
     relabels the primary button to "Retry" on `failed` (RH-2).
  4. `readOnly` driven only by `status.state === "generating"` (RH-3).
- **Verification**: `pnpm exec vitest run src/tests/draft-stage.test.tsx` — 402/409
  copy, failed/template/placeholder notices, Retry label, no silent Generate.

## T3 — Stuck-generation recovery

- **Pre-check**: T2 merged; `use-response-blueprint-workspace.ts` poll read.
- **Files**: `src/features/applications/workflow/use-response-blueprint-workspace.ts`,
  `src/features/applications/workflow/ResponseDocumentEditor.tsx`.
- **Work**:
  1. Add `recheck()` (one direct blueprint read, merged into the overlay, reusing
     the poll's merge) and a per-key `staleGenerating` flag set when the bounded
     window ends while the key is still `generating` (RH-3).
  2. Editor shows "Check again" when `generating && staleGenerating`; press calls
     `recheck()`. No new timer.
- **Verification**: `pnpm exec vitest run src/tests/draft-stage.test.tsx` — a
  generation that outlives the window surfaces "Check again"; pressing it recovers
  to `ready` and unlocks the editor.

## T4 — Reference pane: remove keyword table + responsive drawer

- **Pre-check**: T1 merged; canonical REQ-6A/UX-1 read.
- **Files**: `src/features/applications/workflow/DraftDocumentReferences.tsx`.
- **Work**:
  1. Delete `REFERENCE_TERMS` and the substring matcher (RH-7).
  2. List tender documents from server fields only; empty state reads "No related
     tender files identified." (RH-7).
  3. Replace `max-lg:hidden` with a labelled drawer/toggle reachable below `lg`
     (RH-6).
- **Verification**: `pnpm exec vitest run` reference-pane cases — no keyword table;
  honest empty state; drawer reachable.

## T5 — Full gates + parity

- **Pre-check**: T1–T4 merged.
- **Files**: tests as above; no endpoint/capability/parity changes expected
  (no new routes) — verify parity still passes unchanged.
- **Work**: full suite + static gates.
- **Verification**: `pnpm exec vitest run`, `pnpm exec tsc --noEmit`,
  `pnpm exec eslint .`, `pnpm exec prettier --check .` — zero errors.

## T6 — Live verification (human)

- **Pre-check**: T5 merged; app running via `pnpm tauri dev`.
- **Work**: user confirms in the full-screen editor: a forced 402/409 shows the
  fixed copy; a failed generation shows the notice + Retry; template content shows
  "Saved · template"; a long generation is recoverable via "Check again"; the
  reference pane opens as a drawer below `lg`.
- **Verification**: user sign-off recorded in `INTEGRATION_EVAL.md`.

## Status (2026-08-13)

- T1: DONE — shared `response-doc-status.ts` helper; row + navigator import it;
  raw `status.error` rendering removed.
- T2: DONE — full-screen editor surfaces 402/409 via shared `describeGenerateError`;
  failed/template/unresolved-placeholder notices; Retry label.
- T3: DONE — `recheck()` + `staleGenerating`; "Check again" action; `readOnly` only
  while `state === "generating"`.
- T4: DONE — keyword table removed; server-provided files only; honest empty state;
  references drawer below `lg`.
- T5: DONE — full suite 805/805, `tsc --noEmit`, `eslint`, `prettier --check` clean.
- T6: OPEN — human verification pending (requires `pnpm tauri dev`).

