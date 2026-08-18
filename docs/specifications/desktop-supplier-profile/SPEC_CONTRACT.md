# Desktop — Supplier Profile — SPEC_CONTRACT (Slice 12)

- **Status**: `APPROVED`
- **Date**: 2026-08-16
- **Scope**: Slice 12 — a supplier profile detail screen reachable from
  Supplier Intelligence, composed from existing parent contracts A–H
  (R-S1..R-S17).
- **Approved by**: user (in-session directive)
- **Approval date**: 2026-08-16

## Contract checklist (mirrors tasks.md)

| # | Item | Contract |
|---|---|---|
| C1 | Identity resolution | `resolveSupplier(slug)` reads contract A and selects the row whose `slug` **equals** the target — never the first row; no match raises `ApiError` kind `not-found`; `slugComparableName()` replicates `sanitizeCompanyName` + lower-case and is pinned by unit test |
| C2 | Six read methods, hazards encoded | `getForensicRow` reads B's **camelCase** meta with `preview` and `access`; `getPublicRecord` calls **`/api/forensic/supplier/[slug]`** (H1), computes `matched` and **empties** `cipcData`, `awardTimeline`, `forensicFlags` and `forensicRiskScore` on mismatch, and exposes `timelineAtCap`/`flagsAtCap`; `getEntityContext` sends **`name=`**, never `slug=`; `getReportAccess` exposes `established` and never asserts a negative; `getContacts` and `getShowcaseEntry` treat an empty 200 as unresolved, not as absence. **No request ever carries `x-pro-access`.** No shared pagination reader between A and B |
| C3 | Wiring, three edits only | `supplierProfile` added to `ApiClients` by import + interface member + constructor entry in `auth-wiring.ts`; one line added to `src/tests/fixtures/api-clients.ts`; `supplier-intelligence.ts` gains no method; `src/services/api/endpoints/company.ts` is **not edited**; `endpoint-parity.test.ts` and `capability-scope.test.ts` pass unedited |
| C4 | Route and affordance | `suppliers/:slug` mounted inside `AppLayout` with a `SupplierProfileRoute` wrapper following `TenderDetailRoute`; missing slug redirects to `/suppliers`; the list's open control is focusable, keyboard-activatable, and **absent** when no `onOpenSupplier` is supplied; `navigation-items.ts` unedited and `navigation-reachability.test.tsx` green |
| C5 | Pinned copy | every string of `design.md` §6 lives in `supplier-profile-copy.ts`; a test asserts "fraud", "corrupt", "illegal", "guilty" and "blacklisted" appear nowhere; the parent's `SupplierRestrictionOverlay.label` is rendered verbatim |
| C6 | Screen composition | hero + eight panels in the order of `design.md` §5, each in its own `AsyncSection` with its own subject and provenance eyebrow; every field degrades to "Not recorded", never a blank or a `0`; a panel with no data still renders heading, eyebrow and "Not recorded" |
| C7 | Partial-failure isolation | each of B, C, D, F, G, H can fail alone; that panel renders `role="alert"` and every other panel and the hero still render — the behaviour already pinned at `src/tests/module-screens.test.tsx:1041-1056` |
| C8 | Tier degradation | 403 from D or G, B's `preview: true`, B's `advancedFilters: false`, and C's `matched: false` each render plan/verification copy and **never** the empty state; a `forbidden` error offers no "Try again" |
| C9 | List enrichment | `website`, `headquartersAddress` and `lastEnrichedAt` render from the payload already fetched, with **no** additional request; the optional contract-B overlay merges by slug **only** when `meta.preview === false`, and under preview is replaced by one explanatory line rather than per-row blanks |
| C10 | Verification gates | full `pnpm exec vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx prettier --check .` — zero errors |
| C11 | Human verification | user confirms against a real account: profile opens from the list; registration details render or state "Requires manual verification"; award history discloses its cap; risk signals carry the disclaimer; a 403 panel names the plan and not an absence of data; list rows show the enrichment fields; a "(Pty) Ltd" supplier is checked specifically against H2. Recorded in `INTEGRATION_EVAL.md` |

## Collision note — files held by the in-flight company-profile slice

`desktop-company-profile-full-record` (Slice 11) has **uncommitted** changes
in this working tree as of 2026-08-16:

```
 M src/features/company/CompanyProfile.tsx
 M src/services/api/endpoints/company.ts          (~669 lines in flight)
 M src/tests/fixtures/api-clients.ts
 M src/tests/module-endpoints.test.ts
 M src/tests/module-screens.test.tsx
```

This slice therefore:

- **does not touch** `company.ts`, `module-endpoints.test.ts` or
  `module-screens.test.tsx` at all;
- puts **all** new endpoint and screen tests in a new file,
  `src/tests/supplier-profile.test.tsx`;
- makes the single unavoidable edit to `src/tests/fixtures/api-clients.ts` —
  one `supplierProfile` entry, required for `AppRoutes` to mount — and keeps
  it to one line so the merge is trivial.

## Explicitly out of contract

Parent-repository changes of any kind, including fixing contract C's slug
resolution (H2), adding a per-slug company profile JSON API (L1), or adding a
tender id to C's award timeline. Contract E (compare) — cited, not consumed.
User-supplied private notes, partner shortlisting, saving, inviting and
contact-attempt records (brief §8.5). Buyer profiles (brief §11, L4). The four
tender-relative scores of brief §8.4 (L5). External link opening. Any local
SQLite persistence of the figures on this screen. Marking "Buyer Intelligence"
or "Award Intelligence" available in the navigation.

## Known limitations carried forward

- **L1** — no per-slug company profile JSON API exists;
  `/tools/company-intelligence/[slug]` is a server component reading the
  database directly. Award history with tender deep links, bid history,
  related companies, the full director network, annual returns, top categories,
  top buyers and the full enrichment block have no API equivalent. A separate
  main-application spec is being written to add one; `requirements.md` L1
  names the panel each item will fill in.
- **L2** — contract C truncates flags to 3 and the timeline to 10 for any
  caller that does not assert `x-pro-access`. The desktop refuses to assert
  it, so the cap is permanent and is disclosed in the UI.
- **L3** — contract C cannot resolve slugs whose source names contain
  punctuation, which includes most "(Pty) Ltd" names. The screen degrades to
  "Requires manual verification".
- **L4** — Buyer Intelligence (brief §11) is a separate slice; buyer names are
  text, not links.
- **L5** — the capability, relevance, award-history and overall partner-fit
  scores of brief §8.4 need a tender's gaps to score against and belong to the
  JV/partner-gap slice.

## Non-negotiable constraints

- **Never send `x-pro-access`.** It is a client-assertable access gate on
  contract C (`src/app/api/forensic/supplier/[slug]/route.ts:16`); asserting it
  is privilege escalation by header, not a feature.
- **Never render contract C's data when `matched` is false.** A wrong
  company's registration number is worse than no registration number.
- **Never present a 403, a preview cap or a tier-gated null as "no data".**
- **Never imply wrongdoing.** Brief §10 forbids it and §8.4 prescribes the
  vocabulary; the copy module is the enforcement point.
- The parent backend stays the source of truth; no second store, no local
  SQLite copy of any figure on this screen.
- No parent-repository change; the parent is read-only for this slice.
- No new Tauri capability; no `shell:`, no `opener:`, no widened http scope.
- No `npm run build` / `next build` / prisma migrations (repo rule).
