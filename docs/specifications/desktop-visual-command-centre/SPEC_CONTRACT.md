# Desktop — Visual Sign-in and Command Centre — SPEC_CONTRACT (Slice 8)

- **Status**: `PENDING APPROVAL`
- **Date**: 2026-08-11
- **Scope**: Slice 8 — visual sign-in shell and a charted Command Centre
  (R-V1..R-V12).
- **Approved by**: —
- **Approval date**: —

## Contract checklist (mirrors tasks.md)

| # | Item | Contract |
|---|---|---|
| C1 | Live contract check | `/api/v1/dashboard/platform-pulse` confirmed to return a populated payload against the running site with a real session, recorded with date in `INTEGRATION_EVAL.md`, **before** any market chart is built; an empty answer cuts C6 rather than shipping charts over a dead route |
| C2 | Pulse endpoint | `PulseEndpoint.getPulse()` on `"/api/v1/dashboard/platform-pulse"`, `{success:true,data}` envelope, typed-permissive schema with `.passthrough()`, collections default `[]`, totals default `0`; constructed in `auth-wiring.ts` as `ApiClients.pulse`; idle fixture added |
| C3 | Chart primitives | `src/components/charts/` — `scale.ts`, `ChartFrame`, `AreaTrend`, `BarRow`, `Donut`, `Gauge`; **no charting dependency added**; fixed `viewBox`, no DOM measurement; `ChartFrame` requires `label` + `rows` and emits `role="img"` + `aria-label` + an `sr-only` data table |
| C4 | Sign-in shell | two-column layout; brand column with mark, positioning line, four-node bid-pipeline SVG (8→4 stage mapping as recorded in `design.md` §1), three capability lines; footer of version · API hostname · connectivity; brand column hidden below `lg`; ambient motion disabled under `prefers-reduced-motion` |
| C5 | Local charts | pipeline donut (known statuses + `Other`), 14-day deadline runway, application-slots gauge — from data the screen already fetches; applications fetch hoisted so the request count does not increase |
| C6 | Market charts | five-tile KPI strip, 30-day tenders-vs-awards `AreaTrend`, top-8 province `BarRow` — from exactly **one** pulse request per mount |
| C7 | Guards | `endpoint-parity.test.ts` pins the pulse path on `pulse.ts`; `design-tokens.test.ts` gains a no-raw-colour scan over the chart sources |
| C8 | Verification gates | full `vitest`, `tsc --noEmit`, `eslint .`, `prettier --check .` — zero errors |
| C9 | Human verification | user signs in and confirms the sign-in screen, the offline line, and that Command Centre figures agree with the web dashboard; recorded in `INTEGRATION_EVAL.md` |

## Explicitly out of contract

Parent-repository changes; a charting library; a light theme or any second
token set; charts on any screen other than the Command Centre; interactive
charts (tooltips, zoom, click-to-filter); raster assets of any kind; changes
to the four existing Command Centre panels' routes, copy or error handling.

## Non-negotiable constraints

- **The authentication flow does not change.** `GatedAuthService`, the
  `AuthError` union, `describeFailure` copy, password clearing and the ARIA
  wiring are untouched. `login-shell.test.tsx`'s existing assertions must
  pass **unedited** — an edit to them means the behaviour moved and the
  change is wrong.
- **No number is stated pre-authentication.** There is no session on the
  sign-in screen and therefore no data; a count of anything would be
  invented.
- **A missing value is not zero.** An omitted total renders `—`.
- **One failing route may not blank the screen.** Every visual sits in its
  own `AsyncSection`; the pulse and applications failure domains are
  isolated from each other.
- **No capability change.** The pulse route is a `path` call to the
  main-application origin already allowed; `capability-scope.test.ts` and
  the Tauri capability files are not touched, and any widening of the
  allow-list is out of contract.
- **Tokens only.** No hex, `rgb()` or named colour in the chart module or
  the new Command Centre code — enforced by the C7 scan.
- **Charts are announced.** No chart ships without an accessible name and an
  `sr-only` data table.
- No `npm run build` / `next build` / prisma migrations (repo rule); the
  Windows Tauri release build stays a user gate.
