# Desktop Workspace — Response Blueprint — Tasks (Slice 3)

Status legend: `[ ]` open · `[x]` done. Implementation order is top-down. Tasks
reference requirements R-B-1..R-B-6 and the live-verified contracts in `design.md`.

## T1 — Endpoint method on `ApplicationsEndpoint`

- **Pre-check**: live contracts in `design.md` read.
- **Files**: `src/services/api/endpoints/applications.ts`, `src/tests/module-endpoints.test.ts`.
- **Work**:
  1. Permissive schemas `responseDocsSchema`, `responseDocStatusSchema`,
     `blueprintSchema`, `blueprintPayloadSchema` (R-B-5), shapes per design.md.
  2. Method `getResponseBlueprint` (GET, default retry policy — read-only).
- **Verification**: `pnpm exec vitest run src/tests/module-endpoints.test.ts` — new
  contract tests pass (live route shape incl. 12 required docs; `blueprint: null`
  and absent sections tolerated; `responseDocs`/status default `{}`; unknown enum
  values pass through; transient GET retry; 401/400/404 mapping).

## T2 — `ResponseBlueprintPanel`

- **Pre-check**: T1 merged; panel patterns from Slice 2 known.
- **Files**: new `src/features/applications/workspace/ResponseBlueprintPanel.tsx`.
- **Work**: own `useAsync` + `AsyncSection` (R-B-4); header (confidence +
  provenance); response documents with per-key status chips (R-B-3); required
  documents; steps; submission box; risks; null-blueprint empty state (R-B-5).
  Read-only: no mutation controls, no timers, no polling (R-B-2).
- **Verification**: `pnpm exec vitest run src/tests/module-screens.test.tsx` — panel
  render/status-chips/error/empty tests.

## T3 — Orchestrator wiring + fixtures + parity coverage

- **Pre-check**: T2 merged.
- **Files**: `src/features/applications/ApplicationWorkspace.tsx`,
  `src/tests/fixtures/api-clients.ts`, `src/tests/endpoint-parity.test.ts`.
- **Work**: mount the panel in the cockpit grid; fixture gains the method
  (`idle()`); parity test pins the `response-blueprint` route literal.
- **Verification**: `pnpm exec vitest run` (full suite), `pnpm exec tsc --noEmit`,
  `pnpm exec eslint .`, `pnpm exec prettier --check .`.

## T4 — Live verification (human)

- **Pre-check**: T3 merged; app running via `pnpm tauri dev`.
- **Work**: user opens a DRAFT application workspace and confirms: the blueprint
  renders the real sections (probe app: ≥12 required user documents, confidence,
  provenance), a doc with saved content shows "Saved", a `generating` status
  shows "Generating…", and a forced route failure degrades only this panel.
- **Verification**: user sign-off; record in `INTEGRATION_EVAL.md`.

## Status (2026-08-08)

- T1: DONE — schemas + method merged; contract tests green (62/62 in module-endpoints).
- T2: DONE — panel merged; screen tests green.
- T3: DONE — wiring + fixtures + parity pinned; full suite 581/581, tsc/lint/prettier clean.
- T4: DONE (2026-08-08) — user live verification: blueprint renders real
  sections on a DRAFT workspace; recorded in INTEGRATION_EVAL.md.

