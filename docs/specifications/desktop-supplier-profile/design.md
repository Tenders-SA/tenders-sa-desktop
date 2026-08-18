# Desktop — Supplier Profile — Design (Slice 12)

> Read `requirements.md` first. Hazard references (H1–H14), requirement
> references (R-S1–R-S17) and limitation references (L1–L5) are defined there.

## 1. Shape of the change

One screen, one route, one endpoint module, one list change. Nothing existing
is replaced.

1. `SupplierProfileEndpoint` — **new** class in a **new** file, composing six
   partial parent contracts into six independently-loadable parts.
2. `SupplierProfile` — **new** screen, built from the components the tender
   detail screen already established.
3. `suppliers/:slug` — **new** route with a `SupplierProfileRoute` wrapper.
4. `SupplierIntelligence` — gains an open affordance and renders the
   enrichment fields it already fetches.

## 2. Why a new endpoint class rather than extending `SupplierIntelligenceEndpoint`

`SupplierIntelligenceEndpoint` is one method over one route with one envelope
(`supplier-intelligence.ts:90-121`). The profile composes **six** routes
across **three** envelope conventions (snake_case meta, camelCase meta, bare
keys), **two** access models (public-anonymous and subscriber-gated) and a
bare JSON array. Folding those into the list client would mean:

- every screen holding a list client — and every `stubApiClients` entry —
  carries six profile methods it never calls;
- the list's tightly-scoped doc comment about "a third envelope"
  (`supplier-intelligence.ts:15-20`) becomes untrue of its own file;
- a schema change in the forensic contract would touch the file the list
  screen depends on, for no reason.

A separate class also keeps the wiring change to the three established edits
in `auth-wiring.ts` — import (`:33`-style), `ApiClients` member (`:75-91`),
constructor entry (`:163-178`) — which is the pattern every other endpoint
follows.

`supplier-profile.ts` **imports** `IntelligenceCompany` and `formatAwardValue`
from `supplier-intelligence.ts`. That is a type and a pure formatter, not a
second copy of the contract.

## 3. Read path — one blocking resolution, then six independent loads

### 3.1 Why identity resolution must come first, and from contract A

The route parameter is a slug. Contracts B, C, D, F and G each need either the
canonical **name** or a slug they can resolve themselves, and they disagree
about which:

| Contract | Takes | Resolver | Safe? |
|---|---|---|---|
| B | `q` (free text) | own SQL aggregate; returns `slug` from `generateCompanySlug` | yes — match on the returned `slug` |
| C | `slug` path segment | `slug.replace(/-/g,' ')` (`route.ts:15`) | **no** (H2) |
| D | `name` **or** `slug` | exact name, or the same naive deslugify | yes **with `name`** (H7) |
| F | `slug` | `findCompanyNameBySlug` (`report-access/[slug]/route.ts:52`) | yes |
| G | `slug` | `findCompanyNameBySlug` (`jv/contacts/route.ts:28`) | yes |

So the canonical **name** is the key that unlocks the safe path, and only
contract A can be relied on to produce it: A is unauthenticated
(`company-intelligence/search/route.ts` has no auth call at all), uncapped by
tier, and its `slug` is produced by the very generator the route parameter
came from (`company-intelligence.ts:434`).

```ts
async resolveSupplier(slug: string, signal?: AbortSignal): Promise<SupplierIdentity>
```

It issues one A request with `q` = the slug with hyphens replaced by spaces
and `per_page: 50`, then selects the row whose `slug` **equals** the target.
Selecting the first row instead would be the classic wrong answer: a search
for `abc-trading` returns `ABC Trading Holdings` first when it has more award
value. No exact match ⇒ `ApiError` of kind `not-found`, which
`describeApiError` renders as "This supplier could not be found."
(`describe-error.ts:66-72`) — true, actionable, and not a crash.

`SupplierIdentity` carries the full `IntelligenceCompany` row, so the hero and
the list-derived tiles need no second request.

### 3.2 The six independent loads

Everything after resolution is optional. Each is a separate method and a
separate `useAsync` in the screen:

| Method | Contract | Keyed on | Fails how |
|---|---|---|---|
| `getForensicRow(name, slug)` | B | name | one panel |
| `getPublicRecord(slug, expectedName)` | C | slug | one panel |
| `getEntityContext(name)` | D | name | one panel, 403 expected |
| `getReportAccess(slug)` | F | slug | one panel, never 4xx |
| `getContacts(slug)` | G | slug | one panel, 401/403 expected |
| `getShowcaseEntry(slug)` | H | slug | panel absent |

