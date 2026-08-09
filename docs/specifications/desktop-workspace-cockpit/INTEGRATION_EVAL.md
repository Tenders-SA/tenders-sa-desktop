# Desktop Workspace Cockpit — INTEGRATION_EVAL (Slice 1)

- **Status**: complete — automated gates and live human verification passed
- **Spec**: `desktop-workspace-cockpit/` (requirements R-W-1..R-W-7, design, tasks)

## Gates

| Gate | Task | Evidence | Date |
|---|---|---|---|
| Endpoint contract tests | T1 | `vitest module-endpoints` — new methods against live-verified shapes | 2026-08-08 |
| Panel tests | T2 | `vitest module-screens` — render/error/empty per panel | 2026-08-08 |
| Full suite + static gates | T3 | `vitest` (all), `tsc --noEmit`, `eslint .`, `prettier --check .` — 0 errors | 2026-08-08 |
| Capability/parity | T4 | `vitest capability-scope endpoint-parity` | 2026-08-08 |
| Live human verification | T5 | User confirmed the application workspace renders correctly and is properly verified after correcting the summary decoder's `autoArchived` contract from boolean to numeric count. | 2026-08-09 |

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

- The live summary response serializes `autoArchived` as a non-negative numeric
  count. The desktop schema and its regression fixture originally treated it as
  a boolean, causing only the Workspace stage panel to reject the otherwise-valid
  response. Corrected and verified live on 2026-08-09.
