# Desktop — Visual Sign-in and Command Centre — INTEGRATION_EVAL (Slice 8)

- **Status**: T2–T7 shipped; **T1 and T8 open** (both need a live session /
  the user). The three market visuals are provisional until T1 is recorded.
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
| Live pulse payload | T1 | **PENDING** — needs a real session. Until recorded here, `pulse.ts` and the three market visuals are provisional and come out if the deployment answers empty (see `tasks.md` "Ordering deviation"). | — |
| Pulse endpoint tests | T2 | `vitest module-endpoints` 99/99 — route + `Bearer` pinned; `{success:true,data:{}}` degrades to empty collections; a missing total stays `undefined` while a real `0` stays `0`; an unknown field passes through; a null province count becomes 0; 401 → `unauthorized`; `success:false` → `malformed`, never read as an empty-but-valid pulse | 2026-08-11 |
| Chart primitive tests | T3 | `vitest charts` 27/27 — scale geometry incl. flat-series (no `NaN`) and zero-count band; full-circle arc emitted as two arcs (the single-application donut); `role="img"` + `aria-label` + `sr-only` table on every primitive; shared y scale across series; zero-value bar keeps a visible stub; unlimited plan draws no gauge fill | 2026-08-11 |
| Sign-in shell tests (existing file unedited) | T4 | `vitest login-shell` 17/17 + `login-redirect` 5/5 pass with **`login-shell.test.tsx` not modified** (R-V2's evidence); `vitest sign-in-shell` 14/14 — no digit in the brand column, first Tab lands on Email, all four pipeline labels, every `WORKSPACE_STAGE` mapped exactly once, online/offline footer, no second live region | 2026-08-11 |
| Local Command Centre chart tests | T5 | `vitest command-centre` — donut from the user's own statuses, unknown status folded into `Other`, archived excluded, runway buckets by local day with the first three days marked urgent, empty-pipeline and nothing-closing copy; **one** `limit: 50` applications read per mount | 2026-08-11 |
| Market chart tests | T6 | `vitest command-centre` 21/21 total — totals rendered, omitted total renders `—` and never `0`, **one** `getPulse` per mount for three visuals, provinces ranked by volume not payload order, all-zero-trend and empty-province copy | 2026-08-11 |
| Failure-domain isolation (R-V11) | T5/T6 | `vitest command-centre` — a pulse 500 leaves the pipeline donut rendered; an applications 500 leaves the market trend rendered | 2026-08-11 |
| Parity + no-raw-colour guards | T7 | `vitest endpoint-parity` 12/12 (pulse path pinned on `pulse.ts`); `vitest design-tokens` 37/37 — 14 chart/sign-in sources scanned for hex, `rgb()`, raw `hsl()` and Tailwind palette classes, plus a guard-the-guard case so a renamed file cannot make the scan vacuous | 2026-08-11 |
| Full suite + static gates | T7 | `vitest` **762/762 (42 files)**, `tsc --noEmit` clean, `eslint .` clean (zero errors, zero warnings), `prettier --check .` clean | 2026-08-11 |
| Live human verification | T8 | **PENDING** — user runs `pnpm tauri dev`, signs in, confirms the sign-in screen and that the Command Centre figures agree with the web dashboard | — |

## Not touched (contract compliance)

`capability-scope.test.ts` and the Tauri capability files are unchanged — the
pulse is a `path` call to the main-application origin already allowed. No
auth code, no parent-repository file, and no charting dependency was added;
`package.json` gained nothing.
