# Desktop — Visual Sign-in and Command Centre — INTEGRATION_EVAL (Slice 8)

- **Status**: spec written, `PENDING APPROVAL` — no code written, no gate run
- **Spec**: `desktop-visual-command-centre/` (requirements R-V1..R-V12,
  design, tasks T1..T8)

## Parent surface read before writing this spec (2026-08-11)

| Fact | Source (parent repo) |
|---|---|
| `GET /api/v1/dashboard/platform-pulse` — JWT via `verifyJWTFromRequest`, 401 unauthorized, `{success:true,data}`, `Cache-Control: private, max-age=300` | `src/app/api/v1/dashboard/platform-pulse/route.ts` |
| `PlatformPulseData` = `totals{activeTenders,newTenders30d,closingSoon7d,awards30d,awardedValue30d}`, `trend[30]{date,tenders,awards}`, `tendersByProvince[]`, `awardsByProvince[]`, `generatedAt`; provinces folded to nine + `National / Unspecified` server-side | `src/lib/services/platform-pulse.service.ts:35` |
| The web dashboard renders this same route (line trend + province bars + KPI row), so desktop and web cannot disagree | `src/components/dashboard/platform-pulse.tsx` |
| `--chart-1..5` exist, are Tailwind-wired and contrast-checked, and are unused by any component | desktop `src/styles/tokens.css:72`, `src/styles/theme.css:49`, `src/tests/design-tokens.test.ts:156` |

**Not** used, and why: `/api/v1/dashboard/summary` and
`/api/v1/dashboard/activity` answer `{}` on the live deployment — recorded in
`src/services/api/endpoints/dashboard.ts:8` and
`docs/specifications/dashboard-live-data.md`. T1 exists to prove
`platform-pulse` is not a third instance of that before anything is built on
it.

## Gates

| Gate | Task | Evidence | Date |
|---|---|---|---|
| Live pulse payload | T1 | pending | — |
| Pulse endpoint tests | T2 | pending | — |
| Chart primitive tests | T3 | pending | — |
| Sign-in shell tests (existing file unedited) | T4 | pending | — |
| Local Command Centre chart tests | T5 | pending | — |
| Market chart tests | T6 | pending | — |
| Parity + no-raw-colour guards | T7 | pending | — |
| Full suite + static gates | T7 | pending | — |
| Live human verification | T8 | pending | — |
