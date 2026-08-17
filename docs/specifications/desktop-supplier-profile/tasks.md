# Desktop — Supplier Profile — Tasks (Slice 12)

> Read `requirements.md` and `design.md` before starting. Complete tasks in
> order; the contract checklist (`SPEC_CONTRACT.md`) must mirror this list.

## Status (2026-08-16)

- T1–T11: NOT STARTED — `SPEC_CONTRACT.md` is `APPROVED` (user, 2026-08-16). Ready to execute.

### Completion (2026-08-16)

T1–T10 are complete. T11 is the user's. Evidence per task, and the four gate
results, are recorded in `INTEGRATION_EVAL.md`.

| Task | State |
|---|---|
| T1 Endpoint skeleton and identity resolution | done |
| T2 The five remaining read methods | done |
| T3 Wiring | done |
| T4 Route and open affordance | done |
| T5 Copy module | done |
| T6 Screen — read path | done |
| T7 Partial-failure isolation | done |
| T8 Tier degradation and the slug verdict | done |
| T9 List enrichment | done |
| T10 Gates + docs | done — vitest 57 files / 1030 passed, tsc clean, lint clean (0 errors, 0 warnings), prettier clean for every file this slice touched (one pre-existing unrelated failure recorded in `INTEGRATION_EVAL.md`) |
| T11 Human verification | **outstanding — for the user** |

## Tasks

| # | Task | Pre-check | Verification |
|---|---|---|---|
| T1 | **Endpoint skeleton and identity resolution** — new `src/services/api/endpoints/supplier-profile.ts` with `SupplierProfileEndpoint extends AuthenticatedEndpoint`; `resolveSupplier(slug)` over contract A selecting the row whose `slug` **equals** the target, `not-found` otherwise; `slugComparableName()` replicating `sanitizeCompanyName` + lower-case, pinned by unit test (design §3.1, §4.3) | full suite green at HEAD; `git status` shows `company.ts` still held by the other slice | `vitest supplier-profile` — exact-slug selection, near-miss rejected, no match raises `not-found`, `slugComparableName` matches the `company-name.ts:5-6` examples |
| T2 | **The five remaining read methods** — `getForensicRow` (B, camelCase meta + `preview` + `access`), `getPublicRecord` (C, with the `matched` verdict that **empties** register, timeline, flags and score on mismatch, plus `timelineAtCap`/`flagsAtCap`), `getEntityContext` (D, **`name` not `slug`**), `getReportAccess` (F, with `established`), `getContacts` (G), `getShowcaseEntry` (H, bare array). All schemas `.passthrough()`; no shared pagination reader between A and B (H4) | T1 green | `vitest supplier-profile` — one case per contract pinning method, path and query; camelCase meta read correctly; mismatched `supplierName` yields `matched:false` with the fields emptied; **assert `x-pro-access` is absent from every outgoing request** (R-S14); D's request carries `name=` and not `slug=` |
| T3 | **Wiring** — `supplierProfile` added to `ApiClients` by the three established edits in `src/app/auth-wiring.ts`; one new entry in `src/tests/fixtures/api-clients.ts`. `supplier-intelligence.ts` gains no method; `company.ts` untouched | T2 green | `vitest` — wiring test asserts the client is constructed; `endpoint-parity.test.ts` and `capability-scope.test.ts` pass **unedited** |
| T4 | **Route and open affordance** — `SupplierProfileRoute` and `SupplierListRoute` in `src/app/router/routes.tsx`; `path="suppliers/:slug"`; `SupplierIntelligence` gains `onOpenSupplier` and a focusable name button that is **absent** without the callback. `navigation-items.ts` **not** edited | T3 green | `vitest` — `/suppliers/acme-civils` mounts the profile, not the Command Centre; missing slug redirects; click and keyboard both open with the row's slug; a render without the callback exposes no control; `navigation-reachability.test.tsx` passes unedited |
| T5 | **Copy module** — `supplier-profile-copy.ts` carrying every string in design §6: verdict vocabulary, flag headings, severity labels, standing disclaimer, tier copy, cap disclosure, provenance eyebrows | T4 green | unit test pins each string; a banned-word test asserts "fraud", "corrupt", "illegal", "guilty" and "blacklisted" appear nowhere in the module |
| T6 | **Screen — read path** — `SupplierProfile.tsx` with the hero and panels 1–8 in the order of design §5, each in its own `AsyncSection` with its own subject, each with a provenance eyebrow; `notRecorded()` for every field; a panel with no data still renders heading + eyebrow + "Not recorded" | T5 green | `vitest supplier-profile` — full-record fixture asserts every field and the panel order; all-null fixture asserts no `0` and no blank cell renders and every heading survives |
| T7 | **Partial-failure isolation** — prove each upstream can fail alone (R-S5) | T6 green | `vitest supplier-profile` — six tests, one per contract, each forcing a throw and asserting that panel's `role="alert"` **and** that the hero and the other panels still render, mirroring `module-screens.test.tsx:1041-1056` |
| T8 | **Tier degradation and the slug verdict** — 403 on D, 403 on G, `preview:true`, `advancedFilters:false`, and C's `matched:false` all render the copy from design §6.1/§6.3 and never the empty state | T7 green | `vitest supplier-profile` — five tests, each asserting the tier/verdict copy is present **and** that the absence copy ("not recorded", "no records") is not; `data-error-kind="forbidden"` with no "Try again" control |
| T9 | **List enrichment** — `website`, `headquartersAddress`, `lastEnrichedAt` rendered in the existing provenance block; optional contract B overlay merged by slug **only** when `meta.preview === false`, with the single explanatory line otherwise | T8 green | `vitest supplier-intelligence` — enrichment fields render with no extra request; overlay merges on `preview:false`; on `preview:true` no per-row blanks and the one line renders; existing assertions in `supplier-intelligence.test.tsx` unedited |
| T10 | **Gates + docs** — full `pnpm exec vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx prettier --check .`; update `tasks.md` and `INTEGRATION_EVAL.md` in the same commit; `CHANGELOG.md` entry (user-visible behaviour changes); commit and push scoped to `desktop/tenders-sa-desktop` | T9 green | zero errors on all four gates |
| T11 | **Human verification** — user opens Supplier Intelligence against a real account, opens a supplier from the list, and confirms: the profile loads; registration details either render or say "Requires manual verification"; award history renders with its cap disclosed; risk signals read as signals and carry the disclaimer; a 403 panel says "Your plan does not include …" and not "no data"; the list rows show website/address/last-compiled; a supplier whose name contains "(Pty) Ltd" is checked specifically against H2 | T10 shipped | recorded in `INTEGRATION_EVAL.md` |

