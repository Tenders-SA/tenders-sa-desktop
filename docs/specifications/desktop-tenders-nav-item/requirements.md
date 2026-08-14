# Desktop — Tenders Listing — Requirements

> **Slice label**: `desktop-tenders-nav-item` (covers two coupled deliverables)
> **Type**: Scoped change (small–medium) — nav model + `TenderList` refactor + tests.

## Context

Two coupled asks about how the desktop surfaces tenders:

1. A persistent "Tenders" sidebar item (full listing), directly below "Tender Radar".
2. A `TenderList` refactor: drop the "Matched for your company" view and render the
   full listing with summaries (like the parent web listing at `/sa-tenders/tenders`).

## Parent reference — how `/sa-tenders/tenders` renders listings

The web listing is server-rendered and single-column:

- `src/app/sa-tenders/tenders/page.tsx` → `getTenders()` uses
  `prisma.tender.findMany({ select: TENDER_CARD_SELECT })` (one query, page `limit` 20).
- `TENDER_CARD_SELECT` (`src/lib/seo/tender-card.ts`) includes **`aiSummary`**,
  **`aiKeyRequirements`**, `description`, and `documentAnalyses` (with
  `submissionGuidelines`).
- `TenderListingCards` stacks full-width `TenderListingCard`s in `.space-y-5`.
- `TenderListingCard` renders: badge row (reference, type abbreviation RFQ/RFP/RFI/EOI,
  category, province, urgent) → title (`line-clamp-2`) → organisation (Building2 icon) →
  **snippet** → contact/delivery meta → timeline (closes date + days-remaining badge +
  briefing).
- The snippet (`resolveTenderSnippet`) rules, in order:
  1. `aiSummary` present → **"AI Summary"** (Sparkles) + **"Key Requirements"**
     (`documentAnalyses[0].submissionGuidelines` → `aiKeyRequirements` fallback).
  2. else `description` → plain description (`line-clamp-2`).
  3. else → nothing.

## Parent-contract finding (blocker for full parity)

The desktop list endpoint `GET /api/tenders` (`src/app/api/tenders/route.ts` lines
155–305) **returns `description` but does not return `aiSummary` or `aiKeyRequirements`**
— unlike the public SEO listing's `TENDER_CARD_SELECT`. The `Tender` model has
`aiSummary` (populated by `tender-ai-summary-cron.service.ts`), but the list route's
`select` and its `formattedTenders` mapping omit it (and select `aiTitleFixed` but never
return it).

**Consequence**: the desktop cannot render the web's "AI Summary + Key Requirements"
snippet from `GET /api/tenders` without a **parent** change. Desktop work is scoped to
`desktop/tenders-sa-desktop/**`, so the parent endpoint change is documented as a
**required dependency**, not performed here.

## Requirements

### Part A — Navigation item

- **R-T1 — Menu item.** Add a primary-navigation item **"Tenders"** (icon `List`,
  path `/tenders`, `available: true`) directly below "Tender Radar" in the Workflow
  group.
- **R-T2 — Destination.** Reuse the existing `/tenders` route and `TenderList`; no new
  route, screen, or endpoint.
- **R-T3 — Availability.** `available: true` with a real `path` (REQ-16).

### Part B — `TenderList` refactor

- **R-T4 — Remove the "Matched for your company" view.** Delete the
  `Matched`/`All` tab strip, the embedded `TenderRadar` panel, and the `TenderView`
  state. `/tenders` always renders the full listing. Tender Radar remains at `/radar`.
- **R-T5 — Entire listing.** `/tenders` shows the whole tender corpus (paginated,
  `limit: 20`), defaulting with no pre-filter. No company-scored subset.
- **R-T6 — Summaries on every row.** Each listing row shows a snippet below the
  organisation line, following the web's `resolveTenderSnippet` precedence:
  `aiSummary` (+ Key Requirements) → `description` → none. Descriptions must not be
  zero-height: render the `description` body when it is present, in addition to the
  existing metadata (ref, category, document count, closing date, estimated value).
- **R-T7 — AI Summary source.** Fully matching the web's AI Summary requires the parent
  `GET /api/tenders` to expose `aiSummary`/`aiKeyRequirements`. Until that parent change
  lands, the desktop renders the best field the contract exposes (`description`) and the
  card is structured so the AI Summary slot simply fills in when the fields arrive. This
  limitation is recorded in `INTEGRATION_EVAL.md`.
- **R-T8 — Keep the rest of the row.** Preserve the existing title, publication type,
  province, source organisation, reference, category, document count, closing date and
  estimated value. Replace the shallow single-line org row with the richer snippet.

## Out of scope

- Parent `GET /api/tenders` endpoint change (documented as a dependency, parent-owned).
- Changes to `TenderDetail`, `TenderRadar` at `/radar`, Command Centre "Browse all
  tenders" link, or the tender-document-download flow.
- Web parity for badges/timeline colours and the briefing row — desktop keeps its own
  visual system (Tailwind theme) and only adopts the snippet *content* precedence.

## Acceptance criteria

1. Sidebar shows "Tenders" below "Tender Radar", enabled, with an icon; `/tenders` loads.
2. `/tenders` has no "Matched for your company" tab and no embedded radar; it always
   lists the full corpus with pagination.
3. Each row renders a summary/description snippet (AI Summary slot ready; `description`
   shown now) alongside existing metadata.
4. `navigation-reachability.test.tsx` sweeps the new nav item; `tender-filters.test.tsx`
   and any list tests reflect the removed tab.
5. Gates green: full `vitest`, `npx tsc --noEmit`, `eslint .`, `prettier --check .`.
