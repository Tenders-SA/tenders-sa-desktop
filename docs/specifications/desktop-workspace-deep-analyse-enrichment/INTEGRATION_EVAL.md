# Desktop Workspace — Deep-Analyse Enrichment — INTEGRATION_EVAL (Slice 5)

- **Status**: pending
- **Spec**: `desktop-workspace-deep-analyse-enrichment/` (requirements
  R-E-1..R-E-5, design, tasks)

## Gates

| Gate | Task | Evidence | Date |
|---|---|---|---|
| Endpoint contract tests | T1 | `vitest module-endpoints` — new method against live-verified shapes | — |
| Panel tests | T2 | `vitest module-screens` — button/working/success-reload/402/reasons/500 | — |
| Full suite + static gates | T3 | `vitest` (all), `tsc --noEmit`, `eslint .`, `prettier --check .` — 0 errors | — |
| Capability/parity | T3 | `vitest capability-scope endpoint-parity` | — |
| Live human verification | T4 | user live-verifies Deep-analyse → AI-tailored flip, 402 copy, failing-pass copy | — |

## Live contract evidence (2026-08-08)

Route contract read from parent code:

- `src/app/api/v1/applications/[applicationId]/assist/enrich-blueprint/route.ts`
  — POST, no body → `{blueprint, enriched: bool, reason?: ai_unavailable |
  no_analysis | analysis_triggered, analysisStatus?}`; 402 Professional/
  Enterprise tier (no machine code, `upgradeUrl: '/pricing'`); synchronous AI
  with deterministic fallback (never blocks); enrichment cached in
  `applicationExtraInfo.__blueprintEnrichment`.
- `src/app/api/v1/applications/[applicationId]/assist/response-blueprint/route.ts`
  (lines 50-57) — the GET re-merges the cache via
  `mergeCachedBlueprintEnrichment` and reports
  `enriched: !!extra?.__blueprintEnrichment?.data`, so a reload after a
  successful POST flips provenance with no new read contract.
- `src/lib/services/workspace/blueprint-builder.ts` (line 36) —
  `mergeCachedBlueprintEnrichment` reads `__blueprintEnrichment.data`.
- Out of contract confirmed: `assist/refine` (legacy-column writes, no
  subscription gate), `assist/briefing-pack` (binary pdf/docx attachment),
  `assist/workspace-generate` (delegates to the classic synchronous flow).

## Deviations

- *(none)*
