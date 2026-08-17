# Desktop — Supplier Profile — INTEGRATION_EVAL (Slice 12)

- **Status**: T1–T10 complete — awaiting T11 (human verification)
- **Spec**: `desktop-supplier-profile/` (requirements R-S1..R-S17, hazards
  H1..H14, limitations L1..L5, design, tasks T1–T11)

## Parent contract audit (read from parent source, 2026-08-16)

Every finding below was read directly from `F:/projects/tendersa` on
2026-08-16. Findings F1–F4 correct the working assumptions this slice was
scoped against; building on those assumptions would have shipped a screen that
called a non-existent route, rendered another company's registration details,
or permanently under-reported for paying subscribers.

| # | Finding | Evidence |
|---|---|---|
| F1 | **The per-supplier forensic route is `/api/forensic/supplier/[slug]`, not `/api/tools/forensic-analysis/supplier/[slug]`.** The latter path does not exist — `src/app/api/tools/forensic-analysis/` contains only `access`, `compare`, `entity-context`, `export`, `memo`, `pair` and `search`. A client on the wrong path gets a 404 that `kindForStatus` maps to `not-found`, which the UI would render as a false statement about the **company** | parent `src/app/api/forensic/supplier/[slug]/route.ts:10-14`; directory listing of `src/app/api/tools/forensic-analysis/`; desktop `src/services/api/errors.ts:95-103` |
| F2 | **`auth()` accepts a Bearer token, so there is no auth split.** It reads `Authorization: Bearer …` first and only then falls back to the `token` cookie, verifying the same JWT `verifyJWTFromRequest` verifies. Contracts B, D, E and F are therefore fully reachable from the desktop's existing session; tier differences are genuine tier differences, not authentication artefacts | parent `src/lib/auth.ts:130-165` (Bearer at `:134-140`, cookie fallback at `:142-148`, `verifyJWT` at `:154,173-177`); `src/lib/forensic/forensic-access.ts:109-112`; desktop `src/services/api/endpoints/base.ts:43-46` |
| F3 | **Contract C's slug round-trip is lossy because of punctuation, not legal-form suffixes.** `generateCompanySlug` calls `sanitizeCompanyName`, which **deletes** `()[]{}` and trims wrapper punctuation before hyphenating — it does **not** strip legal forms (that is `normalizeCompanyName`, which is not the slug generator). C reverses the slug with `slug.replace(/-/g,' ')` and matches `equals … mode:'insensitive'`, so `"ABC Trading (Pty) Ltd"` → `abc-trading-pty-ltd` → `"abc trading pty ltd"` never matches the stored name. `(Pty) Ltd` is the commonest SA legal form, so C silently returns an empty record for a large share of real suppliers | parent `src/lib/utils/company-name.ts:7-14,111-115` vs `src/app/api/forensic/supplier/[slug]/route.ts:15,24-26` |
| F4 | **`findCompanyNameBySlug` round-trips correctly**, applying the same bracket-stripping in SQL (`REGEXP_REPLACE(supplier_name, '[()\[\]{}]', '', 'g')`) and matching either the normalized-key slug or the raw slug. This is why contracts F and G resolve slugs that C cannot — and why the desktop must not assume all slug consumers behave alike | parent `src/lib/data-access/company-intelligence.ts:258-300` |
| F5 | **Contract C is completely unauthenticated and CDN-cached for six hours**, with `revalidate = 21600` and `CDN-Cache-Control: public, s-maxage=21600`. Its answer is identical for every caller, so nothing user-specific or entitlement-specific may be inferred from it | parent `src/app/api/forensic/supplier/[slug]/route.ts:8,62-66` |
| F6 | **Contract C truncates on a raw request header.** `isPro = req.headers.get('x-pro-access') === 'true'`; nothing in the parent sets it. Without it, `forensicFlags` is sliced to 3 and `awardTimeline` to 10. It is a **client-assertable** access gate, so the desktop must not send it | parent `src/app/api/forensic/supplier/[slug]/route.ts:16,37,53` |
| F7 | **Contracts A and B use different meta casings for the same concepts.** A: `per_page`, `total_pages`, `has_next`. B: `perPage`, `totalPages`, `hasNext`. A shared pagination reader would yield `undefined` on one of the two | parent `src/app/api/tools/company-intelligence/search/route.ts:96-102` vs `src/app/api/tools/forensic-analysis/search/route.ts:121-133` |
| F8 | **Contract B's richest fields are tier-conditional and look identical to "no data".** `intelligence`, `provinceHealth` and `competitive` are computed only when `access.capabilities.advancedFilters` is true; otherwise `null` / `[]`. Only `meta.access` distinguishes "not on your plan" from "not recorded" | parent `src/lib/data-access/forensic-search.ts:614-620,650-671,690-693`; `src/lib/forensic/forensic-access.ts:49-58` |
| F9 | **Contract B's preview cap can hide a supplier entirely.** A non-subscriber gets `perPage: min(8, …)` and `page` forced to 1, so a supplier outside the top 8 of its own query is absent for plan reasons | parent `src/lib/data-access/forensic-search.ts:120,183-199`; `src/app/api/tools/forensic-analysis/search/route.ts:115,124-128` |
| F10 | **Contracts A and B produce the *same* supplier slug** — both `generateCompanySlug(name)` — so cross-surface matching by slug is safe. Buyer rows in B use `sourceSlug` instead, which is a different namespace | parent `src/lib/data-access/company-intelligence.ts:434`; `src/lib/data-access/forensic-search.ts:641` |
| F11 | **Contract D accepts `name` as well as `slug`, and its `slug` handling is as naive as C's** (`value.replace(/-/g,' ')`). Passing `name` avoids the F3 hazard entirely | parent `src/app/api/tools/forensic-analysis/entity-context/route.ts:19-21,40-42` |
| F12 | **Contract D returns 403 without an active subscription**, reusing the `fullRows` capability. Contract E returns 403 without `compareEntities`. Contract B's **supplier** mode is not gated at all; only `mode=buyer` is (Pro+) | parent `entity-context/route.ts:25-35`; `compare/route.ts:31-39`; `search/route.ts:79-87`; `forensic-access.ts:22-31` |
| F13 | **The restricted-supplier overlay already carries legally-cautious wording.** `SupplierRestrictionOverlay.label` is documented as "Human-readable, legally cautious label for the resolved state", and the empty overlay reads "No restricted supplier records in source data". Rewriting it in the desktop would re-do wording the parent already got right | parent `src/lib/data-access/forensic-restricted-suppliers.ts:37-50,51-60`; states at `:16-23` |
| F14 | **Contract F answers HTTP 200 with an all-false body for an anonymous user, an unresolvable slug *and* an internal error.** `isPro: false` therefore never means "definitely not Pro" | parent `src/app/api/v1/report-access/[slug]/route.ts:16-22,47-55,92-101` |
| F15 | **Contracts F and G answer 200 with an empty body when the slug does not resolve.** An empty `directors` array is not evidence that a company has no directors | parent `report-access/[slug]/route.ts:52-55`; `src/app/api/jv/contacts/route.ts:29-31` |
| F16 | **Contract H returns a bare JSON array with no wrapper**, `limit` clamped to 20, `revalidate = 3600`; its `slug` is a `CompanyShowcaseProfile.slug` — a different namespace from the award-derived slug | parent `src/app/api/public/featured-user-companies/route.ts`; `src/lib/services/showcase.service.ts:49-95` |
| F17 | **There is no per-slug company profile JSON API.** `/tools/company-intelligence/[slug]` is a Next.js server component reading the database directly; no `/api/**` route serves an equivalent document | absence of any `src/app/api/**/company-intelligence/**/[slug]` route; `src/app/api/tools/company-intelligence/` contains only `search`, `track`, `unsubscribe` |
| F18 | **The desktop already fetches and discards four enrichment fields.** `companySchema` declares `website`, `headquartersAddress`, `confidenceScore` and `lastEnrichedAt`; the parent populates all four; `CompanyRow` renders only `description` | desktop `src/services/api/endpoints/supplier-intelligence.ts:41-54` and `src/features/intelligence/SupplierIntelligence.tsx:198-217`; parent `src/lib/data-access/company-intelligence.ts:42-48` |
| F19 | **No new Tauri capability is needed.** Every route in A–H is under `https://www.tenders-sa.org/api/*`, which the capability already allows. Opening a supplier's `website` externally would need `opener:`/`shell:`, which the capability deliberately withholds | desktop `src-tauri/capabilities/default.json` |
| F20 | **The four forensic flag types are enumerable**, so neutral copy can be written for each rather than passing the parent's raw type string to the user: `DEREGISTERED_ENTITY`, `POOR_COMPLIANCE`, `NEW_ENTRANT_LARGE_AWARD`, `DISQUALIFIED_DIRECTOR` | parent `src/lib/cipc/forensics.ts:311,320,331,342` (and the parallel block at `:430,439,450,461`) |

