# Desktop — Visual Sign-in and Command Centre — Requirements (Slice 8)

**Context**: two screens carry no visual identity and no data visualisation.

- `src/features/auth/LoginShell.tsx:126` renders a single 384px card centred
  on an empty background: heading, two fields, a button. Nothing identifies
  the product, states what it does, or tells the user whether the app can
  reach Tenders-SA before they type a password.
- `src/features/command-centre/CommandCentre.tsx` is four text panels.
  `DeadlinePanel` already fetches 50 applications and `documents/stats` and
  renders three numbers from them; the rest of that payload — every status,
  every closing date, every estimated value — is discarded.
- `src/styles/tokens.css:72` defines `--chart-1` … `--chart-5`, wired into
  Tailwind at `src/styles/theme.css:49` and contrast-checked by
  `src/tests/design-tokens.test.ts:156`. **Nothing in the product has ever
  used them.** The design system anticipated charts; the product never
  drew one.

This slice gives the sign-in screen a product identity and turns the Command
Centre from a list of numbers into a dashboard, using the parent data that
already exists.

**Parent contract** (read from parent source today, 2026-08-11):

- `GET /api/v1/dashboard/platform-pulse`
  (`src/app/api/v1/dashboard/platform-pulse/route.ts`) — JWT via
  `verifyJWTFromRequest`, `401 {success:false,error:'Unauthorized'}` when
  absent, `500 {success:false,error:...}` on service failure. Success is
  `{success:true, data:PlatformPulseData}` with
  `Cache-Control: private, max-age=300`.
- `PlatformPulseData` (`src/lib/services/platform-pulse.service.ts:35`):
  `totals{activeTenders,newTenders30d,closingSoon7d,awards30d,awardedValue30d}`,
  `trend[]{date:'YYYY-MM-DD',tenders,awards}` over 30 days,
  `tendersByProvince[]{province,slug,count}`,
  `awardsByProvince[]{province,slug,count,totalValue}`, `generatedAt`.
  Provinces are folded into the nine plus a `National / Unspecified`
  bucket by the service — the desktop does no bucketing of its own.
- This is the same route the web dashboard's
  `src/components/dashboard/platform-pulse.tsx` draws, so desktop and web
  read one source and cannot disagree.

It is a `path`-based call to the main-application origin already in the
Tauri HTTP allow-list. **This slice adds no capability and no new origin.**

## Requirements

| # | Requirement | Verification |
|---|---|---|
| R-V1 | Sign-in becomes a two-column shell: the existing form column unchanged in behaviour, plus a brand column carrying the product mark, a positioning line, the bid-pipeline graphic and three capability lines. Below 900px logical width the brand column is hidden, never squashed. | `login-shell.test.tsx` — existing assertions still pass unmodified; new layout + narrow-viewport cases |
| R-V2 | The auth flow is untouched: `GatedAuthService` gate, `describeFailure` copy, the `AuthError` union, password clearing, `aria-invalid`/`aria-describedby` wiring and the disabled-when-gated behaviour are byte-identical in effect. | existing `login-shell.test.tsx` suite passes with **no test edited** |
| R-V3 | The bid-pipeline graphic is inline SVG built from four nodes — Discover, Analyse, Prepare, Submit — that summarise the eight real `WORKSPACE_STAGES` (`applications.ts:184`). The mapping is stated in `design.md` and asserted, so the graphic cannot drift from the product's own vocabulary. | `login-shell.test.tsx` asserts the four labels; `design.md` records the 8→4 mapping |
| R-V4 | Nothing on the sign-in screen states a quantity. No tender counts, no user counts, no "trusted by" figures. Pre-auth there is no session and therefore no data; any number would be invented. | `login-shell.test.tsx` asserts the brand column renders no digit-bearing claim |
| R-V5 | The sign-in footer shows the app version, the resolved API host and a live connectivity indicator from `useConnectivity()`. Offline renders as an explicit, non-alarming line — the user learns the network is down before spending a password attempt. | `login-shell.test.tsx` — online/offline cases |
| R-V6 | Chart primitives live in `src/components/charts/` and are **hand-rolled SVG with no charting dependency**: fixed `viewBox` + `preserveAspectRatio`, no DOM measurement, no `ResponsiveContainer`, so they render identically in jsdom and in the webview. | `charts.test.tsx` renders each primitive in jsdom and asserts geometry |
| R-V7 | Every chart is announced: the `<svg>` carries `role="img"` and an `aria-label` stating what it shows, and each chart is accompanied by a visually hidden (`sr-only`) data table carrying the same numbers. A chart that reads as nothing to a screen reader is not shippable here. | `charts.test.tsx` + `command-centre.test.tsx` a11y assertions; `eslint .` (jsx-a11y) clean |
| R-V8 | Charts use `--chart-1` … `--chart-5` and the semantic tokens only. No raw colour literal appears in `src/components/charts/` or in the new Command Centre code (TASK-0.8 carried forward). | `design-tokens.test.ts` gains a scan asserting no hex/rgb literal in chart sources |
| R-V9 | A new `PulseEndpoint` reads `/api/v1/dashboard/platform-pulse` with the standard auth header and permissive-but-typed parsing: recognised fields typed, unknown fields passed through, missing optional collections degrading to empty rather than throwing. | `module-endpoints.test.ts` new cases; `endpoint-parity.test.ts` pins the path |
| R-V10 | Command Centre renders six visuals: a five-tile KPI strip and a 30-day tenders-vs-awards trend and province bars (all from pulse); a pipeline-by-status donut, a 14-day deadline runway and an application-slots gauge (all from data the screen **already** fetches). No new call beyond the single pulse read. | `command-centre.test.tsx`; a call-count assertion pins "one pulse request per mount" |
| R-V11 | Each visual sits in its own `AsyncSection` inside a `Panel`. A pulse failure must not blank the pipeline charts, and an applications failure must not blank the market charts — the existing one-panel-one-route rule (`CommandCentre.tsx:17`) extends to charts. | `command-centre.test.tsx` — pulse 500 renders the local charts; applications 500 renders the market charts |
| R-V12 | Every chart has a designed empty state. A user with zero applications sees a sentence explaining what will appear, not an empty axis or a zero-radius donut. A pulse trend of all zeroes renders the baseline, not a crash. | `command-centre.test.tsx` — zero-application and empty-trend cases |

## Explicitly out of scope

- Any parent-repository change. The pulse route is consumed as it stands.
- A charting library. Rejected deliberately — see `design.md` §2.
- A light theme, a theme toggle, or any second token set (tokens.css states
  this is a spec change, not an enhancement).
- Charts anywhere other than the Command Centre — Tender Radar, the
  workspace cockpit and Supplier Intelligence keep their current
  presentation in this slice.
- Interactive charts: no tooltips, no zoom, no click-through-to-filter.
  Hover affordances are a later slice if the user wants them.
- Animation beyond the sign-in graphic's ambient motion, which must respect
  `prefers-reduced-motion`.
- Any raster asset. The Tauri CSP is `img-src 'self' data:` — inline SVG
  only, and no remote fetch of imagery is possible or attempted.
