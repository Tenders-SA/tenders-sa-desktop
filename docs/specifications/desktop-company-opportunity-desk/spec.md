# Desktop company opportunity desk

**Status:** Approved by user directive, 2026-08-12
**Type:** Scoped refinement of the existing Browse Tenders screen

## Problem

`TenderList` currently presents the full tender corpus as a generic list. In a
single-company desktop application, the first question is not “what exists?” but
“what is relevant to this company?” The authoritative company match scores
already exist in `RecommendationsEndpoint` and are already rendered by
`TenderRadar`; they must be reused rather than recalculated locally.

## User task

- **Audience:** the signed-in company and its bid team
- **Primary job:** identify the most suitable opportunities to prepare
- **Primary view:** company-matched tenders with explainable server scores
- **Secondary view:** the complete searchable tender corpus
- **Next action:** open a tender and decide whether to begin preparation

## Approach

- Reframe Browse Tenders as an `Opportunity desk` with two explicit views:
  `Matched for your company` and `All tenders`.
- Embed the existing Professional Tender Radar presentation in the matched view;
  do not create another matcher or score generic corpus rows.
- Restyle all-tender rows as procurement opportunity cards with organisation,
  reference, province, category, value, document count, and closing state.
- Do not fetch the all-tender corpus until the user opens that view.
- Preserve the standalone `/radar` route for deeper match filtering and
  recalculation.

## Impact map

| Surface | Change | Risk control |
|---|---|---|
| `TenderList.tsx` | Unified company opportunity desk and richer corpus cards | Existing endpoints and filters |
| `TenderRadar.tsx` | Embedded presentation mode | Same score endpoint and factor components |
| `routes.tsx` | Pass existing recommendations client | No route or auth contract change |
| Tender tests | View, score provenance, lazy corpus read | Pins no duplicate/local scoring |

No backend, matching logic, auth, entitlement, storage, Tauri capability, or
schema change. No new dependency.

## Acceptance

- A signed-in company lands on its matched opportunities first.
- Match scores and categories come only from `RecommendationsEndpoint`.
- Generic tenders are never presented with invented company scores.
- All-tender search and filters retain their current endpoint contract.
- The all-tender request is deferred until its view is selected.
- Keyboard-accessible tabs, loading, empty, error, pagination, and long-text
  behaviour remain usable.
- Focused tests, TypeScript, lint, and formatting pass.
