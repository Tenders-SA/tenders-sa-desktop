# Desktop Tender Radar parity refactor — requirements

**Status:** APPROVED

**Created:** 2026-08-14

**Identity:** coder / spec-creator / recommendations-matching / desktop-only

## Context note

### Recent related work

- Desktop `main` is synchronized with `origin/main` at `c148043`. Recent work is
  concentrated in the local-first application workspace; no recent desktop
  commit supersedes the Radar implementation.
- The desktop Radar originated in `e7248b0` (`feat: build the workflow modules
  against the web app's own endpoints`) and was subsequently adapted to the
  local-first cache in `c9eb28c`.
- The main application has materially evolved since that desktop implementation:
  `654e666e2` added AI recommendations and summaries, `559aed124` added freshness,
  `852a8aa70` and `5f7e07e97` added scenario scanning, `634fd962a` added saved and
  dismissed actions, `30538ea8f` added tier behavior, and `c891fd8e5` delivered the
  current premium Radar interface.
- The desktop worktree already contains a user-owned edit to `AGENTS.md` and the
  runtime-only `.codex-runtime/` directory. Neither is part of this specification.

### Reality check: what exists

This is an **enhance-existing** refactor. A second Radar route, endpoint family, or
screen must not be created.

| Concern | Existing canonical implementation | Evidence |
|---|---|---|
| Desktop navigation | `src/components/navigation/navigation-items.ts` | `Tender Radar` already links to `/radar` at line 68. |
| Desktop route | `src/app/router/routes.tsx` | `/radar` already renders `TenderRadar` at lines 196–199. |
| Desktop screen | `src/features/radar/TenderRadar.tsx` | Existing canonical desktop Radar entry point; currently a score-threshold listing. |
| Desktop API adapter | `src/services/api/endpoints/recommendations.ts` | Existing authenticated adapter for list, explanation, new count, and refresh. |
| Desktop saved state | `src/services/api/endpoints/saved-tenders.ts` | Existing read and authoritative toggle contracts. |
| Desktop company data | `src/services/api/endpoints/company.ts` | Existing profile adapter; the documented extended-profile route is not yet projected. |
| Desktop entitlement | `src/services/api/endpoints/subscription.ts` | Existing server-authoritative subscription projection. |
| Main private Radar | Parent `src/app/radar/page.tsx` and `src/components/radar/*` | Current product behavior and presentation reference. |
| Main scenario scan | Parent `src/app/api/radar/scenario-scan/route.ts` | Existing authenticated and Pro/Enterprise-gated calculation contract. |

The desktop currently calls the older `GET /api/v1/recommendations` read model.
The main `/radar` page does not call that route: it constructs a richer feed directly
from the database and passes it to `RadarPageContainer`. Therefore visual parity can
be achieved in the desktop, but literal data parity is constrained by the existing
published contracts described below.

## Objective

- **Why:** The desktop menu currently opens a generic recommendation listing that
  does not provide the workflow, prioritisation, tier behavior, controls, profile
  guidance, or scenario modelling users rely on in the main `/radar` experience.
- **Goal:** Refactor the existing desktop `/radar` destination in place so it follows
  the main Radar's information architecture and interaction model while consuming
  only existing authenticated parent contracts and preserving desktop-native routing,
  caching, accessibility, and security.
- **Non-goal:** Reproduce the main application's Next.js page verbatim, embed the web
  page, calculate matching locally, add a parent endpoint, or modify any parent file.

## Parent-contract constraints

The implementation must not conceal these differences or invent missing state.

| Main `/radar` behavior | Existing desktop-accessible contract | Required desktop behavior |
|---|---|---|
| Excludes stale matching scores | `/api/v1/recommendations` does not filter `isStale` | Do not claim that stale records were excluded; show the latest `calculatedAt` signal available. |
| Excludes dismissed scores and supports undo | Recommendation feed ignores feedback; public feedback POST is create-only and has no action undo contract | Do not ship `Not Relevant`/undo until an idempotent parent contract also excludes dismissed rows. |
| Includes only `TENDER_NOTICE` | Recommendation feed does not filter `publicationType` | Do not claim notice-type parity. Render only the status/closing guarantees the route actually provides. |
| Includes already-applied matches | Recommendation service defaults to excluding applied tenders | Document this as a feed difference; do not reconstruct applied rows locally. |
| Supplies `eligibilityStatus` | Recommendation response does not expose it | Omit `Eligible only` and eligibility badges; do not infer legal eligibility from a factor score. |
| Supplies publication/created timestamps | Recommendation response exposes `calculatedAt` only | Treat `calculatedAt` as “new to your Radar,” not tender publication time. |
| Supplies `isSaved` in the page query | Saved state is available through the separate saved-tenders contracts | Compose saved state without per-card N+1 requests and use the toggle response as authority. |
| Supplies inline tender AI summary | Recommendation response omits `aiSummary` | Retain AI recommendation reasoning/actions; do not add N+1 tender-detail requests for summaries. |
| Uses server actions for save/dismiss | Desktop uses authenticated HTTP adapters | Use existing saved-tender HTTP contracts only. |
| Locally stores an “Email Digest” radio value | The web control does not update server notification preferences | Do not port a misleading local-only email control. Existing desktop Settings remains the preference surface. |
| Links near misses to web-only JV tooling | Desktop JV navigation is explicitly unavailable | Do not advertise a JV action that the desktop cannot complete. |

