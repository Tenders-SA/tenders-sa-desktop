# Desktop Workspace Cockpit — INTEGRATION_EVAL (Slice 1)

- **Status**: pending (filled during/after implementation)
- **Spec**: `desktop-workspace-cockpit/` (requirements R-W-1..R-W-7, design, tasks)

## Gates

| Gate | Task | Evidence | Date |
|---|---|---|---|
| Endpoint contract tests | T1 | `vitest module-endpoints` — new methods against live-verified shapes | |
| Panel tests | T2 | `vitest module-screens` — render/error/empty per panel | |
| Full suite + static gates | T3 | `vitest` (all), `tsc --noEmit`, `eslint .`, `prettier --check .` — 0 errors | |
| Capability/parity | T4 | `vitest capability-scope endpoint-parity` | |
| Live human verification | T5 | user opens a live DRAFT workspace: panels render real data (stage `add_information`, 6 gaps, 20 competitors, urgency banner); stage move / status transition / archive round-trip; forced single-panel failure degrades only that panel | |

## Live contract evidence (2026-08-08)

Probed with a live session against `https://www.tenders-sa.org`, app
`cmsed6wb71ct5knmuidlfu7fw` (DRAFT):
- `GET /assist` — 200, full payload (readiness 80/ready, urgency low/17 days,
  qualityChecks 4, checklistState 12, events 2, valueEstimate median R581 900).
- `GET /assist/compliance-gaps` — 200, 6 gaps, summary `{blocking:0, important:1,
  strengths:5, score:100}`.
- `GET /assist/research` — 200, organisation (Msinsi Holding (SOC)), 20 competitors,
  provinceHealth North West CAUTION 50, eligibility 3 passes.
- `GET /assist/additional-info` — 200, 6 required fields, 6 unfilled (slice 2 input).
- `GET /assist/response-blueprint` — 200, blueprint + 12 required user documents
  (slice 3 input).
- `GET /applications/workspace/summary` — 200 for ADMIN user, 13 cards,
  stage `add_information` (stage source).
- `PATCH /workspace` — contract read from parent route code
  (`src/app/api/v1/applications/[applicationId]/workspace/route.ts`): status/stage/
  remove; 400 carries `error` + `allowed`; restore is broken in the deployed build
  (desktop excludes it).

## Deviations

- *(none yet)*
