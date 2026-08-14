# Desktop — Tenders Listing — Design

## Summary

Two changes sharing one surface (`/tenders`):

1. A sidebar "Tenders" item (nav model only).
2. A `TenderList` refactor that removes the matched view and renders the full listing
   with a summary snippet on each row, mirroring the parent web card's snippet content.

## Part A — Navigation item

Same design as before: insert one `NavigationItem` in the Workflow group of
`src/components/navigation/navigation-items.ts`:

```
Command Centre      → /
Tender Radar        → /radar
Tenders             → /tenders     ← NEW, available, icon: List
Opportunities       → /opportunities
...
```

`List` from `lucide-react` (distinct from `Radar` and `Search`). `/tenders` already
exists (`routes.tsx` lines 207–210).

## Part B — `TenderList` refactor

### Current shape (to remove)

`TenderList.tsx` currently owns:
- `TenderView = "matched" | "all"` state, defaulting to `"matched"` when
  `recommendations` is passed.
- A `role="tablist"` strip (Matched / All) rendered only when `recommendations` exists.
- An embedded `<TenderRadar recommendations={...} embedded />` under the matched tab.
- The `AllTenders` subcomponent: search form + province/publication filters + list of
  `TenderRow` + pagination.
- `TenderRow` (lines 37–98) renders title, `sourceOrganization` (single truncated line),
  ref, first industry category, document count, closing date, estimated value — **no
  description/summary**.

### Target shape

- Remove `TenderView`, the tab strip, and the embedded `TenderRadar` usage, and the
  `recommendations` prop (or make it unused). `/tenders` renders `AllTenders` directly.
  `useState` initial view is no longer needed — the fetch effect always runs for the
  full listing.
- Keep the search + province + publication filters and pagination exactly as-is
  (they map to `GET /api/tenders` query params).
- Enrich `TenderRow` to render a snippet beneath the organisation line, following
  `resolveTenderSnippet` precedence:

  1. `aiSummary` present → "AI Summary" paragraph (+ "Key Requirements" line). Fields
     are added to the desktop `TenderListItem` contract as optional/nullable so the
     slot is ready; because `GET /api/tenders` does not return them today, this branch
     is dormant until the parent contract is extended.
  2. else `description` → render the `description` body (multi-line, `line-clamp-3`).
     This is the branch that is live today.
  3. else → no snippet.

- Keep the existing metadata block (ref, category, document count) and the right-hand
  closing-date / estimated-value panel.

### Contract change (`tenders.ts`)

`tenderListItemSchema` gains two optional/nullable fields so the AI Summary branch is
type-safe and forward-compatible:

```ts
aiSummary: z.string().nullable().optional(),
aiKeyRequirements: z.string().nullable().optional(),
```

`description` is already `.nullable().optional()` — no change needed.

### Snippet resolver

Add a small pure helper mirroring the parent's `resolveTenderSnippet` in the desktop
project (desktop does not import parent code). It lives next to `TenderList` (or in a
`tender-snippet.ts` module) and returns a discriminated union:

```ts
type TenderSnippet =
  | { kind: "ai"; summary: string; keyRequirements: string | null }
  | { kind: "description"; description: string }
  | { kind: "none" };
```

Precedence:
- `aiSummary` (trimmed, non-empty) → `ai`, keyRequirements from
  `documentAnalyses[0].submissionGuidelines` fallback `aiKeyRequirements`. (No
  `documentAnalyses` in the list contract today, so keyRequirements is
  `aiKeyRequirements` only until the parent also exposes submission guidelines — noted,
  not required now.)
- else `description` (trimmed, non-empty) → `description`.
- else `none`.

## Test impact

- `src/tests/app-shell.test.tsx` — grouping + available assertions gain "Tenders".
- `src/tests/navigation-reachability.test.tsx` — no edit (derived from
  `ALL_NAVIGATION_ITEMS`); "Tenders (/tenders)" is swept automatically.
- `src/tests/tender-filters.test.tsx` — the list is now always the full listing with no
  tabs; assertions that referenced the matched/all tabs need review. Add coverage: a row
  renders its `description` when present, and no `TenderRadar` is embedded.
- Any test importing `TenderList` with a `recommendations` prop to reach the matched
  view must be updated/removed.

## Files touched (desktop only)

- `src/components/navigation/navigation-items.ts` — nav item + `List` import.
- `src/features/tenders/TenderList.tsx` — remove matched view, render snippet.
- `src/services/api/endpoints/tenders.ts` — add `aiSummary`/`aiKeyRequirements` schema.
- `src/tests/app-shell.test.tsx` — nav assertions.
- `src/tests/tender-filters.test.tsx` — list behaviour + snippet coverage.
- `docs/specifications/desktop-tenders-nav-item/*` — this spec.

## Parent dependency (not performed by desktop role)

To render the web's AI Summary, the parent `GET /api/tenders` must add `aiSummary` and
`aiKeyRequirements` to its `select` and `formattedTenders` mapping. This is a
parent-repository change, recorded here as a dependency for the user to action
separately.