## Ordering rationale

T1 lands identity resolution alone, because every other read depends on the
canonical name and getting the selection rule wrong (first row instead of
exact slug) would silently poison all six downstream contracts. T2 lands the
remaining reads with their hazards encoded in the endpoint — the `matched`
verdict empties fields inside the endpoint so no later panel can render the
wrong company. T3–T4 make the screen reachable before it has content, so the
routing guard fails loudly rather than after the UI exists. T5 pins the copy
before any component can invent its own wording, which is the only way §8.4's
vocabulary requirement is enforceable. T6–T8 land display, then isolation,
then degradation — in that order, because a tier test written before the
panels are settled would be asserting against a moving target. T9 is last of
the code tasks because it touches a file the in-flight company-profile slice
also touches.

## Do not

- Send `x-pro-access` on any request (H3). It is a client-assertable access
  gate.
- Pass `slug=` to contract D — pass `name=` (H7).
- Call contract C at `/api/tools/forensic-analysis/supplier/[slug]`; that path
  does not exist (H1).
- Render anything from contract C when `matched` is false (R-S11).
- Render a 403 or a preview cap as absence of data (R-S9).
- Edit `src/services/api/endpoints/company.ts`,
  `src/tests/module-endpoints.test.ts` or `src/tests/module-screens.test.tsx`
  — the in-flight company-profile slice holds all three (see the collision
  note in `SPEC_CONTRACT.md`). New tests go in
  `src/tests/supplier-profile.test.tsx`.
- Flip "Buyer Intelligence" or "Award Intelligence" to `available: true`.
- Cache any figure from this screen in local SQLite (R-S17).
- Run `npm run build` / `next build` / prisma migrations.
