# Desktop — Visual Sign-in and Command Centre — Design (Slice 8)

## 1. Sign-in shell (R-V1..R-V5)

### Layout

```
┌────────────────────────┬──────────────────────────────────────┐
│                        │  ◈ Tenders-SA  Desktop               │
│  Sign in to Tenders-SA │                                      │
│                        │  Your bid desk for South African     │
│  Email                 │  public procurement                  │
│  [__________________]  │                                      │
│                        │   ◉────────◉────────◉────────◉       │
│  Password              │  Discover  Analyse  Prepare  Submit  │
│  [__________________]  │                                      │
│                        │  · Radar scores every open tender    │
│  [     Sign in     ]   │    against your company profile      │
│                        │  · Deep-analyse tender documents     │
│                        │  · Package and export your response  │
│                        │                                      │
│  v0.1.0 · api.tenders-sa.org · ● Connected                    │
└────────────────────────┴──────────────────────────────────────┘
   420px fixed              flex-1, hidden below 900px
```

The form column is the **existing** `LoginShell` body, moved inside a new
outer grid and otherwise untouched. `describeFailure`, the submit handler,
the gate check, the password clear and every ARIA attribute stay exactly as
they are — R-V2 is enforced by the existing test file passing unmodified. If
a change to `login-shell.test.tsx` becomes necessary to make this slice pass,
that is a signal the auth behaviour moved and the change is wrong.

The brand column is `hidden lg:flex`. Tauri's minimum window width is 960
logical px (`src-tauri/tauri.conf.json:18`), so the two-column layout is the
normal case and the single-column fallback exists for a user who has scaled
their display, not for a phone.

### The bid-pipeline graphic

Four nodes connected by a rail, drawn as one inline SVG. The nodes are a
faithful **summary** of the eight real workspace stages, not a parallel
vocabulary:

| Node | Covers (`WORKSPACE_STAGES`, `applications.ts:184`) |
|---|---|
| Discover | `suggested` |
| Analyse | `needs_analysis`, `review_requirements` |
| Prepare | `fix_readiness`, `add_information`, `generate_documents` |
| Submit | `ready_to_submit`, `submitted` |

Recording the mapping here is the point: someone renaming a parent stage can
see what the sign-in screen claims about the product and correct it.

Motion: a single emerald pulse travels the rail left to right on a slow loop
(≈6s), implemented as a CSS `@keyframes` translation of one small circle —
no JS, no timer, and wrapped in
`@media (prefers-reduced-motion: reduce) { animation: none }`. Under reduced
motion the diagram is static and loses nothing.

Rendering is pure SVG: `<line>` rail, `<circle>` nodes, `<text>` labels, all
`hsl(var(--primary))` / `hsl(var(--muted-foreground))` / `hsl(var(--border))`.
The whole thing is well under 2KB of markup and needs no asset pipeline,
which matters because the CSP forbids remote images.

### Status footer

`v{version} · {apiHost} · ● {Connected|Offline}`

- version from the Vite-injected `package.json` version, not a literal;
- API host is the **hostname only** of the resolved base URL — never a full
  URL with a path, and never the Developer API (`endpoint-parity.test.ts`
  forbids that host in source regardless);
- the dot is `--success` when `useConnectivity()` is `online`, `--muted-
  foreground` when offline, with the word beside it doing the real work —
  colour is never the sole carrier of the state (1.4.1).

Offline copy: *"Offline — sign-in needs a connection to Tenders-SA."*
It is a plain line, not `role="alert"`; nothing has failed yet.

## 2. Chart primitives (R-V6..R-V8)

### Why no charting library

Recharts was considered — the web app uses it — and rejected for three
reasons specific to this codebase:

1. **Testability.** `ResponsiveContainer` measures the DOM to decide its
   size, and jsdom reports zero. Every chart test would need a width shim,
   and this repo's culture is real assertions on real output (see
   `design-tokens.test.ts`, which parses the actual token file rather than a
   copy). Fixed-`viewBox` SVG renders identically under jsdom and is
   asserted directly.
2. **Dependency surface.** The desktop has *zero* UI dependencies today —
   React, Router, Query, Zustand, Zod, Tauri plugins, nothing else. The
   charts needed here are an area trend, bars, a donut and an arc; each is
   tens of lines of geometry.
3. **Token fidelity.** Every mark must be `hsl(var(--chart-N))` so the
   contrast guarantees in `design-tokens.test.ts:156` hold. Hand-drawn SVG
   makes that trivially auditable by a source scan (R-V8).

### Module shape

```
src/components/charts/
  scale.ts       linearScale, bandScale, niceTicks, polarPoint, arcPath
  ChartFrame.tsx role="img" wrapper + <table class="sr-only"> emitter
  AreaTrend.tsx  1–2 series over a date axis
  BarRow.tsx     horizontal labelled bars
  Donut.tsx      part-to-whole, ≤5 slices
  Gauge.tsx      single value against a capacity
```

Every primitive:

- takes plain data (`{label, value}[]` or `{x, series}[]`) and a
  `seriesTokens: ChartToken[]` prop — never a colour string;
- renders into a fixed `viewBox` with `preserveAspectRatio="none"` on the
  plot area only (labels stay in a non-scaled layer so text never stretches);
- sizes with `width="100%"` and a CSS `height`, so layout comes from the
  grid and nothing measures anything;
- routes its accessible name and its `sr-only` table through `ChartFrame`,
  so a new chart cannot forget them.

`ChartFrame` is the enforcement point for R-V7: it requires `label` and
`rows`, and emits

```html
<figure>
  <svg role="img" aria-label="…" aria-describedby="…">…</svg>
  <table class="sr-only" id="…"><caption>…</caption>…</table>
</figure>
```

