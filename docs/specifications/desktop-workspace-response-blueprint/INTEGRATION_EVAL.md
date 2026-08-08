# Desktop Workspace — Response Blueprint — INTEGRATION_EVAL (Slice 3)

- **Status**: pending (filled during/after implementation)
- **Spec**: `desktop-workspace-response-blueprint/` (requirements R-B-1..R-B-6,
  design, tasks)

## Gates

| Gate | Task | Evidence | Date |
|---|---|---|---|
| Endpoint contract tests | T1 | `vitest module-endpoints` — new method against live-verified shapes | |
| Panel tests | T2 | `vitest module-screens` — render/status-chips/error/empty | |
| Full suite + static gates | T3 | `vitest` (all), `tsc --noEmit`, `eslint .`, `prettier --check .` — 0 errors | |
| Capability/parity | T3 | `vitest capability-scope endpoint-parity` | |
| Live human verification | T4 | user opens a live DRAFT workspace: blueprint sections render (probe app ≥12 required user docs), saved/generating/failed status chips, forced route failure degrades only this panel | |

## Live contract evidence (2026-08-08)

Route contract read from parent code
(`src/app/api/v1/applications/[applicationId]/assist/response-blueprint/route.ts`
+ `src/lib/services/workspace/response-blueprint.ts`,
`response-doc-status.ts`). Live probe (Slice 1 eval, app
`cmsed6wb71ct5knmuidlfu7fw`): `GET /assist/response-blueprint` — 200,
blueprint + 12 required user documents. Section shapes verified against the
route's builder; `responseDocs`/`responseDocStatus` read from
`applicationExtraInfo` namespaced keys.

## Deviations

- *(none yet)*
