# Desktop Tender Radar parity refactor — design

**Approach:** Enhance existing

**Parent repository:** Read-only

**Schema changes:** None

**Frozen main-app modules:** Consumed through existing contracts only; none modified

## Implementation strategy

The main `/radar` page is the product behavior reference, not a reusable desktop
module. Its Next.js server component reads the database directly and its card actions
are server actions. The desktop will preserve those product semantics through a
desktop-owned view model assembled from existing authenticated HTTP adapters.

The canonical desktop owner remains `TenderRadar.tsx`. Small co-located components
will make the workspace testable and keep the existing entry point from becoming a
second monolith. The existing `RecommendationsEndpoint` remains the only Radar API
adapter; scenario scanning is an additional method on that adapter, not a new client.

### Data flow

```text
existing /radar route
  -> TenderRadar (canonical desktop owner)
     -> RecommendationsEndpoint.list(minScore=30, limit=50)
     -> SubscriptionEndpoint.getStatus()
     -> CompanyEndpoint.getExtendedProfile()
     -> SavedTendersEndpoint.list(...) pages
  -> account-scoped useWorkspaceAsync cache
  -> pure radar workspace projection
     -> tier cap
     -> canonical score bands and counts
     -> filters, sorting, local 15-row reveal
  -> header + cards + profile rail
  -> existing native /tenders/:id and /company routes

Pro/Enterprise only:
  RadarScenarioPanel
    -> RecommendationsEndpoint.scanScenario(...)
    -> existing parent POST /api/radar/scenario-scan
    -> temporary projected-score overlay
    -> exit restores unchanged cached base scores
```

## Canonical product mapping

| Main app reference | Desktop adaptation |
|---|---|
| `src/app/radar/layout.tsx` | Entitlement state from existing `SubscriptionEndpoint`; route stays native. |
| `src/app/radar/page.tsx` | HTTP-composed workspace snapshot; no database access. |
| `RadarPageContainer` | `TenderRadar` owns tabs, filters, sort, reveal count, and scenario overlay. |
| `RadarHeader` | Co-located desktop header using existing theme tokens. |
| `TenderRadarCard` | Co-located desktop card linked to `/tenders/:id`; only contract-backed fields/actions. |
| `RadarSidebar` | Profile completeness, top improvement, profile link, and paid scenario panel. |
| `RadarScanPanel` | Existing parent scenario API through the desktop authenticated transport. |
| Server save action | Existing `SavedTendersEndpoint.toggleSave`; returned state is authoritative. |
| Server dismiss/undo actions | Intentionally absent until a complete parent contract exists. |

## View model

`radar-workspace-model.ts` will contain pure types and transformations. It must not
fetch, read storage, or import React.

```ts
type RadarBand = "highly_qualified" | "potential" | "near_miss" | "not_fit";

interface RadarWorkspaceMatch {
  matchingScoreId: string;
  tenderId: string;
  title: string;
  referenceNumber: string | null;
  buyer: string | null;
  province: string | null;
  closingDate: string | null;
  estimatedValue: number | null;
  score: number;
  band: RadarBand;
  factors: ScoreFactors | null;
  reasoning: string | null;
  gaps: string[];
  actions: string[];
  aiRecommendation: RecommendedTender["aiRecommendation"];
  calculatedAt: string;
  isSaved: boolean;
}

interface RadarWorkspaceSnapshot {
  access: "free" | "starter" | "professional" | "enterprise";
  matches: RadarWorkspaceMatch[];
  profile: RadarProfileProjection | null;
  profileState: "ready" | "missing" | "unavailable";
  savedState: "ready" | "unavailable";
  lastUpdated: string | null;
}
```

### Projection rules

1. The parent numeric score is immutable base truth.
2. `classifyRadarScore` uses `70/50/30` thresholds from the main Radar scenario
   classifier and matching-feedback categorizer.
3. `calculatedAt` is the only available freshness timestamp and is labelled as a
   Radar calculation/update, not a tender publication date.
4. The entitlement cap is applied before headline counts and filters: Starter 10,
   Professional/Enterprise 50, Free 0.
5. Base matches are never mutated. Scenario output creates derived objects with
   `scenarioScore` and `scenarioDelta`, keyed by matching-score ID.
6. Top improvement is the most frequent trimmed, case-insensitively normalized gap;
   first appearance breaks ties deterministically.
7. Invalid dates sort last. Unknown values do not become zero except where a sort
   explicitly places unknown tender value last.

## Loading and failure isolation

The full route uses a discriminated prop shape so its dependencies are type-enforced,
while the existing embedded TenderList use remains intentionally compact:

```ts
type TenderRadarProps =
  | {
      embedded?: false;
      recommendations: RecommendationsEndpoint;
      savedTenders: SavedTendersEndpoint;
      company: CompanyEndpoint;
      subscription: SubscriptionEndpoint;
    }
  | {
      embedded: true;
      recommendations: RecommendationsEndpoint;
    };
```

