# Desktop — Supplier Profile — Requirements (Slice 12)

**Context**: Supplier Intelligence
(`src/features/intelligence/SupplierIntelligence.tsx`) is a flat, terminal
list. A row shows name, award count, total value, provinces, last known
buyer, rank, last active year and — only when the parent happens to supply
one — a derived description. `CompanyRow` (`SupplierIntelligence.tsx:161`) has
no click affordance, there is no `suppliers/:slug` route in
`src/app/router/routes.tsx`, and no detail screen exists.

That is not enough to vet a partner. Brief §8.4 lists eighteen things a
vetting screen must carry — registration details, contact details, operating
areas, award history, known buyers, contract values, award frequency,
restricted-supplier status, compliance data, data confidence — and the
desktop today shows four of them, on a row, with no way in.

Two further defects are already visible in what exists:

1. **Fields the parent already sends are fetched and discarded.**
   `companySchema` (`src/services/api/endpoints/supplier-intelligence.ts:41-54`)
   declares `enrichment.website`, `enrichment.headquartersAddress`,
   `enrichment.confidenceScore` and `enrichment.lastEnrichedAt`. The parent
   populates all four (`src/lib/data-access/company-intelligence.ts:42-48`,
   read 2026-08-16). `CompanyRow` renders **only** `description`
   (`SupplierIntelligence.tsx:198-217`). Three fields and a freshness stamp
   are paid for on every request and thrown away.

2. **A supplier's slug is a dead end.** The row carries `slug`
   (`supplier-intelligence.ts:33`) — the key that unlocks five further
   parent contracts — and nothing consumes it.

This slice adds the detail screen, the route, the open affordance, and one
new endpoint module that composes the partial contracts the parent exposes
today. It adds **no parent change**, and it is deliberately built to be
useful *before* the per-slug company profile API (see "Known limitations")
exists.

---

## Parent contracts (read from parent source today, 2026-08-16)

Every row below was opened and read in `F:/projects/tendersa` on 2026-08-16.
Where the brief handed to this spec was wrong, the correction is stated in
the Notes column and repeated as a finding in `INTEGRATION_EVAL.md`.