F17 is the limitation this slice documents rather than fixes (L1): closing it
needs a parent change, which is a separately assigned task. F3 and F6 are
likewise parent-side and are handled by honest degradation (R-S11, R-S14).

## Corrections to the scoping brief

| Claim in the brief | Corrected finding |
|---|---|
| Contract C is at `GET /api/tools/forensic-analysis/supplier/[slug]` | It is at `GET /api/forensic/supplier/[slug]` (F1) |
| C's slug hazard comes from `generateCompanySlug` stripping legal-form suffixes | `generateCompanySlug` calls `sanitizeCompanyName`, which strips **brackets and wrapper punctuation**, not legal forms. The hazard is lossy hyphenation of punctuation (F3) |
| The forensic and report-access routes resolve tier from a browser session cookie via `auth()`, so the desktop gets the anonymous/preview variant | `auth()` reads `Authorization: Bearer` **first**. There is no auth split; B, D, E and F are fully authenticated from the desktop (F2) |
| Contract D takes `slug=…` | It takes `name` **or** `slug`, and `slug` is deslugified as naively as C's. `name` is the correct parameter (F11) |
| Contract C is "gated by" `x-pro-access`, always giving a direct caller truncated data | Correct, and additionally the route has **no authentication at all** and is CDN-cached for six hours (F5, F6) |
| Contract B's filters | Also accepts `buyer_type`, `municipality`, `org`, `page`, `per_page`; `sort` values are `highest_value`, `most_awards`, `most_recent`, `highest_risk`, `highest_concentration` (`search/route.ts:16-22,89-111`) |
| `SupplierRestrictionOverlay` = `{state, activeCount, historyCount, overlapCount, confidence, periods[]}` | Also carries `restricted`, `lastSyncAt` and a legally-cautious `label` the desktop should render verbatim (F13) |
| Contract B's supplier search is subscriber-gated | Supplier mode is **not** 403-gated; only `mode=buyer` is, and it needs Pro+ (F12) |

