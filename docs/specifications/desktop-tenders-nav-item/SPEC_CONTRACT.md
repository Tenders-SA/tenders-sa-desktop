# Desktop — Tenders Listing — SPEC_CONTRACT

- **Status**: `APPROVED`
- **Date**: 2026-08-14
- **Scope**: Add a "Tenders" nav item (R-T1..R-T3) and refactor `TenderList` to drop the
  "Matched for your company" view and render summaries on the full listing (R-T4..R-T8).
- **Approved by**: user (in-session directive, 2026-08-14)
- **Approval date**: 2026-08-14

## Contract checklist (mirrors tasks.md)

| # | Item | Contract |
|---|---|---|
| C1 | Menu item | `Tenders` (icon `List`, path `/tenders`, `available: true`) below `Tender Radar` in the Workflow group. |
| C2 | Destination | Reuse the existing `/tenders` route + `TenderList`; no new route/screen/endpoint. |
| C3 | List contract | `tenderListItemSchema` gains optional/nullable `aiSummary`, `aiKeyRequirements`; `description` unchanged. |
| C4 | Remove matched view | Delete `TenderView`, the Matched/All tab strip, and the embedded `TenderRadar`; `/tenders` always lists the full corpus. |
| C5 | Snippet | Row renders `resolveTenderSnippet` precedence: `aiSummary` (+ Key Requirements) → `description` → none. `description` is live today; AI Summary slot is forward-compatible. |
| C6 | Keep metadata | Title, publication type, province, org, ref, category, document count, closing date, estimated value remain. |
| C7 | Test consistency | `app-shell.test.tsx` nav assertions updated; `tender-filters.test.tsx` reflects no-tab listing + snippet; `navigation-reachability` sweeps the new item. |
| C8 | Gates + docs | Full `vitest`, `npx tsc --noEmit`, `eslint .`, `prettier --check .` — zero errors; spec status + `INTEGRATION_EVAL.md` updated; commit + push. |

## Explicitly out of scope

Parent `GET /api/tenders` endpoint change (documented dependency, parent-owned),
`TenderDetail`/`TenderRadar` at `/radar`, Command Centre "Browse all tenders" link,
tender-document-download flow, and web badge/timeline/colour parity.

## Non-negotiable constraints

- Parent repository is read-only during desktop work; the AI Summary source is a
  parent dependency, not a desktop mutation.
- No new route or data access layer; nav + `TenderList` + contract + tests only.
- No `npm run build` / `next build` / prisma migrations (repo rule).