| Ref | Route | Auth | Envelope | Notes |
|---|---|---|---|---|
| **A** | `GET /api/tools/company-intelligence/search?mode=company` | **none** — fully public, `Cache-Control: public, s-maxage=3600` (`src/app/api/tools/company-intelligence/search/route.ts:103-106`) | `{data, meta}`, meta **snake_case**: `total, page, per_page, total_pages, mode, has_next, has_prev` (`search/route.ts:93-103`) | Item = `CompanyLeaderboardItem` (`src/lib/data-access/company-intelligence.ts:31-49`). Already consumed. Row `slug` = `generateCompanySlug(name)` (`company-intelligence.ts:434`). Unused filters: `org`, `sort` (`most_awards`\|`highest_value`\|`most_recent`), `enterprise_type`, `year_from/to`, `value_min/max`. |
| **B** | `GET /api/tools/forensic-analysis/search?mode=supplier` | `resolveForensicAccessForCurrentSession()` → `auth()` (`src/app/api/tools/forensic-analysis/search/route.ts:75`; `src/lib/forensic/forensic-access.ts:109-112`) — **Bearer-accepting**, see H11 | `{data, meta}`, meta **camelCase**: `total, page, perPage, totalPages, mode, hasNext, hasPrev, preview, postFiltered, access` (`search/route.ts:118-134`) | Item = `ForensicSearchRow` (`src/lib/data-access/forensic-search.ts:66-88`). Supplier mode is **not** 403-gated; buyer mode is (`search/route.ts:79-87`). Non-subscriber → `preview: true`, `FREE_PREVIEW_ROWS = 8`, page forced to 1 (`forensic-search.ts:120,183-199`). Supplier `slug` = `generateCompanySlug(name)` — the **same** generator as A (`forensic-search.ts:641`). |
| **C** | `GET /api/forensic/supplier/[slug]` | **none at all** — public, `revalidate = 21600`, CDN-cached 6 h (`src/app/api/forensic/supplier/[slug]/route.ts:8,62-66`) | bare keys: `supplierName, cipcData\|null, forensicRiskScore, forensicFlags[], flagCount, awardTimeline[]` (`route.ts:40-61`) | **Path corrected** — see H1. `cipcData` = `{registrationNumber, status, companyType, registrationDate, complianceScore, physicalAddress, directorCount}`. `awardTimeline` item = `{amount, awardDate, tenderTitle, department}` — **no tender id, no href**. |
| **D** | `GET /api/tools/forensic-analysis/entity-context?mode=supplier&name=…` | as B; additionally `assertForensicCapability(access, 'fullRows')` → **403** without an active subscription (`entity-context/route.ts:25-35`) | `{data: ForensicEntityContext, meta:{access}}` | `ForensicEntityContext` = `{mode, name, provinces[], categories[], competitive, intelligence, provinceHealth[], ocpo, restriction}` (`src/lib/data-access/forensic-entity-context.ts:24-34`). Accepts **`name` or `slug`**; `slug` is deslugified naively (`entity-context/route.ts:19-21,40-42`) — pass `name`. `restriction` = `SupplierRestrictionOverlay` (`src/lib/data-access/forensic-restricted-suppliers.ts:37-50`) and carries its own legally-cautious `label`. |
| **E** | `POST /api/tools/forensic-analysis/compare` | as B; `assertForensicCapability(access, 'compareEntities')` → 403 (`compare/route.ts:31-39`) | `{data, meta:{access}}` | Body `{entityType:'supplier'\|'buyer', entities: string[]}`, **2–5** entries, deduped and trimmed (`compare/route.ts:18-53`). **Cited, not consumed** — see "Explicitly out of scope". |
| **F** | `GET /api/v1/report-access/[slug]` | `auth()` — Bearer-accepting (`report-access/[slug]/route.ts:46`) | bare keys `{isPro, isPurchased, isClaimed, pendingForCurrentUser, hasApprovedClaimForCurrentUser}` | Anonymous, unresolvable slug **and internal error** all return the same all-false body with **HTTP 200** (`route.ts:47-55,98-101`). Resolves the slug with `findCompanyNameBySlug` (`route.ts:52`). |
| **G** | `GET /api/jv/contacts?target=<slug>` | `verifyJWTFromRequest` → 401; then `access.capabilities.contacts` → **403 `JV_SUBSCRIPTION_REQUIRED`** (`src/app/api/jv/contacts/route.ts:12-20`) | `{directors:[{fullName, email\|null}], contactEmail\|null}` | The **only** contact-details contract, matching brief §8.4 "Contact details". Returns an empty-but-200 body when the slug does not resolve (`route.ts:29-31`). Uses `findCompanyNameBySlug`. |
| **H** | `GET /api/public/featured-user-companies?limit=` | none (`src/app/api/public/featured-user-companies/route.ts`) | **bare JSON array**, no wrapper | `limit` clamped to 20, `revalidate = 3600`. Item = `{id, slug, displayName, shortDescription, logoUrl, websiteUrl, industriesServed[], provincesServed[], companyType, bbbeeLevel, certifications[]}` (`src/lib/services/showcase.service.ts:49-95`). `slug` is a `CompanyShowcaseProfile.slug`, a **different namespace** from the award slug — see H13. |

### Auth, settled

The brief handed to this spec warned of an "auth split" in which the forensic
and report-access routes would be cookie-only and therefore unreachable from
the desktop's Bearer JWT. **That is not the case.** `auth()`
(`src/lib/auth.ts:130-165`, read 2026-08-16) reads `Authorization: Bearer …`
**first** and only falls back to the `token` cookie. It verifies the same JWT
`verifyJWTFromRequest` verifies (`auth.ts:154,173-177`;
`src/lib/jwt-auth.ts`). The desktop sends exactly that header
(`src/services/api/endpoints/base.ts:43-46`).

So every route A–H is reachable from the desktop with its existing session,
and tier differences are genuine tier differences rather than an
authentication artefact. This is recorded as finding F11 because building on
the opposite assumption would have produced a screen that permanently
under-reports for paying subscribers.

### Contract hazards this slice must respect

