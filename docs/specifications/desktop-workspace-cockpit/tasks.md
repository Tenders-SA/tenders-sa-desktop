# Desktop Workspace Cockpit — Tasks (Slice 1)

Status legend: `[ ]` open · `[x]` done. Implementation order is top-down. Each task's
pre-check and verification are stated. Tasks reference requirements R-W-1..R-W-7 and
the live-verified contracts in `design.md`.

## T1 — Endpoint methods on `ApplicationsEndpoint`

- **Pre-check**: live contracts in `design.md` read. — done
- **Files**: `src/services/api/endpoints/applications.ts`, `src/tests/module-endpoints.test.ts`. — done
- **Work**:
  1. Schemas: `cockpitSchema`, `complianceGapsSchema`, `researchSchema`,
     `workspaceSummarySchema`, `workspaceUpdateResponseSchema` — permissive (R-W-6),
     shapes per design.md. — done
  2. Methods `getCockpit`, `getComplianceGaps`, `getResearch`, `getWorkspaceStage`
     (403 → `undefined` stage, not an error), `updateWorkspace`. — done
- **Verification**: `pnpm exec vitest run src/tests/module-endpoints.test.ts` — new
  contract tests pass (live-verified fixtures; null fields; 403 fallback; 400
  transition surfaces `allowed`). — done (51/51)

## T2 — Panel components

- **Pre-check**: T1 merged; `AsyncSection`/`useAsync` patterns known from Command Centre. — done
- **Files**: new `src/features/applications/workspace/*` (StageBar, UrgencyBanner,
  AnalysisStatusPanel, ComplianceGapsPanel, ResearchPanel, ValueEstimatePanel,
  ChecklistPanel, EventsPanel). — done
- **Work**: each panel = own `useAsync` + `AsyncSection` (R-W-5); StageBar renders the
  8 stages with current/move/clear/status/archive controls (R-W-4, R-W-7); severity
  colour mapping for gaps (R-W-2); ZAR formatting for value estimate. — done
- **Verification**: `pnpm exec vitest run src/tests/module-screens.test.tsx` — panel
  render/error/empty tests. — done (39/39, 5 new cockpit tests)

## T3 — Workspace orchestrator wiring

- **Pre-check**: T2 merged. — done
- **Files**: `src/features/applications/ApplicationWorkspace.tsx`,
  `src/tests/fixtures/api-clients.ts`. — done
- **Work**: keep the existing header/notes/documents; mount the new panels; one
  `getCockpit` call shared by its panels; fixture gains the five new methods (`idle()`). — done
- **Verification**: `pnpm exec vitest run` (full suite), `pnpm exec tsc --noEmit`,
  `pnpm exec eslint .`, `pnpm exec prettier --check .`. — done (558/559, known
  app-boot flake passes solo; tsc/eslint/prettier clean)

## T4 — Capability/parity tests

- **Pre-check**: T3 merged. — done
- **Files**: `src/tests/capability-scope.test.ts`, `src/tests/endpoint-parity.test.ts`
  (new routes under `/api/v1/` are already in scope; add explicit coverage). — done
- **Verification**: `pnpm exec vitest run src/tests/capability-scope.test.ts src/tests/endpoint-parity.test.ts`. — done (26/26)

## T5 — Live verification (human)

- **Pre-check**: T4 merged; app running via `pnpm tauri dev`.
- **Work**: user opens a DRAFT application workspace and confirms: stage bar shows
  `add_information` (live), panels render live data, moving stage/status and archiving
  work, and a forced failure degrades a single panel.
- **Verification**: user sign-off; record in `INTEGRATION_EVAL.md`.
