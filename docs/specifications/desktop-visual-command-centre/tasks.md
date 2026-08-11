# Desktop — Visual Sign-in and Command Centre — Tasks (Slice 8)

> Read `requirements.md` and `design.md` before starting. Complete tasks in
> order; the contract checklist (`SPEC_CONTRACT.md`) must mirror this list.
> **Do not start T1 while `SPEC_CONTRACT.md` reads `PENDING APPROVAL`.**

## Status (2026-08-11)

- Spec written. Awaiting approval. No code written.

## Tasks

| # | Task | Pre-check | Verification |
|---|---|---|---|
| T1 | **Live contract check.** With a real session, read `GET /api/v1/dashboard/platform-pulse` and confirm it returns a populated `data` (not `{}` like `/dashboard/summary`). Record the observed shape and one real sample in `INTEGRATION_EVAL.md`. If it answers empty, stop and re-scope: T6 is cut and the slice ships T3–T5 only. | spec approved | observed payload recorded with date |
| T2 | **Pulse endpoint.** `src/services/api/endpoints/pulse.ts` — `PulseEndpoint.getPulse()`, `{success,data}` envelope, permissive typed schema, collections default `[]`, totals default `0`. Wire into `auth-wiring.ts` `ApiClients.pulse` and `src/tests/fixtures/api-clients.ts`. | T1 confirms a real payload | `vitest module-endpoints` new cases; `vitest auth-wiring` green |
| T3 | **Chart primitives.** `src/components/charts/` — `scale.ts`, `ChartFrame`, `AreaTrend`, `BarRow`, `Donut`, `Gauge`. Fixed `viewBox`, no DOM measurement, token colours only, `ChartFrame` mandates `label` + `rows` and emits the `sr-only` table. | T2 green | new `charts.test.tsx`: geometry per primitive, `role="img"` + `aria-label`, `sr-only` table content, empty/zero input renders a baseline not a crash |
| T4 | **Sign-in shell.** Two-column layout in `LoginShell.tsx`, brand column (mark, positioning line, pipeline SVG, three capability lines), status footer (version · API host · connectivity). Reduced-motion guard on the pulse animation. **No change to the auth flow.** | T3 green | `vitest login-shell` — every existing assertion passes **with the test file unedited**; new cases: four pipeline labels, no digit-bearing claim in the brand column, online/offline footer, brand column hidden below `lg` |
| T5 | **Local Command Centre charts.** Hoist the applications fetch out of `DeadlinePanel`; add pipeline donut (status grouping incl. `Other`), 14-day deadline runway, slots gauge from the entitlement `SubscriptionPanel` already resolves. Each in its own `Panel` + `AsyncSection`, each with its designed empty state. | T4 green | new `command-centre.test.tsx`: three charts render, zero-application empty copy, applications-500 isolates to those panels, exactly one applications request per mount |
| T6 | **Market charts.** KPI strip (five tiles, `—` for an omitted total), 30-day `AreaTrend` tenders vs awards, top-8 province `BarRow` — all from the single pulse read. | T5 green, T1 confirmed a real payload | `command-centre.test.tsx`: one pulse request per mount, pulse-500 leaves T5's charts rendered, empty-trend copy, omitted total renders `—` |
| T7 | **Gates + guards.** `endpoint-parity.test.ts` pins `/api/v1/dashboard/platform-pulse` on `pulse.ts`; `design-tokens.test.ts` gains a source scan rejecting hex/rgb literals in `src/components/charts/` and the new Command Centre code; update `tasks.md` + `INTEGRATION_EVAL.md`; full `vitest`, `tsc --noEmit`, `eslint .`, `prettier --check .`; commit + push. | T6 green | zero errors across all four gates |
| T8 | **Human verification.** User runs `pnpm tauri dev`, signs in, and confirms: the sign-in screen reads as Tenders-SA and the offline line appears with the network off; the Command Centre charts show plausible numbers matching the web dashboard; charts degrade honestly when a panel fails. | T7 shipped | recorded in `INTEGRATION_EVAL.md` with date; **T8 is not closed without the user's confirmation** |

## Notes

- T1 is a genuine gate, not a formality. Two sibling dashboard routes on
  this deployment answer `{}` (`dashboard.ts:8`), and building three charts
  on a route that turns out to be one of them would waste the slice.
- T4's verification is deliberately "the existing test file is not edited".
  That is the mechanical proof of R-V2.
- No task touches `capability-scope.test.ts`, the Tauri capability files,
  the auth service, or anything in the parent repository. A diff that does
  is out of contract.
