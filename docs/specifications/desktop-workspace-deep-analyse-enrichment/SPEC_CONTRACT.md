# Desktop Workspace — Deep-Analyse Enrichment — SPEC_CONTRACT (Slice 5)

- **Status**: `PENDING APPROVAL`
- **Date**: 2026-08-08
- **Scope**: Slice 5 — deep-analyse enrichment (R-E-1..R-E-5).
- **Approved by**: *(awaiting user)*
- **Approval date**: —

## Contract checklist (mirrors tasks.md)

| # | Item | Contract |
|---|---|---|
| C1 | Endpoint method on `ApplicationsEndpoint` | `enrichBlueprint` (POST, no body → `{blueprint, enriched, reason?, analysisStatus?}`), `retry: "never"` (R-E-5); permissive schema reusing `blueprintSchema` |
| C2 | Deep-analyse action | header button (only when a blueprint renders), "Analysing…" + disabled while in flight; single POST per press (R-E-1) |
| C3 | Adopt enriched plan | success → `state.reload()`; provenance flips to "AI-tailored" from the GET's single source of truth (R-E-2) |
| C4 | 402 copy | "Deep-analyse needs the Professional plan." — keyed off the action (the route carries no code), non-retryable, `role="alert"` (R-E-3) |
| C5 | Non-fatal reasons | `analysis_triggered` / `no_analysis` / `ai_unavailable` → fixed copy, standard plan stays rendered; unknown reason → `describeApiError` (R-E-4) |
| C6 | Wiring + coverage | panel already mounted; fixtures gain the method; parity pins the `enrich-blueprint` literal |
| C7 | Verification gates | `vitest` full suite, `tsc --noEmit`, `eslint .`, `prettier --check .` — zero errors |
| C8 | Human verification | user live-verifies Deep-analyse → AI-tailored flip, the 402 copy, and a failing-pass copy; recorded in `INTEGRATION_EVAL.md` |

## Explicitly out of contract

Refine (`POST assist/refine` — synchronous AI, legacy-column writes), briefing
pack/export (`?format=pdf|docx` — binary download handling), submission
recording, board screen, agent/chat, `workspace-generate`. Parent repo
changes: none. AI inference runs only on an explicit human Deep-analyse press.

## Non-negotiable constraints

- Live deployment is the contract; schemas stay permissive.
- No mutation without an explicit human press (R-W-7); no auto-retry of the
  POST.
- `ApiError.message` / the parent's `error`/`message` strings are never shown
  verbatim (describe-error docblock).
- No `npm run build` / `next build` / prisma migrations (repo rule).