The standalone load starts the four request families concurrently. Recommendations
and entitlement are required. Extended profile and saved-state reads are isolated:

- recommendation failure -> fatal handled Radar error;
- entitlement failure -> fatal handled access error, never an upgrade state;
- missing company state from recommendations -> dedicated company-profile action;
- profile read failure -> matches remain visible with a named unavailable profile rail;
- saved read failure -> matches remain visible, save controls are disabled with a named
  unavailable state so a toggle cannot invert unknown state;
- cached snapshot -> render immediately with `WorkspaceDataStatus`, then reconcile.

Saved IDs are collected through the existing paginated list endpoint using its
server-returned `totalPages`. Pages are requested sequentially with the same abort
signal and a page size no greater than the route's existing maximum. There is no
per-card GET and no blind assumption that the first page contains every saved match.

## Endpoint adaptations

### `RecommendationsEndpoint`

- Keep `list`, `explain`, `newCount`, and `refresh` for existing consumers.
- Widen the accepted response-side `matchCategory` only as required by current parent
  reality, but ignore it for the new workspace's band projection.
- Add a Zod-validated `scanScenario(input, signal)` method for
  `POST /api/radar/scenario-scan` using the existing auth headers and mutation
  no-retry policy.
- Accept only the existing response envelope and validate every row/delta.

### `CompanyEndpoint`

- Add `getExtendedProfile(signal)` for the already-existing
  `GET /api/v1/company/profile/extended` route.
- Project only the company/profile fields needed for the six-signal completeness card.
- Treat a route 404 as a missing profile; other errors remain errors.
- Do not use the current `getCidb()` GET method for this feature because the parent
  CIDB route exposes POST, not GET.

### `SavedTendersEndpoint`

- Add a reusable `listAllIds`/equivalent paginated helper, or keep that orchestration
  in the Radar loader if consumer scope is intentionally local.
- Do not change `toggleSave` semantics: one non-retried call, returned boolean wins.

## Component design

| Component/helper | Inputs | Responsibility |
|---|---|---|
| `TenderRadar` | Discriminated endpoint props | Canonical orchestration, cache state, local controls, scenario overlay. |
| `radar-workspace-model.ts` | Contract-backed snapshot inputs | Pure normalization, bands, counts, filters, sorts, profile completeness. |
| `RadarHeader` | Counts, completeness, last updated | Main-Radar hierarchy and text-backed metrics. |
| `RadarControls` | Active band, filters, sort | Accessible tabs/toggles/select with reset callbacks. |
| `RadarCard` | One projected match, save handler | Contract-backed decision card and native detail link. |
| `RadarSidebar` | Profile projection, top gap, access | Profile guidance and scenario entry; no fake digest/JV controls. |
| `RadarScenarioPanel` | Access, current profile signals, scan port | Modal/panel input, server scan, result comparison, temporary overlay. |

The project has no general shadcn-style primitive layer. Components should reuse the
existing desktop theme tokens, native controls, and established accessible patterns
instead of creating a second generic UI library during this refactor.

## UX behavior

- Reveal 15 rows initially and 15 more per “Load more,” matching the main workspace's
  local reveal pattern without another server request.
- A filter or sort change resets reveal count and never mutates cached base order.
- “New to Radar This Week” uses `calculatedAt` and says exactly that in helper text.
- Closing urgency uses absolute date logic and handles missing/invalid closing dates.
- Save buttons show pending state, remain disabled while unknown or pending, and announce
  success/failure.
- Scenario preview forces Best Match sorting while active, shows projected deltas, and
  restores the user's previous sort when exited.
- Reduced-motion users receive no pulsing urgency animation.
- The free-tier state links to existing desktop destinations (`/tenders` and plan details
  in the current shell) and explains that subscription changes occur on tenders-sa.org;
  this spec does not add external-navigation capabilities or dependencies.

## Files to create

| File | Type | Purpose |
|---|---|---|
| `src/features/radar/radar-workspace-model.ts` | Pure domain helper | Canonical mapping, bands, counts, profile score, filter/sort, overlay helpers. |
| `src/features/radar/RadarHeader.tsx` | Presentation | Header, freshness, metrics, plan label. |
| `src/features/radar/RadarControls.tsx` | Presentation | Match tabs, filters, and sorting. |
| `src/features/radar/RadarCard.tsx` | Presentation | Desktop-native match card and save action. |
| `src/features/radar/RadarSidebar.tsx` | Presentation | Completeness, top improvement, profile action, scenario entry. |
| `src/features/radar/RadarScenarioPanel.tsx` | Presentation/controller | Existing server scenario scan and temporary comparison. |
| `src/tests/radar-workspace-model.test.ts` | Test | Pure category, count, cap, filter, sort, completeness, and overlay regressions. |

