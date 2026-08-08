# Desktop Workspace — Response Document Authoring — Tasks (Slice 4)

Status legend: `[ ]` open · `[x]` done. Implementation order is top-down. Tasks
reference requirements R-A-1..R-A-6 and the live-verified contracts in `design.md`.

## T1 — Error kind + endpoint methods

- **Pre-check**: live contracts in `design.md` read.
- **Files**: `src/services/api/errors.ts`, `src/services/api/describe-error.ts`,
  `src/services/api/endpoints/applications.ts`, `src/tests/module-endpoints.test.ts`.
- **Work**:
  1. `ApiErrorKind` += `"payment-required"`; `kindForStatus` maps 402 (R-A-4).
  2. `describeApiError` `payment-required` case with fixed upgrade copy,
     non-retryable; docblock line.
  3. Permissive schemas `generateResponseDocSchema`, `responseDocSaveSchema`;
     methods `generateResponseDocument` (POST, `{key, prompt?}`) and
     `saveResponseDocument` (PUT, `{key, content}`) — both `retry: "never"`
     (R-A-6).
- **Verification**: `pnpm exec vitest run src/tests/module-endpoints.test.ts` — new
  contract tests pass (202 shape; 400 missing key / `UNKNOWN_RESPONSE_DOC`;
  409 `PRECONDITIONS_NOT_MET` with code preserved; 402 kind `payment-required`;
  save `{ok,key}` shape; 403/404 mapping; no retry on transient 500 for either
  mutation).

## T2 — Row actions + inline editor

- **Pre-check**: T1 merged; Slice 3 panel structure known.
- **Files**: new `src/features/applications/workspace/ResponseBlueprintDocRow.tsx`,
  `src/features/applications/workspace/ResponseBlueprintPanel.tsx`,
  `src/tests/module-screens.test.tsx`.
- **Work**:
  1. Move `ResponseDocRow`/`docStatusChip` into the new file; panel passes an
     overlay + `endpoint` slice down (chips derive from overlay merged over
     payload — server wins on the next natural read).
  2. Generate (R-A-1): press → 202 → local `generating` overlay + bounded
     refresh (R-A-3: 4 s ticks, ≤15, stops when no key is generating, direct
     fetch — no loading flash, torn down on unmount).
  3. 402 → *"Generating this document needs a paid plan."*; 409
     (`PRECONDITIONS_NOT_MET`) → *"Complete the required additional information
     before generating."*; other errors → `describeApiError` copy; all
     `role="alert"`, row-local (R-A-4, R-A-5).
  4. Edit/Save (R-A-2): inline `textarea`, Save → PUT → overlay doc updated,
     editor closes, "Saved" chip; Cancel discards; save-failure alert.
     Regenerate secondary action on rows with content.
- **Verification**: `pnpm exec vitest run src/tests/module-screens.test.tsx` —
  generate/save/regenerate/402/409/poll-stop/no-flash tests.

## T3 — Fixtures + parity + full gates

- **Pre-check**: T2 merged.
- **Files**: `src/tests/fixtures/api-clients.ts`, `src/tests/endpoint-parity.test.ts`.
- **Work**: fixture stub gains both methods (`idle()`); parity test pins
  `generate-response-doc` and `response-doc` literals.
- **Verification**: `pnpm exec vitest run` (full suite), `pnpm exec tsc --noEmit`,
  `pnpm exec eslint .`, `pnpm exec prettier --check .`.

## T4 — Live verification (human)

- **Pre-check**: T3 merged; app running via `pnpm tauri dev`.
- **Work**: user opens a DRAFT workspace and confirms: Generate on an unsaved
  response document → "Generating…" → (within the bounded window) the doc
  appears "Saved" with real content; Edit → Save persists (reload serves the
  saved text back); no loading flash during the follow-up refresh; and a
  deliberate 402/409 path (e.g. a fresh free account, or unfilled required
  additional info) shows the upgrade / preconditions copy, not "Add your
  company profile".
- **Verification**: user sign-off; record in `INTEGRATION_EVAL.md`.

## Status (2026-08-08)

- T1: DONE — `payment-required` kind + describe copy merged; both methods merged;
  contract tests green (71/71 in module-endpoints).
- T2: DONE — row actions + inline editor merged; screen tests green (59/59 in
  module-screens).
- T3: DONE — fixtures + parity literals pinned; full suite 599/599,
  tsc/lint/prettier clean.
- T4: OPEN — human live verification, records in INTEGRATION_EVAL.md.