- **H1 — the per-supplier forensic route is at `/api/forensic/supplier/[slug]`,
  not `/api/tools/forensic-analysis/supplier/[slug]`.** The latter does not
  exist; `src/app/api/tools/forensic-analysis/` contains only `access`,
  `compare`, `entity-context`, `export`, `memo`, `pair` and `search`. A client
  written against the wrong path gets a 404 that `kindForStatus`
  (`src/services/api/errors.ts:95-103`) maps to `not-found`, which reads as
  "this company could not be found" — a false statement about the company
  rather than a true one about the client.
- **H2 — contract C resolves its slug by `slug.replace(/-/g, ' ')`**
  (`src/app/api/forensic/supplier/[slug]/route.ts:15`) and then matches with
  `equals … mode: 'insensitive'` (`route.ts:25`). Slugs from A and B come from
  `generateCompanySlug` (`src/lib/utils/company-name.ts:111-115`), which runs
  `sanitizeCompanyName` — that **deletes** `()[]{}` and trims wrapper
  punctuation (`company-name.ts:7-14`) before hyphenating. `"ABC Trading (Pty)
  Ltd"` therefore becomes `abc-trading-pty-ltd`, which C turns back into
  `"abc trading pty ltd"` — a string that is **not** equal to the stored
  supplier name. Since `(Pty) Ltd` is the commonest South African legal form,
  C silently returns an empty record for a large share of real suppliers. It
  is the single biggest integration hazard in the slice.
  *(Correction to the brief: the loss is caused by lossy hyphenation of
  punctuation, not by legal-form-suffix stripping — `generateCompanySlug`
  does not strip legal forms; `normalizeCompanyName` does, and it is not the
  slug generator.)*
  Note that `findCompanyNameBySlug` (`company-intelligence.ts:258-300`)
  performs the **same** bracket-stripping in SQL and therefore round-trips
  correctly — which is why F and G resolve slugs that C cannot.
- **H3 — contract C truncates on a raw request header.** `isPro` is
  `req.headers.get('x-pro-access') === 'true'` (`route.ts:16`); nothing in the
  parent sets it. Without it, `forensicFlags` is sliced to 3 (`route.ts:53`)
  and `awardTimeline` to 10 (`route.ts:37`). The desktop **must not send that
  header**: it is a client-assertable access gate, and asserting it would be
  privilege escalation by header, not a feature. The truncation is therefore
  permanent for the desktop and must be disclosed in the UI.
- **H4 — A and B use different meta casings for the same concepts.** A sends
  `per_page`/`total_pages`/`has_next`; B sends `perPage`/`totalPages`/`hasNext`
  (`company-intelligence/search/route.ts:96-102` vs
  `forensic-analysis/search/route.ts:121-133`). A shared pagination reader
  would silently produce `undefined` on one of the two.
- **H5 — B's richest fields are tier-conditional and indistinguishable from
  "no data".** `intelligence`, `provinceHealth` and `competitive` are computed
  only when `access.capabilities.advancedFilters` is true
  (`forensic-search.ts:614-620,650-671,690-693`); otherwise they are `null`
  and `[]`. Only `meta.access` tells the two apart.
- **H6 — B's preview cap can hide a supplier entirely.** A non-subscriber gets
  `perPage: min(8, …)` and `page: 1` (`forensic-search.ts:183-199`,
  `search/route.ts:115`), so a supplier outside the top 8 of its own query is
  absent for tier reasons, not data reasons.
- **H7 — contract D's `slug` parameter is deslugified as naively as C's**
  (`entity-context/route.ts:19-21`). It also accepts `name`, which is exact.
  Always pass `name`.
- **H8 — contract C is anonymous and CDN-cached for six hours**
  (`route.ts:8,62-66`). Its answer is identical for every user, so nothing
  user-specific, entitlement-specific or freshness-sensitive may be inferred
  from it.
- **H9 — contract F answers 200 with all-false on failure.** `isPro: false`
  from F never means "this user is definitely not Pro"; it means "not
  established". It must never gate copy that asserts a negative.
- **H10 — contracts F and G answer 200 with an empty body when the slug does
  not resolve** (`report-access/[slug]/route.ts:52-55`;
  `jv/contacts/route.ts:29-31`). An empty `directors` array is not evidence
  that a company has no directors.
- **H11 — `auth()` accepts a Bearer token** (`src/lib/auth.ts:134-140`). See
  "Auth, settled" above. Recorded as a hazard because the *opposite*
  assumption was the working one when this slice was scoped.
