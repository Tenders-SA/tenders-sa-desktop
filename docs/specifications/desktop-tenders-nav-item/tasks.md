# Desktop — Tenders Listing — Tasks

> Read `requirements.md` and `design.md` before starting. Complete tasks in order;
> the contract checklist (`SPEC_CONTRACT.md`) must mirror this list.

## Status

- T1: DONE — add the "Tenders" nav item.
- T2: DONE — update navigation-model assertions.
- T3: DONE — extend the tender list contract (`aiSummary`/`aiKeyRequirements`).
- T4: DONE — refactor `TenderList` (remove matched view, render snippet).
- T5: DONE — update `tender-filters` tests + snippet coverage.
- T6: DONE — gates + docs + commit + push.

## Tasks

| # | Task | Pre-check | Verification |
|---|---|---|---|
| T1 | `navigation-items.ts`: import `List`; insert `Tenders` (`List`, `/tenders`, `available: true`) directly below `Tender Radar` | existing navigation tests green | `vitest app-shell` (after T2) |
| T2 | `app-shell.test.tsx`: add `"Tenders"` after `"Tender Radar"` in grouping + available assertions | T1 green | `vitest app-shell` green |
| T3 | `tenders.ts`: add optional `aiSummary` / `aiKeyRequirements` to `tenderListItemSchema` (+ a pure `resolveTenderSnippet` helper) | T2 green | `vitest module-endpoints` (endpoint fixtures still validate) |
| T4 | `TenderList.tsx`: remove `TenderView`, tab strip, embedded `TenderRadar`, unused `recommendations`; render snippet (AI Summary slot + live `description`) in `TenderRow`; keep filters/pagination | T3 green | `vitest tender-filters` + `module-screens` |
| T5 | `tender-filters.test.tsx`: assert no matched/all tabs, description snippet renders, no embedded radar | T4 green | `vitest tender-filters` green |
| T6 | Gates + docs: full `vitest`, `npx tsc --noEmit`, `eslint .`, `prettier --check .`; update `SPEC_CONTRACT.md` + `INTEGRATION_EVAL.md`; commit + push | T5 green | zero errors; `navigation-reachability` sweeps new item |