**Why six `useAsync` calls rather than one composed `Promise.allSettled`.**
The screen must show *something* the instant A resolves, and the six upstreams
have wildly different latencies (C is CDN-cached and instant; D runs several
aggregate queries). A single settled composite would hold the whole screen at
the slowest one and would put the "which part failed" branching inside the
endpoint rather than in `AsyncSection`, which already renders exactly the four
states with `role="status"` / `role="alert"` and a `data-error-kind` attribute
(`AsyncSection.tsx:40-64`). Six loads is also literally the pattern the
existing partial-failure test pins for `ApplicationWorkspace`
(`module-screens.test.tsx:1041-1056`), so the behaviour R-S5 requires is the
behaviour the repo already proves. (R-S5)

## 4. Schemas

### 4.1 Two meta casings, deliberately not shared (H4)

```ts
// Contract A — already in supplier-intelligence.ts, reused as-is.
meta: { total, page, per_page, total_pages, mode?, has_next, has_prev }

// Contract B — this file.
const forensicMetaSchema = z.object({
  total: z.number(),
  page: z.number(),
  perPage: z.number(),
  totalPages: z.number(),
  mode: z.string(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
  preview: z.boolean(),
  postFiltered: z.boolean().optional(),
  access: forensicAccessSchema,
});
```

No shared pagination reader. The two are named for the two routes, and the
comment says why — the same discipline `base.ts:49-61` already applies to the
parent's two pagination helpers.

`forensicAccessSchema` is `{isSubscriber, isAdmin, planTier, capabilities}`
with `capabilities` as `z.record(z.boolean())` — the list at
`forensic-access.ts:4-16` is the parent's and may grow, and a growing list
must not fail the parse. The two capabilities this slice reads by name are
`fullRows` and `advancedFilters`.

### 4.2 Tolerant, passthrough, and never guessed

Every schema is `.passthrough()`, matching `companySchema`
(`supplier-intelligence.ts:56`). `intelligence`, `competitive`,
`provinceHealth` and `restriction` are parsed loosely (`z.unknown()` narrowed
at the display boundary) because they are composed objects the parent may
extend and because the desktop displays only a named subset. `restriction`'s
`label` and `state` are named, because the screen renders them literally.

### 4.3 Contract C's slug verdict (R-S11, H2)

`getPublicRecord` takes the resolved canonical name and returns:

```ts
interface SupplierPublicRecord {
  matched: boolean;
  supplierName: string;
  cipcData: CipcData | null;
  forensicRiskScore: number | null;
  forensicFlags: ForensicFlag[];
  flagCount: number;
  awardTimeline: AwardTimelineRow[];
  timelineAtCap: boolean;   // awardTimeline.length === 10 (H3)
  flagsAtCap: boolean;      // flagCount > forensicFlags.length
}
```

`matched` compares the response's `supplierName` to the resolved name using
the **same normalisation the slug generator applies**: strip `()[]{}`, collapse
whitespace, trim wrapper punctuation, lower-case. That is
`sanitizeCompanyName` reimplemented in the desktop as `slugComparableName()` —
reimplemented rather than imported because the desktop cannot import parent
`src/lib`, and pinned by a unit test using the exact examples in
`company-name.ts:5-6`.

When `matched` is false the endpoint returns the record with `matched: false`
and **empties** `cipcData`, `awardTimeline` and `forensicFlags` before
returning. Emptying in the endpoint rather than trusting each panel to check
the flag means no future panel can accidentally render the wrong company's
registration number. `flagCount` and `forensicRiskScore` are dropped too — a
score computed for a different name is not this company's score.

### 4.4 Contract F is not allowed to assert a negative (H9)

