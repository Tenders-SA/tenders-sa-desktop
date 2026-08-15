# Desktop opportunity assessment queue

**Status:** Approved by user directive, 2026-08-15
**Type:** Scoped refinement of the existing Opportunities screen

## Problem

The `Opportunities` sidebar item is broken and misnamed.

1. **It does not load.** The screen defaults `openOnly` to `true`
   (`Opportunities.tsx:22`), which sends `activeOnly=true&futureOnly=true` to
   `GET /api/v1/user/saved-tenders`. The parent filters the Prisma enum
   `TenderStatus` against `['ACTIVE','active','OPEN','open']`
   (parent `src/app/api/v1/user/saved-tenders/route.ts:57`); only `ACTIVE` is a
   member, so Prisma throws at query construction and the route returns 500.
   Confirmed live: ticked renders "Could not load your saved tenders right
   now."; unticked loads 5 saved tenders.

2. **Its name promises something it is not.** Users read "Opportunities" as
   matched tenders. The screen renders the saved shortlist. `Opportunities.tsx:13`
   cites "brief §5", but §5 is only the navigation label list and defines no
   semantics — the shortlist behaviour was never specified.

## What already exists — do not rebuild

Per `AGENTS.md §0`, the following were located before any new surface was
considered. All four sections of brief §6.3 Opportunity Assessment are built:

| Brief §6.3 section | Existing implementation |
|---|---|
| Tender summary | `TenderDetail.tsx:280` header and snapshot list |
| AI requirement summary | `TenderAnalysisWorkbench` (`TenderDetail.tsx:295`) over `analysis-presentation.ts` |
| Internal readiness | `EligibilityPanel` (`TenderActions.tsx:44`) over `EligibilityEndpoint` |
| Buyer intelligence | `TenderIntelligenceOverview` (`TenderDetail.tsx:293`) |

Matched tenders (brief §6.2) are likewise built at `/radar` (`TenderRadar` over
`RecommendationsEndpoint`), the same endpoint the parent web app's
`/dashboard/matches` uses.

**Therefore this spec creates no assessment screen and no matched-tender list.**
A second copy of either would be a parallel implementation.

## Approach

Reframe `/opportunities` as the **queue into** the existing assessment: the
tenders the company has shortlisted, each linking to the tender detail screen
where the §6.3 assessment already lives.

- Correct the heading and description so the screen states what it holds.
- Correct the stale `brief §5` provenance comment.
- Default the open-only filter to **off** so the screen loads against the live
  parent defect, and keep the checkbox so the capability is preserved and the
  server bug stays reachable and visible rather than hidden.
- Row links to `/tenders/:id` are already correct (`Opportunities.tsx:102`) and
  do not change.

### Why not simply stop sending `activeOnly`

`prompts/saved-tenders-activeonly-500.md` §10 asks that the desktop keep sending
it, because removing it would conceal a live production defect. Defaulting the
checkbox to off honours that: the parameter is still sent whenever a user ticks
the box, so the 500 remains reproducible in one click, while the screen is
usable today. This is a mitigation with a one-line reversal, not a workaround
that deletes the feature.

## Dependency outside desktop scope

The 500 itself is a **parent** defect and cannot be fixed from this repository
(`AGENTS.md` desktop role contract, rules 2–4). It is fully diagnosed in
`prompts/saved-tenders-activeonly-500.md` (2026-08-11), including the one-line
fix and its regression test. That brief remains unimplemented; parent
`route.ts:57` is unchanged. Once it ships, the default here may be flipped back.

## Impact map

| Surface | Change | Risk control |
|---|---|---|
| `Opportunities.tsx` | Heading, description, provenance comment, filter default | No endpoint, query-shape or contract change |
| Tests | Pin the default and the preserved filter capability | Existing `module-screens` patterns |

No routing, navigation, endpoint, auth, entitlement, storage, Tauri capability
or schema change. No new dependency. No parent change.

## Acceptance

- Opening Opportunities renders the saved shortlist without an error.
- The open-only checkbox is present and unticked by default.
- Ticking it still sends `activeOnly`/`futureOnly` unchanged.
- The screen describes itself as the shortlist awaiting assessment and does not
  imply matched tenders.
- No new assessment or matched-tender surface is introduced.
- Focused tests, TypeScript, lint and formatting pass.