These are not reasons to create a parallel backend. They are acceptance boundaries for
the desktop refactor. Exact feed parity can only be claimed in a future specification if
the parent exposes a canonical Radar read contract.

## Functional requirements

- [x] **REQ-1 — One canonical desktop route:** Keep the existing `/radar` navigation
  item, route, `TenderRadar` component, and `RecommendationsEndpoint` as the owners.
  The refactor must not add `RadarV2`, a second menu option, or a parallel endpoint.
- [x] **REQ-2 — Server-authoritative scores:** Load stored recommendation scores from
  `GET /api/v1/recommendations`; never calculate or adjust a live match score in the
  desktop. Request up to 50 rows at a minimum score of 30 so the desktop can present
  the main Radar's highly-qualified, potential, and near-miss bands.
- [x] **REQ-3 — Canonical category projection:** Derive presentation categories from
  the stored numeric score using the main Radar thresholds: `>=70` highly qualified,
  `50–69` potential, `30–49` near miss, and below 30 not fit. The older API label
  `good_match` must not leak into the new UI.
- [x] **REQ-4 — Tier-aware workspace:** Read the plan from
  `SubscriptionEndpoint.getStatus()`. Free users see an honest unavailable state,
  Starter users see their top 10 loaded matches, and Professional/Enterprise users
  see up to the parent limit of 50. A subscription read failure is an error, never an
  upgrade prompt or implicit free-tier decision.
- [x] **REQ-5 — Radar header and counts:** Show the main Radar hierarchy: title,
  purpose, latest match-calculation time, total visible matches, highly-qualified
  count, closing-this-week count, and profile completeness. Counts must be calculated
  after the tier cap and before user-selected filters, matching the visible entitlement.
- [x] **REQ-6 — Match navigation and controls:** Provide All, Highly Qualified,
  Potential, and Near Miss tabs; Closing Soon and New to Radar This Week filters; and
  Freshest, Best Match, Closing Soonest, and Highest Value sorting. Reset local
  pagination when any filter, tab, sort, or scenario changes.
- [x] **REQ-7 — Desktop-native cards:** Each card must show the authoritative score and
  band, native tender-detail link, title, buyer, province, reference, closing urgency,
  estimated value, available factor breakdown, reasoning, improvement gaps, suggested
  actions, and available AI recommendation fields. Missing fields render as absent or
  explicitly unknown, never as zero or a failed qualification.
- [x] **REQ-8 — Saved state and mutation:** Reconcile saved IDs using the existing
  paginated saved-tender read contract without issuing one request per card. Save and
  unsave must call the existing non-retried toggle once, adopt its returned boolean as
  authority, update the in-memory view and relevant cache, and expose retryable errors
  without falsely changing state.
- [x] **REQ-9 — Profile guidance:** Read the existing extended company-profile contract
  and project the same six main-Radar signals—registration number, CIDB grading,
  B-BBEE level, annual turnover, industry codes, and company type—using weights
  `20/20/20/20/10/10`. Show missing signals and link to the desktop `/company` route.
- [x] **REQ-10 — Top improvement:** Derive the most frequent normalized gap from the
  already-loaded recommendation data. Do not call AI or invent a recommendation when
  no gap exists.
- [x] **REQ-11 — Scenario scan:** Professional and Enterprise users may call the
  existing `POST /api/radar/scenario-scan` contract for standard, CIDB, JV, B-BBEE,
  or province scenarios. Results are a temporary overlay keyed by matching-score ID;
  they never overwrite cached base scores, write profile data, or persist when the
  user exits the preview.
- [x] **REQ-12 — Honest states:** Preserve distinct loading, cached-stale, refreshing,
  refresh-failed, no-company-profile, no-matches, filtered-empty, access-unavailable,
  and fatal-contract-error states. Auxiliary profile or saved-state failures may
  degrade only their own surface and must be named to the user.
- [x] **REQ-13 — Embedded reuse:** `TenderList` may continue to embed the Radar, but the
  embedded variant must stay compact and use the same endpoint types and category
  projection. It must not render the full header/sidebar workspace inside the tender
  list or duplicate the feed loader.
- [x] **REQ-14 — Replacement completion:** Remove the standalone screen's current
  minimum-score selector, generic previous/next listing, and fire-and-forget
  “Recalculate matches” control once their replacements are verified. No obsolete
  standalone path may remain active alongside the new workspace.

