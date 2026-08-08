# Desktop Workspace — Response Blueprint — SPEC_CONTRACT (Slice 3)

- **Status**: `APPROVED`
- **Date**: 2026-08-08
- **Scope**: Slice 3 — response-blueprint panel (R-B-1..R-B-6).
- **Approved by**: user
- **Approval date**: 2026-08-08

## Contract checklist (mirrors tasks.md)

| # | Item | Contract |
|---|---|---|
| C1 | Endpoint method on `ApplicationsEndpoint` | `getResponseBlueprint` (GET, default retry — read-only) against the live-verified contract; permissive schemas (R-B-5) |
| C2 | Panel | `features/applications/workspace/ResponseBlueprintPanel.tsx` — own `useAsync` + `AsyncSection` (R-B-4); confidence + provenance header; per-key doc status chips (R-B-3); required docs, steps, submission, risks |
| C3 | Read-only | no mutation controls, no timers, no polling (R-B-2); no AI-costing parent calls |
| C4 | Honest state | saved → "Saved"; `generating` → "Generating…"; `failed` → "Failed" + error; fallback → "Saved · template"; none → no chip (R-B-3) |
| C5 | Contract tolerance | `blueprint: null`/absent → honest empty state; unknown kind/category/source rendered as plain text (R-B-5) |
| C6 | Wiring + coverage | panel mounted in cockpit grid; fixture gains the method; parity test pins `response-blueprint` literal |
| C7 | Verification gates | `vitest` full suite, `tsc --noEmit`, `eslint .`, `prettier --check .` — zero errors |
| C8 | Human verification | user opens a live DRAFT workspace, blueprint sections render (≥12 required docs on probe app); recorded in `INTEGRATION_EVAL.md` |

## Explicitly out of contract

Response-document generation + editing (`PUT response-doc`), enrichment
(`POST enrich-blueprint`, 402-gated), briefing pack/export, submission
recording, board screen. Parent repo changes: none. No AI inference is
triggered by this slice.

## Non-negotiable constraints

- Live deployment is the contract; schemas stay permissive (R-B-5).
- No mutation without an explicit human press — and none at all this slice
  (R-B-2, R-W-7, brief §4.3).
- No `npm run build` / `next build` / prisma migrations (repo rule).