`getReportAccess` returns `{ established: boolean } & flags`. `established`
is false when every flag is false, because that is exactly the body the route
returns for an anonymous user, an unresolvable slug **and** an internal error
(`report-access/[slug]/route.ts:47-55,98-101`). The screen only ever renders
positives from F ("You have Pro access to this report", "This profile has been
claimed by its owner"); it never renders "not claimed".

## 5. Screen composition

`SupplierProfile` follows `TenderDetail`'s established shape: a hero header
with `<dl>` stat tiles (`TenderDetail.tsx:56-77`), then stacked section cards
(`Panel` from `AsyncSection.tsx:85-95`), each with a provenance eyebrow in the
style of `TenderIntelligenceOverview.tsx:29-43`, and `role="alert"` errors
supplied by `AsyncSection`.

| # | Panel | Source | Brief §8.4 item |
|---|---|---|---|
| 0 | **Hero** — name, back link, `<dl>` tiles: total awards, total value (`formatAwardValue`), provinces, rank, last active year | A (already in hand) | Company profile |
| 1 | **Registration details** — registration number, register status, company type, registration date, compliance score, physical address, director count | C | Registration details |
| 2 | **Contact details** — directors (name, email), contact email | G | Contact details |
| 3 | **Operating areas and categories** — provinces, categories, province health where present | D, falling back to A's `provinces` | Operating areas, Tender categories |
| 4 | **Award history** — the recorded award timeline: date, amount, tender title, buyer | C | Award history, Contract values |
| 5 | **Known buyers and award frequency** — buyer counts and awards-per-year, both derived from panel 4 | derived from C | Known buyers, Frequency of awards |
| 6 | **Risk, restriction and compliance signals** — published risk score, flags, OCPO restricted-supplier overlay, public reporting summary | B + D | Restricted supplier status, Compliance data, Duplicate/linked indicators (partial, L1) |
| 7 | **Data confidence** — which sources answered, enrichment confidence and date, slug-match verdict | A + all of the above | Data confidence |
| 8 | **Showcase listing** — only on an exact H match | H | Existing public-sector relationships (partial) |

Panels 1–8 each sit in their own `AsyncSection` with their own `subject`
string, so `describeApiError` produces panel-specific copy: "registration
details", "partner contact details", "operating areas", "the award history",
"risk and restriction signals", "the company showcase listing".

Panel 0 is **not** in an `AsyncSection` — it renders from the resolved
identity, which is the blocking read (§3.1). If that fails, the whole screen
is an error, correctly.

### 5.1 The "Not recorded" rule (R-S7)

`notRecorded()` is lifted verbatim from `CompanyProfile.tsx:1091-1093` into
`src/features/intelligence/supplier-profile-fields.tsx` and used for **every**
field on this screen. `PulseTotals.tsx:10-12` states the reason and it applies
unchanged here: an award count the payload omits renders "Not recorded", never
`0`, because "no awards were recorded" and "nobody counted" are different
claims and only one of them is a number.

A **panel** with no data still renders its heading and its provenance eyebrow
with a single "Not recorded" body. It is never omitted — a missing panel would
be indistinguishable from a panel that does not exist, and the reader would
not know a question had been asked.

## 6. Copy

The copy is part of the contract, not an implementation detail: brief §10
forbids implying wrongdoing and §8.4 prescribes the vocabulary. It is
specified here so it is reviewable and so `supplier-profile-copy.ts` can be
a single pinned module.

### 6.1 Verdict vocabulary (brief §8.4)

| Condition | Copy |
|---|---|
| C matched, `cipcData` present, enrichment confidence ≥ 0.7 | **Strong evidence available** |
| C matched, `cipcData` present, no confidence or < 0.7 | **Relevant award history found** (when the timeline is non-empty) |
| C matched, `cipcData` null | **Limited public data** |
| C returned but `matched === false` (H2) | **Requires manual verification** — "We could not confidently match this company in the company register. Nothing from the register is shown for that reason." |
| `awardTimeline` empty and `totalAwards > 0` | **Limited public data** — "This company has recorded awards, but no award detail is available here." |
| `awardTimeline` empty and `totalAwards === 0` | **No related award history found** |
| any flag present | **Potential inconsistency detected** — always followed by "Requires manual verification." |

### 6.2 Flag copy (R-S10)

The parent's four flag types (`src/lib/cipc/forensics.ts:311,320,331,342`)
render as neutral restatements of the underlying fact. The parent's
`description` is shown beneath, verbatim, as the source's own words.

| `flag.type` | Rendered heading |
|---|---|
| `DEREGISTERED_ENTITY` | Company register shows a status other than active |
| `POOR_COMPLIANCE` | Register compliance score is below the platform's threshold |
| `NEW_ENTRANT_LARGE_AWARD` | A large award is recorded soon after registration |
| `DISQUALIFIED_DIRECTOR` | A director record matches a disqualification list |
| anything else | the type, humanised, with `description` verbatim beneath |

Severity renders as **"Signal strength: Low / Moderate / High / Highest"**,
never as a colour-only badge and never as a word that reads as a verdict.

**Standing disclaimer**, rendered whenever panel 6 shows any flag, score or
restriction:

> These are data signals drawn from public procurement and company-register
> records. They are not findings of wrongdoing, and they do not indicate that
> any law has been broken. Verify independently before acting on them.

`SupplierRestrictionOverlay.label` is rendered **verbatim**
(`forensic-restricted-suppliers.ts:48-49` — "Human-readable, legally cautious
label for the resolved state"). Rewriting it would be re-doing legal wording
the parent already got right. When `confidence === 'possible'` the screen
appends "Possible name match only — requires manual verification."

### 6.3 Tier copy (R-S9)

Never "no data". Always plan language, and always non-retryable so
`AsyncSection` does not offer a dishonest "Try again"
(`AsyncSection.tsx:53-61`, `describe-error.ts:19-21`).

| Condition | Copy |
|---|---|
| 403 from D | `describeApiError` → "Your plan does not include restricted-supplier and market context." |
| 403 from G (`JV_SUBSCRIPTION_REQUIRED`) | `describeApiError` → "Your plan does not include partner contact details." |
| 401 anywhere | `describeApiError` → "Sign in to Tenders-SA to see …" |
| B `meta.preview === true`, row absent | "Risk signals are limited to a preview on your plan, and this company is outside it. This is a plan limit, not an absence of records." |
| B `meta.preview === false`, row absent | "Not recorded in the forensic workbench." |
| B row present, `capabilities.advancedFilters === false` | "Market and province context is not available on your plan." (H5) |

### 6.4 Cap disclosure (R-S14, H3, L2)

- Award history footer when `timelineAtCap`: "Showing the 10 most recent
  awards on record. The desktop cannot request more."
- Flag footer when `flagsAtCap`: "{flagCount} signals are recorded; the first
  {n} are shown."

### 6.5 Provenance eyebrows (R-S8, brief §4.2 and §9)

| Panel | Eyebrow |
|---|---|
| Hero | Award-derived · public procurement records |
| Registration details | Public-source · company register, matched by name |
| Contact details | Public-source · company register and platform enrichment |
| Operating areas | Award-derived · from recorded awards |
| Award history | Award-derived · public procurement records |
| Known buyers | Derived · computed from the awards listed above |
| Risk and restriction | Public-source · Tenders-SA forensic workbench and OCPO records |
| Data confidence | Derived · about this page, not about the company |
| Showcase listing | User-supplied · submitted by the company |

The compiled-description block keeps the exact wording already shipped at
`SupplierIntelligence.tsx:209-215` and gains "last compiled {date}" from
`lastEnrichedAt` (R-S8, R-S12).

## 7. The list changes

### 7.1 Open affordance (R-S2)

`SupplierIntelligence` gains `onOpenSupplier?: (slug: string) => void`.
`CompanyRow` renders its name as a `<button type="button">` inside the
existing `<h3>` when the callback is present, and as plain text when it is
not. A button rather than a whole-row click handler: it is focusable and
announced without any `role`/`tabIndex`/`onKeyDown` hand-rolling, which is
the accessible default and matches how `TenderList` already opens a tender
(`routes.tsx:86-94`).

Without the callback nothing focusable is added, so the existing tests in
`src/tests/supplier-intelligence.test.tsx` — which render the screen with only
`endpoint` — keep passing unedited.

### 7.2 Enrichment already paid for (R-S12)

`website`, `headquartersAddress` and `lastEnrichedAt` join `description` and
`confidenceScore` in the existing provenance block
(`SupplierIntelligence.tsx:198-217`). Zero new requests: the fields are
already in the parsed payload (`supplier-intelligence.ts:41-54`,
`company-intelligence.ts:42-48`).

`website` renders as **text**, not as a link. Opening an external URL needs a
Tauri `opener:`/`shell:` permission the capability deliberately does not grant
(`src-tauri/capabilities/default.json` — "No shell, URL-opening, path-opening
… access is granted"), and R-S16 forbids widening it.

### 7.3 Optional forensic overlay (R-S13)

After the A page resolves, the list issues **one** B request for the same `q`
and `province` and merges by `slug`, adding B-BBEE level, enterprise type,
OCPO status and the published risk score to matching rows.

The merge is **skipped entirely** when the B response has
`meta.preview === true`. Under preview B returns at most 8 rows forced to
page 1 (H6), so on a 20-row page it would enrich a handful and leave the rest
bare — an asymmetry that reads as "these companies have no risk data" when
the real cause is the plan. One line replaces it: "Risk and restricted-supplier
signals need an active subscription." That is the same choice R-S9 makes on
the detail screen, applied to the list.

## 8. Route and wiring

```tsx
function SupplierProfileRoute({ clients }: { clients: ApiClients }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  if (!slug) return <Navigate to="/suppliers" replace />;
  return (
    <SupplierProfile
      endpoint={clients.supplierProfile}
      slug={slug}
      onBack={() => navigate("/suppliers")}
    />
  );
}
```

Mounted as `path="suppliers/:slug"` immediately after `path="suppliers"`
inside the `AppLayout` route (`routes.tsx:262-267`). React Router ranks the
static segment above the dynamic one, so `/suppliers` is unaffected.

`SupplierIntelligence`'s route element becomes a `SupplierListRoute` wrapper
passing `onOpenSupplier`, mirroring `TenderListRoute` (`routes.tsx:86-94`).

`navigation-items.ts` is **not** edited. "Supplier Intelligence" is already
`available: true` with `path: "/suppliers"` (`navigation-items.ts:109-114`),
and the detail screen is reached from the list, not from the sidebar. Adding a
nav entry for a screen that needs a slug would be an advertised destination
with no destination — precisely what `navigation-reachability.test.tsx` exists
to catch.

## 9. Files

| File | Change |
|---|---|
| `src/services/api/endpoints/supplier-profile.ts` | **new** — `SupplierProfileEndpoint`, six schemas, `resolveSupplier`, `slugComparableName` |
| `src/features/intelligence/SupplierProfile.tsx` | **new** — the screen |
| `src/features/intelligence/supplier-profile-copy.ts` | **new** — every string in §6, pinned by test |
| `src/features/intelligence/supplier-profile-fields.tsx` | **new** — `notRecorded`, stat tile, provenance eyebrow, money/date formatting |
| `src/features/intelligence/supplier-profile-model.ts` | **new** — pure derivations (buyer counts, awards per year, confidence verdict); separate from the `.tsx` files so those export components only, per `react-refresh/only-export-components` |
| `src/features/intelligence/SupplierIntelligence.tsx` | `onOpenSupplier`, enrichment fields, optional forensic overlay |
| `src/app/router/routes.tsx` | `SupplierProfileRoute`, `SupplierListRoute`, two route entries |
| `src/app/auth-wiring.ts` | the three established edits |
| `src/tests/supplier-profile.test.tsx` | **new** — all endpoint and screen tests for this slice (see collision note in `SPEC_CONTRACT.md`) |
| `src/tests/supplier-intelligence.test.tsx` | list-only additions; existing assertions unedited |

`src/services/api/endpoints/company.ts` is **not touched** — it carries ~669
uncommitted lines from the in-flight company-profile slice.
`src/tests/fixtures/api-clients.ts` gains exactly one line
(`supplierProfile: { … }`), which is the minimum needed for `AppRoutes` to
mount and is the only edit this slice makes to a file the other slice holds.

## 10. What this design refuses to do

- **No `x-pro-access` header** (H3). It is a client-assertable access gate;
  sending it is privilege escalation, not a feature. The truncation is
  disclosed instead (R-S14).
- **No parent change**, including the obvious one-line fix to C's slug
  resolution. Read-only means read-only; L3 records the cost.
- **No second data store.** Nothing on this screen touches local SQLite. A
  supplier's award record is canonical parent state, and
  `desktop-company-profile-full-record/SPEC_CONTRACT.md:32` already settled
  that canonical parent records are not cached locally (R-S17).
- **No partner-fit score** (L5). Scoring a company with no tender to score it
  against would be a judgement the data does not support — the same reasoning
  `SupplierIntelligence.tsx:21-26` already applies to the leaderboard.
- **No external links.** `website` is text; opening it needs a capability the
  app does not grant (R-S16, §7.2).
- **No shared pagination reader** across A and B (H4).
- **No new Tauri capability and no widened http scope** (R-S16).
