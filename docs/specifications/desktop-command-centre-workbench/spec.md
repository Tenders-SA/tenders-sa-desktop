# Desktop Command Centre workbench refinement

**Status:** Approved by user directive, 2026-08-12
**Type:** Scoped maintenance change to the existing Command Centre

## Problem

The Command Centre contains useful charts, but its lower `Needs attention` and
`Recent activity` panels are visually flat lists. They do not help a bid team
distinguish urgent preparation work, understand what changed, or move directly
back into the relevant application workspace. `Recent activity` also performs a
second applications request despite the dashboard already holding the portfolio.

## Desktop task hierarchy

- **Audience:** business owners, bid managers, and tender-response teams
- **Primary job:** decide what tender-preparation work to do next
- **Primary action:** open the relevant task or application workspace
- **Secondary action:** review the complete tasks or applications area
- **Desktop advantage:** use the available width as a persistent bid workbench,
  with a priority queue beside a contextual work timeline

## Approach

- Turn `Needs attention` into a wider priority queue with visible severity,
  counts, explanation, and a route into Tasks.
- Turn `Recent activity` into a compact timeline with status, organisation,
  reference, time, and a direct application-workspace link.
- Feed Recent Activity from the existing `PortfolioState`; remove its duplicate
  `applications.list({ limit: 10 })` request.
- Give the Command Centre a stronger working-session header and replace the
  generic bottom card with a compact opportunity launcher.
- Preserve endpoint contracts, failure isolation, empty states, semantic dark
  tokens, keyboard operation, and human control over bid submission.

## Impact map

| Surface | Change | Risk control |
|---|---|---|
| `CommandCentre.tsx` | Workbench composition and portfolio reuse | Existing routes and hooks only |
| `ActionPanel.tsx` | Priority queue presentation | Existing tolerant action-item contract |
| `ActivityPanel.tsx` | Linked application timeline | Existing portfolio payload; no new request |
| `command-centre.test.tsx` | Navigation, hierarchy, request-count guards | Pins desktop behaviour without backend changes |

No parent repository, authentication, entitlement, Tauri capability, storage,
schema, or API endpoint changes. No new dependency.

## Acceptance

- Attention items communicate priority without colour alone.
- Recent entries identify the tender, status, organisation/reference, and time.
- Each recent application can be opened from the dashboard by keyboard.
- The dashboard performs one portfolio applications request, not a second
  activity-feed request.
- Empty, loading, and error states remain honest and isolated.
- Focused tests, TypeScript, lint, and formatting pass.