## Gates

| Gate | Task | Evidence | Date |
|---|---|---|---|
| Identity resolution over contract A | T1 | `supplier-profile.test.tsx` — exact-slug selection, near-miss rejected, `not-found` raised, `slugComparableName` pinned to `company-name.ts:5-6` | 2026-08-16 |
| Five remaining read methods with hazards encoded | T2 | 15 endpoint tests; corrected path asserted, `x-pro-access` asserted absent, `name=` asserted on contract D, mismatch empties the record | 2026-08-16 |
| Wiring (three edits), parity and capability tests unedited | T3 | `createAuthWiring` constructs `supplierProfile`; `endpoint-parity.test.ts` (12) and `capability-scope.test.ts` (19) green unedited | 2026-08-16 |
| Route, open affordance, navigation unedited | T4 | `/suppliers/:slug` mounts its own screen; click and keyboard both open; no control without the callback; `navigation-reachability.test.tsx` (28) green unedited | 2026-08-16 |
| Pinned copy module + banned-word test | T5 | every §8.4 string pinned; banned-word sweep over the whole module and over the rendered screen | 2026-08-16 |
| Screen read path, eight panels, "Not recorded" everywhere | T6 | panel order asserted; all-null fixture renders no `0` and keeps every heading | 2026-08-16 |
| Partial-failure isolation, six upstreams | T7 | one test per upstream + a single-alert test; identity failure alone fails the screen | 2026-08-16 |
| Tier degradation and slug verdict | T8 | 403 on D and G, `preview: true`, `advancedFilters: false`, `matched: false` — each asserts plan/verification copy **and** the absence copy's absence | 2026-08-16 |
| List enrichment + conditional forensic overlay | T9 | enrichment fields with `search` called once; overlay merges on `preview: false`, one line on `preview: true`, silent on failure | 2026-08-16 |
| Full suite + static gates | T10 | see "Verification gates" below | 2026-08-16 |
| Live human verification | T11 | — | — |