- **H12 — contract A is public and cached for an hour**
  (`company-intelligence/search/route.ts:103-106`), so rank and totals may be
  up to an hour stale and are shared across all users.
- **H13 — contract H's slugs are a different namespace.** They are
  `CompanyShowcaseProfile.slug` values from user-registered showcase profiles
  (`showcase.service.ts:50-63`), not award-derived slugs. A slug collision
  between the two namespaces would attach one company's showcase entry to
  another company's award record.
- **H14 — there is no per-slug company profile JSON API.**
  `/tools/company-intelligence/[slug]` is a Next.js server component reading
  the database directly. See "Known limitations".

---

## Requirements

| # | Requirement | Verification |
|---|---|---|
| R-S1 | A `suppliers/:slug` route exists, mounted inside `AppLayout` beside the existing `suppliers` route, behind the same `ProtectedRoute`. Its wrapper reads `:slug` with `useParams` and redirects to `/suppliers` when absent, exactly as `TenderDetailRoute` does (`routes.tsx:59-84`). The screen itself takes `slug` as a prop and stays router-agnostic. | router test mounts `/suppliers/acme-civils` and asserts the profile heading, not the Command Centre heading |
| R-S2 | The Supplier Intelligence list gains an open affordance. `SupplierIntelligence` takes an optional `onOpenSupplier(slug)` and `CompanyRow` becomes activatable by mouse **and** keyboard; the route supplies `navigate("/suppliers/" + encodeURIComponent(slug))`, mirroring `TenderListRoute` (`routes.tsx:86-94`). Without the callback the row stays exactly as it is today — a list rendered by a test that does not pass it must not gain a dead control. | screen test: click opens with the row's slug; keyboard activation opens; no callback ⇒ no control in the accessibility tree |
| R-S3 | A **new** endpoint module `src/services/api/endpoints/supplier-profile.ts` exports `SupplierProfileEndpoint extends AuthenticatedEndpoint`, wired into `ApiClients` as `supplierProfile` by the three established edits in `src/app/auth-wiring.ts` (import, interface member, constructor entry). `supplier-intelligence.ts` gains **no** new methods and `company.ts` is not touched at all. | endpoint tests; `auth-wiring` test asserts the client is constructed; a repo test asserts `company.ts` is untouched by this slice's diff (reviewer check, see collision note) |
| R-S4 | Identity resolution is the **only** blocking read. `resolveSupplier(slug)` finds the canonical supplier name from contract A — the one contract that needs no session and is not tier-capped — by searching `q` = the de-hyphenated slug and selecting the row whose `slug` matches exactly. No match ⇒ `ApiError` of kind `not-found`. Every other read is independent and optional. | endpoint test: exact-slug selection, not first-row selection; a near-miss row is rejected; no match raises `not-found` |
| R-S5 | **A failure in one upstream must not blank the screen.** Each of contracts B, C, D, F, G and H is loaded by its own `useAsync` and rendered inside its own `AsyncSection`, so a 403, 404, 500 or schema mismatch renders that panel's error while every other panel still renders — the behaviour already pinned for `ApplicationWorkspace` at `src/tests/module-screens.test.tsx:1041-1056`. | screen test per upstream: force each one to throw in turn and assert the hero and the other panels remain visible |
| R-S6 | The screen presents the brief §8.4 vetting list in this order: hero identity and award totals; registration details; contact details; operating areas and categories; award history; known buyers; risk, restriction and compliance signals; data confidence; showcase listing. Each panel names the contract its figures came from. | screen test asserts panel order and headings against a full fixture |
| R-S7 | **Every field degrades to "Not recorded", never to a blank, a dash-less gap or a zero.** The house rule is already established at `SupplierIntelligence.tsx:190-194`, `src/features/company/CompanyProfile.tsx:1091-1093` and `src/features/command-centre/PulseTotals.tsx:10-12`: an absent count renders as "not recorded", never `0`, because "nothing was awarded" and "nobody counted" are different claims. | screen test with an all-null fixture asserts no `0` and no empty cell renders, and that every panel still has a heading |
| R-S8 | **Provenance is labelled on every derived figure** (brief §4.2). Each panel carries an eyebrow naming its source class — user-verified, public-source, award-derived, AI-inferred or unverified — per brief §9. The compiled description keeps the exact copy already shipped at `SupplierIntelligence.tsx:209-215` ("Automatically compiled … verify before relying on it") and gains its `lastEnrichedAt` date. | screen test asserts an eyebrow on every panel and the enrichment copy verbatim |
| R-S9 | **Tier degradation never reads as absence of data.** A 403 from D or G renders `describeApiError`'s `forbidden` copy ("Your plan does not include …", non-retryable, `describe-error.ts:52-58`) — never the empty state. When B answers `meta.preview === true`, the risk panel says the signals are limited by plan and **must not** say none were found. When B returns a row but `meta.access.capabilities.advancedFilters` is false, `intelligence`/`provinceHealth` render as "not available on your plan", not as "not recorded" (H5). | screen tests: 403 on D, 403 on G, `preview: true`, and `advancedFilters: false` each assert the tier copy and assert the absence copy is **not** present |
| R-S10 | **Risk and restriction signals are stated as signals, never as accusations** (brief §10: "Do not use award data to imply corruption or wrongdoing"; §8.4: no legal claims). The screen uses only the brief's prescribed vocabulary — "Strong evidence available", "Limited public data", "Potential inconsistency detected", "Requires manual verification", "Relevant award history found", "No related award history found" — plus a standing disclaimer on the risk panel. The four known flag types render as neutral factual restatements (see `design.md` §6.2); an unrecognised type renders its parent `description` verbatim under a neutral heading. `SupplierRestrictionOverlay.label` is rendered **verbatim** because the parent already wrote it to be legally cautious (`forensic-restricted-suppliers.ts:48-49`). | screen tests assert the exact strings, assert the disclaimer is present whenever any flag renders, and assert a banned-word list ("fraud", "corrupt", "illegal", "guilty", "blacklisted") appears nowhere in the rendered output |
| R-S11 | **The slug-match hazard (H2) is handled by verdict, not by hope.** When contract C returns a `supplierName` that does not match the resolved canonical name under the same punctuation-insensitive comparison the parent's own slug generator uses, the screen renders "Requires manual verification — we could not confidently match this company in the company register" and shows **no** register or timeline data from C. A wrong company's registration number is worse than none. | endpoint test: mismatched `supplierName` yields a `matched: false` record; screen test asserts the verification copy and asserts none of the mismatched fields render |
| R-S12 | The **list** rows render the enrichment fields already fetched and discarded: `website`, `headquartersAddress` and `lastEnrichedAt` alongside the existing `description` and `confidenceScore`. No additional request is made to do this. | screen test on `SupplierIntelligence`; endpoint test asserts request count is unchanged |
| R-S13 | The list **may** carry contract B's risk, B-BBEE, enterprise-type and OCPO signals, but **only** when `meta.preview === false`. Under preview the merge is skipped entirely and one line explains why — merging 8 enriched rows into a 20-row page would make the other 12 look data-poor for a reason that has nothing to do with the data (H6). | screen tests for both branches; endpoint test asserts no second request is issued when the first page is a preview |
| R-S14 | The desktop **never** sends `x-pro-access` (H3), and the award-history panel discloses its cap: "Showing the 10 most recent awards on record" whenever the timeline is at its cap, and the flag panel discloses that `flagCount` may exceed the flags shown. | endpoint test asserts the header is absent from the outgoing request; screen test asserts the disclosure |
| R-S15 | Contract H is used **only** to add a "Listed in the Tenders-SA company showcase" panel on an exact slug match, and the panel is absent when there is no match. Absence of a showcase entry is never rendered as a statement about the company (H13). | screen tests for match and no-match |
| R-S16 | No new Tauri capability and no widened `http` scope. Every route in A–H is under `https://www.tenders-sa.org/api/*`, already allowed by `src-tauri/capabilities/default.json`. | `src/tests/capability-scope.test.ts` passes unedited |
| R-S17 | No canonical parent record is written to local SQLite. Nothing on this screen is cached locally; per `desktop-company-profile-full-record/SPEC_CONTRACT.md:32` and the desktop role contract, local SQLite holds cache/offline-workspace state only, and a supplier's award record is canonical parent state. | reviewer check; no `workspace.queries.load` call in the new screen |