These are co-located parts of the existing feature, not a second Radar implementation.

## Files to modify

| File | Change | Requirement |
|---|---|---|
| `src/features/radar/TenderRadar.tsx` | Replace the standalone generic list presentation with canonical workspace orchestration; retain compact embedded mode. | REQ-1–14 |
| `src/features/radar/MatchFactors.tsx` | Reuse within the new card; adjust only if the card needs a compact/expanded presentation prop. | REQ-7 |
| `src/services/api/endpoints/recommendations.ts` | Add scenario schema/method and align tolerant read projection. | REQ-2, REQ-11 |
| `src/services/api/endpoints/company.ts` | Project the existing extended-profile GET contract. | REQ-9 |
| `src/services/api/endpoints/saved-tenders.ts` | Support complete saved-ID reconciliation without N+1 calls. | REQ-8 |
| `src/app/router/routes.tsx` | Pass the existing full endpoint set to the standalone route. | REQ-1, INT-3 |
| `src/features/tenders/TenderList.tsx` | Preserve and type-check compact embedded use if the discriminated props require adjustment. | REQ-13 |
| `src/tests/module-endpoints.test.ts` | Contract tests for extended profile, saved pagination, and scenario scan. | REL-1, INT-4 |
| `src/tests/module-screens.test.tsx` | Full/embedded screen, state, save, filter, tier, and scenario behavior. | REQ-4–14 |
| `src/tests/navigation-reachability.test.tsx` | Confirm the existing menu still reaches the single `/radar` owner. | REQ-1 |

No parent file, schema, Tauri capability, dependency, or migration is created or modified.

## Impact map

### Codebase impact

| File area | Change type | Risk | Frozen tier |
|---|---|---:|---|
| Desktop Radar feature | Refactor in place | High — primary user workflow | N/A |
| Desktop endpoint schemas | Additive projection/methods | Medium — contract drift can blank the screen | N/A |
| Desktop router wiring | Existing dependency wiring only | Low | N/A |
| Desktop cache payload | Versioned shape change | Medium — stale snapshots must fail/migrate safely | N/A |
| Parent recommendation/scenario/profile/saved APIs | Read/use only | Medium contract dependency | Parent Tier 1/2 internals untouched |

### Downstream effects

- **Routes:** `/radar` changes presentation; `/tenders` retains compact embedded mode;
  `/tenders/:tenderId` and `/company` remain destinations.
- **Components:** Command Centre, Opportunities, and Application Workspaces keep their
  existing links to `/radar`; no navigation label changes.
- **Services:** Existing `ApiClients`, transport, OS credential store, workspace cache,
  and saved-tender toggle are reused.
- **Database:** None. Desktop SQLite stores only the existing account-scoped cached
  snapshot; no schema migration is required.
- **External:** Existing Tenders-SA parent APIs only. No new vendor or dependency.
- **Commercial behavior:** Free/Starter/Professional/Enterprise presentation changes,
  but the parent remains the entitlement authority.

### Frozen module assessment

- No Tier 1 or Tier 2 main-app file is modified.
- The parent `TenderRecommendationService` and matching automation are frozen/read-only
  dependencies. The desktop adapts to their current HTTP results.
- No auth, payment, middleware, Prisma, cron, or API response helper modification occurs.
- A parent migration plan is therefore not required.

## Compatibility and rollout

1. Land contract projections and pure model with tests before UI replacement.
2. Refactor the existing entry point; do not add a feature flag or second route.
3. Version the Radar workspace cache key/schema so an old list snapshot cannot validate
   as the new composite snapshot.
4. Preserve compact embedded behavior throughout the change.
5. Verify free and paid accounts against the existing live contracts in development.
6. Remove old standalone controls only after the new workspace tests pass.

Rollback is a desktop commit revert. No parent data, schema, or persisted score changes
are involved. Saved toggles made by users are normal canonical server state and are not
rolled back with code.

## Validation plan

- Endpoint fixtures for every response envelope and failure class.
- Pure tests at threshold edges 29/30/49/50/69/70 and tier caps 0/10/50.
- Saved pagination with a relevant saved tender beyond page one.
- Full vs embedded rendering and route reachability.
- Subscription outage vs true free account behavior.
- Missing profile vs profile endpoint outage.
- Cached-stale render followed by successful and failed reconciliation.
- Scenario overlay/exit without base score mutation.
- Save success, unsave success, unknown saved state, and mutation failure.
- Keyboard and accessible-name assertions for tabs, toggles, select, modal, and actions.
- Targeted Vitest, typecheck, lint, format check, and manual `pnpm run tauri dev` smoke.
- No release build; the user owns release packaging.