## Verification gates (T10)

| Gate | Command | Result |
|---|---|---|
| Unit and integration tests | `pnpm exec vitest run` | **57 files, 1030 tests passed** (baseline before this slice: 56 files, 953 tests — so 77 added, 0 broken) |
| Types | `npx tsc --noEmit` | **clean** |
| Lint | `npm run lint` | **clean** — 0 errors, 0 warnings |
| Formatting | `npx prettier --check .` | clean for every file this slice touched; **one pre-existing failure remains**, see below |

**`reports/procurement-officers.md` fails `prettier --check` and was not
touched by this slice.** It is tracked, last modified by commit `91340b0`
(2026-08-15), and has no working-tree modification, so the drift predates this
work. It was left alone rather than reformatted: putting an unrelated
committed report into this slice's review diff would obscure the change under
review, and the drift is worth someone knowing about rather than silently
absorbing.

No existing test file was edited. `src/tests/fixtures/api-clients.ts` gained
one `supplierProfile` entry, which is the single edit this slice makes to a
file the in-flight company-profile slice also holds.

## Implementation notes

Three things were decided during implementation and are recorded because a
reader of the spec alone would not predict them:

1. **`intelligenceCompanySchema` is now exported** from
   `supplier-intelligence.ts` (renamed from the private `companySchema`), so
   the profile client parses the identical contract A shape instead of
   declaring a second copy. Design §2 called for sharing the type and the
   formatter; sharing the schema is the same principle applied one level
   deeper. No method was added to that endpoint, as R-S3 requires.
2. **`CipcData` is written out field-by-field** rather than derived with
   `Omit<z.infer<…>, "complianceScore">`. `.passthrough()` adds an index
   signature, and `Omit` over an index signature collapses every named key
   into `unknown` — the derived form compiled while typing all seven fields as
   `unknown`. Caught by `tsc` at the display boundary.
3. **`searchForensicSuppliers` was extracted** so the list overlay and the
   per-supplier lookup share one contract-B call site, and the list depends on
   a two-line `ForensicOverlayPort` rather than on the whole profile client.
4. **`supplier-profile-fields.tsx` exports components only.** The first cut
   exported `notRecorded()`, `formatDate()` and `formatMoney()` alongside the
   components and drew four `react-refresh/only-export-components` warnings.
   The formatters moved to `supplier-profile-model.ts` as `formatDateText` /
   `formatMoneyText` returning `string | null`, and the render-time absence
   decision became `<NotRecorded />`, `<Value>`, `<DateValue>` and
   `<MoneyValue>` — which also means the "Not recorded" wording now has
   exactly one definition instead of two call styles. This is design §9's
   separation applied to a file the design had not enumerated.
