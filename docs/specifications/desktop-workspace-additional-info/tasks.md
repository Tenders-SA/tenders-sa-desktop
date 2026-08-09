# Desktop Workspace — Additional-Info Q&A — Tasks (Slice 2)

Status legend: `[ ]` open · `[x]` done. Implementation order is top-down. Tasks
reference requirements R-A-1..R-A-6 and the live-verified contracts in `design.md`.

## T1 — Endpoint methods on `ApplicationsEndpoint`

- **Pre-check**: live contracts in `design.md` read.
- **Files**: `src/services/api/endpoints/applications.ts`, `src/tests/module-endpoints.test.ts`.
- **Work**:
  1. Schemas `additionalInfoFieldSchema`, `additionalInfoSchema`, `additionalInfoSaveSchema`
     — permissive (R-A-5), shapes per design.md.
  2. Methods `getAdditionalInfo` (GET) and `saveAdditionalInfo` (PUT, `retry: "never"`).
- **Verification**: `pnpm exec vitest run src/tests/module-endpoints.test.ts` — new
  contract tests pass (live-verified 6-field fixture; `values` default `{}`; PUT body
  + method; never-retry; 400 `Invalid values` → `kind: "validation"`).

## T2 — `AdditionalInfoPanel`

- **Pre-check**: T1 merged; panel patterns from Slice 1 known.
- **Files**: new `src/features/applications/workspace/AdditionalInfoPanel.tsx`.
- **Work**: own `useAsync` + `AsyncSection` (R-A-4); per-type field rendering with
  unknown types as text inputs (R-A-5); progress row; explicit "Save answers"
  button (R-A-2); saved/not-saved/error badges (R-A-3); no auto-save timer.
- **Verification**: `pnpm exec vitest run src/tests/module-screens.test.tsx` — panel
  render/empty/error tests.

## T3 — Orchestrator wiring + fixtures + parity coverage

- **Pre-check**: T2 merged.
- **Files**: `src/features/applications/ApplicationWorkspace.tsx`,
  `src/tests/fixtures/api-clients.ts`, `src/tests/endpoint-parity.test.ts`,
  `src/tests/capability-scope.test.ts`.
- **Work**: mount the panel in the cockpit grid; fixture gains the two methods
  (`idle()`); parity + capability tests pin the `additional-info` route literals.
- **Verification**: `pnpm exec vitest run` (full suite), `pnpm exec tsc --noEmit`,
  `pnpm exec eslint .`, `pnpm exec prettier --check .`.

## T4 — Live verification (human)

- **Pre-check**: T3 merged; app running via `pnpm tauri dev`. — done
- **Work**: user opens a DRAFT application workspace and confirms: the Q&A renders
  the tender's fields (live: 6 for the probe app), typing + "Save answers" persists
  (`GET` afterwards shows the values), a reload shows the saved answers, and a forced
  failure keeps the answers with a "Not saved" badge. — done
- **Verification**: user sign-off recorded in `INTEGRATION_EVAL.md`. — done

## Status (2026-08-08)

- T1: DONE — schemas + methods merged; contract tests green (56/56 in module-endpoints).
- T2: DONE — panel merged; screen tests green.
- T3: DONE — wiring + fixtures + parity pinned; full suite 569/569, tsc/lint/prettier clean.
- T4: DONE (2026-08-09) — user confirmed the entire live-verification task is complete.
