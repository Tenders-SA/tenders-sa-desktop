# Desktop — Tenders Listing — INTEGRATION_EVAL

- **Status**: complete — T1–T6 verified
- **Spec**: `desktop-tenders-nav-item/` (requirements R-T1..R-T8, design, tasks)

## Known parent-contract limitation

The desktop `GET /api/tenders` list returns `description` but **not**
`aiSummary`/`aiKeyRequirements` (verified in parent `src/app/api/tenders/route.ts`
lines 155–305; `select` includes `aiTitleFixed` but neither summary field, and the
`formattedTenders` mapping omits them). The public SEO listing exposes them via
`TENDER_CARD_SELECT` (`src/lib/seo/tender-card.ts`). Until the parent list route adds
`aiSummary` + `aiKeyRequirements`, the desktop renders the `description` snippet; the AI
Summary slot is wired and fills in automatically once the fields arrive.

## Gates

| Gate | Task | Evidence | Date |
|---|---|---|---|
| Navigation model | T1/T2 | `vitest app-shell` — "matches the product brief's labels and grouping" + "marks only built destinations as available" include "Tenders" after "Tender Radar" (32/32) | 2026-08-14 |
| List contract | T3 | `vitest module-endpoints` — 117/117; schema accepts optional `aiSummary`/`aiKeyRequirements` | 2026-08-14 |
| List refactor | T4/T5 | `vitest tender-filters` 16/16 — no matched/all tabs, `description` snippet renders, no embedded radar | 2026-08-14 |
| Reachability sweep | T6 | `navigation-reachability.test.tsx` 28/28 — "Tenders (/tenders)" resolves to its own route | 2026-08-14 |
| Static gates | T6 | `tsc --noEmit` clean, `eslint .` clean, `prettier --check` clean on changed source | 2026-08-14 |
| Full suite | T6 | `vitest run` (NODE_ENV=test) — 911/911 tests, 55 files green | 2026-08-14 |