### Number formatting

ZAR uses the existing `Intl.NumberFormat("en-ZA", …)` pattern already in
`DeadlinePanel.tsx:7`; axis money is compacted (`R1.2m`, `R840k`) with a
helper local to the charts module, mirroring the web dashboard's
`formatCompactZar`. Dates on the trend axis render `en-ZA` `d MMM`, and only
every fifth tick is labelled so 30 points stay legible.

## 3. Pulse endpoint (R-V9)

`src/services/api/endpoints/pulse.ts`, `PulseEndpoint extends
AuthenticatedEndpoint`, one method:

```ts
async getPulse(signal?: AbortSignal): Promise<PlatformPulse>
```

Path `"/api/v1/dashboard/platform-pulse"`, envelope
`z.object({ success: z.literal(true), data: pulseSchema })` — the same
`{success,data}` envelope `DashboardEndpoint` already handles, and unlike
`/api/tenders`, which returns a bare domain key.

Parsing follows the house style for parent-internal routes: totals and
collections are typed, every collection defaults to `[]`, every total
defaults to `0`, and the object is `.passthrough()`. A field the parent adds
later must not break a shipped desktop build.

**This route is not the `/api/v1/dashboard/summary` trap.** That route and
`/api/v1/dashboard/activity` answer `{}` on the live deployment (recorded in
`dashboard.ts:8` and `dashboard-live-data.md`), which is why the deadline and
activity panels feed from `/api/v1/applications` instead. `platform-pulse` is
a different route with a real service behind it
(`platform-pulse.service.ts`), and the web dashboard renders it today.
T1's verification is a live read confirming that before any UI is built —
if it comes back empty, the market charts are cut and the slice ships the
three local ones.

The client is constructed in `auth-wiring.ts` alongside the others and added
to `ApiClients` as `pulse`, with `src/tests/fixtures/api-clients.ts` gaining
a matching idle fixture.

## 4. Command Centre layout (R-V10..R-V12)

```
Command Centre
┌───────────────────────────────────────────────────────────────┐
│ Active   New 30d   Closing 7d   Awards 30d   Value awarded    │  KPI strip
│ 4 812    1 204     318          642          R8.4bn           │  (pulse)
└───────────────────────────────────────────────────────────────┘
┌───────────────────────────────┬───────────────────────────────┐
│ Market activity — 30 days     │ Your pipeline                 │
│  ╱╲    tenders ▬  awards ▬    │        ╭───╮                  │
│ ╱  ╲╱╲___╱╲                   │       │ 12  │  Draft 5        │
│  AreaTrend (pulse)            │        ╰───╯   Submitted 4    │
│                               │  Donut (applications)         │
├───────────────────────────────┼───────────────────────────────┤
│ Deadline runway — 14 days     │ Tenders by province           │
│  ▁▁▃▁▅▁▁▂▁▁▁▄▁▁               │ Gauteng      ▮▮▮▮▮▮▮▮ 1 402   │
│  BarRow/histogram (apps)      │ Western Cape ▮▮▮▮▮ 903        │
│                               │ BarRow (pulse)                │
├───────────────────────────────┴───────────────────────────────┤
│ Your plan  ◔ 3 of 10 application slots used   Gauge (subscr.) │
└───────────────────────────────────────────────────────────────┘
  then the existing ActionPanel / ActivityPanel / "Find work to bid on"
```

### Where each visual's data comes from

| Visual | Source | Extra request |
|---|---|---|
| KPI strip | `pulse.totals` | the one pulse call |
| Market activity | `pulse.trend` | — |
| Tenders by province | `pulse.tendersByProvince`, top 8 | — |
| Your pipeline | applications list, grouped by `status` | none — already fetched |
| Deadline runway | applications list, `tender.closingDate` bucketed by day | none |
| Slots gauge | `subscription` entitlement `applicationSlots` | none |

`DeadlinePanel` currently owns the applications fetch. To avoid a second
identical request, the fetch is hoisted into the Command Centre and passed
down; `@tanstack/react-query` is already a dependency and its cache is the
alternative if hoisting proves awkward, but hoisting is preferred because
the existing panels use the plain `useAsync` hook and mixing two data layers
in one screen is worse than one prop.

Status grouping for the donut uses the known set — `DRAFT`, `SUBMITTED`,
`UNDER_REVIEW`, `AWARDED`, `REJECTED` — with anything else summed into
`Other`. `status` is `z.string()` in the schema (`applications.ts:43`)
precisely because the parent may add values; the donut must not drop an
application it does not recognise.

### States

Every visual is a `Panel` + `AsyncSection`, so loading (`role="status"`) and
error (`role="alert"`, `data-error-kind`, retry) come free and match the rest
of the app. Two failure domains, isolated per R-V11: pulse failing leaves
pipeline/runway/slots rendered, and applications failing leaves the KPI strip
and market charts rendered.

Empty states are written copy, never an empty axis:

| Situation | Copy |
|---|---|
| 0 applications | "No applications yet. Your pipeline appears here once you start one from Tender Radar." |
| 0 closings in 14 days | "Nothing closes in the next fortnight." |
| trend all zero | render the baseline and axis with "No activity recorded in this window." |
| no province rows | "Province breakdown is unavailable right now." |
| entitlement `kind: "none"` | reuse `SubscriptionPanel`'s existing copy; no gauge |

The KPI strip renders `—` for a total the payload omits, never `0`; a
missing number and a genuine zero are different claims.

## 5. What this slice does not change

The four existing panels keep their routes, their copy and their error
handling. `SubscriptionPanel` keeps its own fetch and its careful
entitlement logic — the gauge reads the value it already resolved rather
than re-deriving it. No capability file, no origin list, no auth code and no
parent-repo file is touched.
