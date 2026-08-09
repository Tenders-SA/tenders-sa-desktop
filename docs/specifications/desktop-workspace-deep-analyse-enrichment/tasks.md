# Desktop Workspace — Deep-Analyse Enrichment — Tasks (Slice 5)

Status legend: `[ ]` open · `[x]` done. Implementation order is top-down. Tasks
reference requirements R-E-1..R-E-5 and the live-verified contracts in `design.md`.

## T1 — Endpoint method

- **Pre-check**: live contracts in `design.md` read.
- **Files**: `src/services/api/endpoints/applications.ts`, `src/tests/module-endpoints.test.ts`.
- **Work**:
  1. Permissive `enrichBlueprintResponseSchema` (reuses `blueprintSchema`;
     `enriched`/`reason` optional; `analysisStatus` unknown, never typed).
  2. Method `enrichBlueprint` (POST, no body, `retry: "never"` — R-E-5).
- **Verification**: `pnpm exec vitest run src/tests/module-endpoints.test.ts` —
  new contract tests pass (`enriched: true` with blueprint; `enriched: false`
  with each reason; null blueprint tolerated; 402 → `payment-required`;
  403/404 mapping; single call on transient failure).

## T2 — Deep-analyse action on the blueprint panel

- **Pre-check**: T1 merged; Slice 3/4 panel structure known.
- **Files**: `src/features/applications/workspace/ResponseBlueprintPanel.tsx`,
  `src/tests/module-screens.test.tsx`.
- **Work**:
  1. "Deep-analyse" button in the panel header `aside` (only when a blueprint
     renders); working state "Analysing…" + disabled while in flight (R-E-1).
  2. Success (`enriched: true`) → `state.reload()` (R-E-2).
  3. 402 → "Deep-analyse needs the Professional plan." — keyed off the action,
     never the server string (R-E-3).
  4. `enriched: false` → reason copy per R-E-4 (`analysis_triggered`,
     `no_analysis`, `ai_unavailable`; unknown → `describeApiError`); standard
     plan stays rendered; all `role="alert"`.
  5. Other errors → `describeApiError(error, "the deep-analyse")`.
- **Verification**: `pnpm exec vitest run src/tests/module-screens.test.tsx` —
  button/working/success-reload/402/reasons/500 tests.

## T3 — Fixtures + parity + full gates

- **Pre-check**: T2 merged.
- **Files**: `src/tests/fixtures/api-clients.ts`, `src/tests/endpoint-parity.test.ts`.
- **Work**: fixture stub gains `enrichBlueprint` (`idle()`); parity test pins
  the `enrich-blueprint` literal.
- **Verification**: `pnpm exec vitest run` (full suite), `pnpm exec tsc --noEmit`,
  `pnpm exec eslint .`, `pnpm exec prettier --check .`.

## T4 — Live verification (human)

- **Pre-check**: T3 merged; app running via `pnpm tauri dev`.
- **Work**: user opens a live DRAFT workspace with a completed analysis and
  confirms: Deep-analyse → "Analysing…" → the plan flips to "AI-tailored" with
  tender-specific sections merged; a deliberate 402 path (non-Professional
  account) shows the Professional-plan copy; a slow/failing pass shows the
  `ai_unavailable` copy with the standard plan intact.
- **Verification**: user sign-off; record in `INTEGRATION_EVAL.md`.

## Status (2026-08-09)

- T1: DONE.
- T2: DONE.
- T3: DONE.
- T4: OPEN — awaiting user live verification (`pnpm tauri dev`).