## Non-functional requirements

- [x] **PERF-1:** Issue the recommendation, entitlement, extended-profile, and initial
  saved-state request families concurrently. Saved-state pagination may continue only
  through the existing list contract; no per-card status or tender-detail N+1 calls.
- [x] **PERF-2:** Render valid account-scoped cached Radar data immediately when
  available and reconcile in the background through `useWorkspaceAsync`.
- [x] **SEC-1:** Every parent call must use the existing authenticated endpoint base and
  read the bearer token from the OS credential store per request. No token may enter
  React state, logs, local storage, SQLite payloads, or URLs.
- [x] **SEC-2:** Subscription display logic is not a security boundary. The scenario
  endpoint's parent-side Pro/Enterprise gate remains authoritative.
- [x] **REL-1:** Zod schemas must fail closed on unknown contract drift. A validation
  failure renders a handled error and never an empty Radar.
- [x] **REL-2:** Mutations use `retry: "never"`; reads retain the existing safe retry,
  account isolation, cancellation, and stale-data behavior.
- [x] **A11Y-1:** All information represented by color or a chart also has text; controls
  are keyboard operable and labelled; focus remains visible; loading and mutation
  outcomes are announced; reduced motion disables urgency animation.
- [x] **UX-1:** The full workspace must remain usable at 1024×768 and at the desktop
  shell's narrow supported width without horizontal page scrolling.
- [x] **DATA-1:** No parent schema, database, API route, service, matching algorithm,
  cron, auth module, or payment module changes are permitted.

## Integration requirements

- [x] **INT-1:** Extend the existing `RecommendationsEndpoint`, `CompanyEndpoint`, and
  `SavedTendersEndpoint` contracts; do not create a second transport or auth path.
- [x] **INT-2:** Preserve `workspaceQueryKey("radar", ...)`, account-isolated cache
  ownership, `WorkspaceDataStatus`, and `AsyncSection` error semantics.
- [x] **INT-3:** Preserve `/radar`, `/tenders/:tenderId`, `/company`, and the existing
  `ApiClients` composition root.
- [x] **INT-4:** Use `GET /api/v1/recommendations`, `GET /api/v1/company/profile/extended`,
  `GET /api/v1/user/saved-tenders`, `POST /api/v1/tenders/[id]/save`,
  `GET /api/subscription/status`, and `POST /api/radar/scenario-scan` only as their
  current contracts permit.
- [x] **INT-5:** Keep `src/features/radar/TenderRadar.tsx` as the public screen entry and
  decompose only into co-located presentation/model helpers.
- [x] **INT-6:** Main-app Radar code is read-only reference material; no parent change is
  implied by approving this desktop specification.

## Success criteria

- [x] Clicking the existing Tender Radar menu opens a recognizably equivalent,
  desktop-native version of the main `/radar` workflow rather than the old score list.
- [x] The same stored score is shown in the API adapter, card, factors, filters, and
  scenario baseline; the desktop never creates a competing score.
- [x] Free, Starter, Professional, and Enterprise fixtures render the correct workspace
  states without treating an entitlement outage as a denial.
- [x] Saved-state toggle, local filtering/sorting, profile guidance, cache refresh, and
  scenario preview each have focused success and failure tests.
- [x] Unsupported eligibility, dismissal/undo, AI summary, email-digest, JV navigation,
  stale filtering, and publication-type claims do not appear in the UI.
- [x] Existing embedded Radar, tender detail, navigation reachability, Opportunities,
  Settings, and account-isolated cache tests remain green.
- [x] Targeted tests, `pnpm run typecheck`, `pnpm run lint`, and task-scoped formatting
  checks pass; the user performs any release build. The repository-wide formatting
  command additionally reports two untouched user-owned `.codex-runtime` scripts.

## Implementation evidence

- Route ownership and full/embedded orchestration: `src/app/router/routes.tsx`,
  `src/features/radar/TenderRadar.tsx`, and `src/features/tenders/TenderList.tsx`.
- Contract-backed reads and mutations: `src/services/api/endpoints/recommendations.ts`,
  `src/services/api/endpoints/company.ts`, and
  `src/services/api/endpoints/saved-tenders.ts`.
- Immutable category, tier, filtering, profile, and scenario projections:
  `src/features/radar/radar-workspace-model.ts`.
- Desktop-native presentation: `RadarHeader.tsx`, `RadarControls.tsx`, `RadarCard.tsx`,
  `RadarSidebar.tsx`, and `RadarScenarioPanel.tsx` beside the Radar entry component.
- Requirement and regression coverage: `src/tests/radar-workspace-model.test.ts`,
  `src/tests/module-endpoints.test.ts`, `src/tests/module-screens.test.tsx`, and
  `src/tests/navigation-reachability.test.tsx`.

## Approval gate

Implementation must not begin while `SPEC_CONTRACT.md` is `PENDING APPROVAL`.