---

## Known limitations (documented, not fixed here)

The parent is read-only for this slice. The following are real gaps, stated
honestly rather than worked around.

### L1 — There is no per-slug company profile JSON API

`/tools/company-intelligence/[slug]` is a Next.js **server component** that
reads the database directly. No `/api/**` route serves an equivalent
document. A separate main-application spec is being written to add one. Until
it lands, the following brief §8.3/§8.4/§10 items have **no** contract behind
them and are absent from this screen:

| Missing | Brief ref | Panel that will fill in |
|---|---|---|
| Award history with tender deep links (tender reference, related tender, procurement category, contract duration, source) | §10 "Award record fields" | Award history — rows become links, and gain reference, category and duration |
| Bid history (tenders bid on but not won) | §8.4 "Relevant experience" | a new "Bid history" panel |
| Related / linked companies, duplicate indicators | §8.4 "Possible duplicate or linked-company indicators" | Risk and restriction signals |
| Full director network (names, IDs, other directorships) | §8.4 "Registration details" | Registration details — today only `directorCount` from C and `fullName`/`email` from G |
| Annual returns and filing history | §8.4 "Compliance data" | Registration details |
| Top procurement categories, top buyers, buyer concentration | §8.4 "Tender categories", "Known buyers" | Operating areas; Known buyers — today derived from at most 10 timeline rows |
| The full enrichment block (only 5 of its fields reach A) | §8.3 "Company profile summary" | Hero and Data confidence |
| CIDB grading and B-BBEE for an award-only supplier | §8.3 | Registration details — B carries `beeLevel`, but only for suppliers B returns |

