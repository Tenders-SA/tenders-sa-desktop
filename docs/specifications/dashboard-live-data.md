# Dashboard Live-Data Contract (2026-08-07)

- **Status**: accepted — implementation completed 2026-08-07
- **Scope**: Command Centre "Closing this week" and "Recent activity" panels
- **Refs**: brief §6.1; `src/services/api/endpoints/dashboard.ts` header

## Problem

The desktop Command Centre's deadline and activity panels were pinned to
`GET /api/v1/dashboard/summary` and `GET /api/v1/dashboard/activity`. The
live deployment of the parent application answers **`{}` with HTTP 200** for
exactly those two routes (verified against the running site on 2026-08-07
with a live session token). The parent schemas for both routes are correct in
every repo branch; the defect exists only in what is deployed. The deployed
code cannot be changed: it serves real users, and the live deployment is the
only contract the desktop is permitted to bind to.

The web application itself does not use those routes for its "deadlines" and
"recent" views — it feeds them from `/api/v1/applications` (and
`/api/v1/recommendations`). Its own summary/activity cards consume the two
broken routes and silently render nothing.

## Decision

Repoint the two desktop panels at the same live-working routes the web
platform feeds from, reusing the existing endpoint clients (`ApplicationsEndpoint`,
`DocumentsEndpoint`) — no parallel implementations:

| Panel | Route | What is derived |
|---|---|---|
| DeadlinePanel | `GET /api/v1/applications?limit=50` | Active (non-archived, status in `DRAFT`/`SUBMITTED`/`UNDER_REVIEW`) applications closing within the next seven days, soonest first, top three listed; pipeline value = sum of `tender.estimatedValue` over active applications |
| DeadlinePanel | `GET /api/v1/documents/stats` | "Documents on file" stat (`totalDocuments`) |
| ActivityPanel | `GET /api/v1/applications?limit=10` | Most recently updated applications, newest first, as the activity feed |

The seven-day window the old summary applied server-side is applied
client-side here (`CLOSING_WINDOW_MS`), so desktop and web agree.

`/api/v1/dashboard/action-center` remains in use by the ActionPanel
(`DashboardEndpoint.getActionItems`); the normaliser now also reads the
live shape's `nextSteps` array (key added to `collectCandidateArray`, `why`
added as a detail source).

## Not done

- The deployed `{}` responses for `/api/v1/dashboard/summary` and
  `/api/v1/dashboard/activity` are **not** fixed (live code must not change)
  and are documented as dead at `dashboard.ts`'s header.
- `getSummary`/`getActivity` were deleted from `DashboardEndpoint`; the
  types `DashboardSummary`, `ActivityItem` and their schemas are gone.

## Verification

- `pnpm exec vitest run` — dashboard endpoint contract tests rewritten for
  the live action-center shape (`nextSteps`), 540 passing.
- `pnpm exec tsc --noEmit`, `pnpm exec eslint`, `pnpm exec prettier --check`
  — clean.
- Manual: HMR against the running desktop app (pid via `tauri-dev8.log`),
  user confirms both panels render without "could not be read in a format
  this version understands".
