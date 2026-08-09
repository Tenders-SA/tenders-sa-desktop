# Desktop Workspace — Deep-Analyse Enrichment — INTEGRATION_EVAL (Slice 5)

- **Status**: complete — T1–T4 verified
- **Spec**: `desktop-workspace-deep-analyse-enrichment/` (requirements
  R-E-1..R-E-5, design, tasks)

## Gates

| Gate | Task | Evidence | Date |
|---|---|---|---|
| Endpoint contract tests | T1 | `vitest module-endpoints` — 6 new contract tests (URL/verb/headers, `enriched: true`, `enriched: false` with each reason, null blueprint, 402/403/404/429/5xx/network mapping, single call on transient failure) | 2026-08-09 |
| Panel tests | T2 | `vitest module-screens` — 6 new tests (press → "Analysing…" → reload; isLoading; disabled single-flight; failure alert; retry re-press works; pass with untouched blueprint) | 2026-08-09 |
| Full suite + static gates | T3 | `vitest` (all) 611/611 · 35 files; `tsc --noEmit` 0 errors; `eslint .` 0 errors | 2026-08-09 |
| Capability/parity | T3 | `vitest endpoint-parity` — pins the `assist/enrich-blueprint` literal; fixtures stub gains `enrichBlueprint` | 2026-08-09 |
| Live human verification | T4 | User confirmed the Analysing single-flight state, AI-tailored result, Professional-plan copy, and failing-pass fallback all work. | 2026-08-09 |

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