Because of L1, this screen's award history is **the 10 most recent awards on
record**, not the full history, and its "known buyers" and "award frequency"
are derived from those 10 rows and are labelled as such (R-S8).

### L2 — Contract C's truncation cannot be lifted from the desktop

`x-pro-access` is a client-assertable header (H3). The desktop refuses to
send it, so `forensicFlags` is capped at 3 and `awardTimeline` at 10
regardless of the user's real plan. `flagCount` is still the true total and is
shown, so the user is told what they are not seeing.

### L3 — Contract C cannot resolve a large share of slugs

H2. The screen degrades to "Requires manual verification" rather than
rendering another company's registration details (R-S11). This resolves
itself only through a parent change to C's slug resolution or through L1's new
endpoint.

### L4 — Buyer Intelligence (brief §11) is entirely out of scope

Buyer names appear on this screen as text, not as links. There is no buyer
profile screen, and contract B's `mode=buyer` is Pro-tier gated
(`forensic-analysis/search/route.ts:79-87`). A buyer profile is its own slice.

### L5 — The four tender-relative scores of brief §8.4 are not generated

§8.4 asks for a capability score, relevance score, award-history score and
overall partner-fit score. All four are relative to **a specific tender's
gaps**, and this screen has no tender context — it is reached from a
directory, not from an application workspace. Producing a "partner-fit score"
with nothing to fit against would be exactly the unsupported judgement that
`SupplierIntelligence.tsx:21-26` already refuses to make. This slice
therefore renders only the two figures that are computable and
non-judgemental: the parent's own published `forensicRiskScore`, labelled as
the parent's, and a **data-confidence** summary of which sources answered.
The tender-relative scores belong to the JV/partner-gap slice (brief §8.2),
where a tender's gaps exist to score against.

---

## Explicitly out of scope

- **Any parent-repository change**, including fixing C's slug resolution,
  adding a per-slug profile API, or adding a tender id to C's award timeline.
- **Contract E (compare).** It needs 2–5 entities and a selection UI that does
  not exist; comparison is brief §8.5 (partner shortlist), a separate slice.
  It is documented here so the next slice does not re-audit it.
- **User-supplied private notes** (brief §8.4). Legitimately local-only state,
  but it is a write path with its own schema and belongs with the shortlist
  slice that also saves, compares and records contact attempts.
- **Saving, shortlisting, inviting or contacting a partner** (brief §8.5).
- **Buyer profiles** (brief §11) — see L4.
- **Making the "Buyer Intelligence" or "Award Intelligence" navigation items
  available.** They still have no screen; flipping them would be the
  dishonest affordance `navigation-items.ts:8-21` exists to prevent.
- Offline caching or local persistence of any figure on this screen (R-S17).
