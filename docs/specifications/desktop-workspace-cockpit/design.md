# Desktop Workspace Cockpit — Design (Slice 1)

Refs: requirements.md R-W-1..R-W-7.

## Live-verified parent contracts (2026-08-08)

All GETs return 200 with real data for a DRAFT application; all shapes below were read
from actual live responses (route code at `aws-production-app`):

### GET /api/v1/applications/[id]/assist
```jsonc
{
  "application": { "id", "status": "DRAFT", "currentStep": "overview",
    "progressPercentage": 20, "readinessScore": 80, "notes", "createdAt",
    "updatedAt", "submittedAt", "generatedCoverLetter", "generatedCapability",
    "generatedMethodology", "generatedEmail", "finalProposalUrl" },
  "tender": { "id", "title", "referenceNumber", "sourceOrganization",
    "description", "closingDate", "briefingDate", "province",
    "estimatedValue", "timeline" },
  "company": { "id", "name", "profileCompleteness", "hasProfile",
    "experienceCount", "personnelCount" },
  "matching": null,                      // nullable
  "readiness": { "score": 80, "overall": "ready",
    "factors": [ { "name", "score", "status" } ] },
  "urgency": { "level": "low", "color": "green", "pulsing": false,
    "daysRemaining": 17, "hoursRemaining": 411, "percentageRemaining": 81,
    "message" },
  "generationStatus": { "coverLetter": "pending", "capability": "pending",
    "methodology": "pending", "email": "pending" },
  "qualityChecks": [ { "id", "category": "critical", "status": "pass",
    "message" } ],
  "valueEstimate": { "estimatedMin", "estimatedMax", "estimatedMedian",
    "confidenceScore", "confidenceLevel", "methodology", "dataSources": [],
    "factors": {}, "warnings": [], "currency": "ZAR", "sampleSize" },
  "analysisStatus": { "status": "complete", "message", "progress": 100 },
  "checklistState": [ { "id", "label", "completed": false,
    "category": "preparation" } ],
  "events": [ { "id", "title", "description", "eventDate", "eventType",
    "isCompleted": false, "source" } ],
  "documentState": []
}
```

### GET /api/v1/applications/[id]/assist/compliance-gaps
```jsonc
{ "gaps": [ { "id", "category", "severity", "label", "detail",
    "tenderRequirement", "companyStatus", "fixLink", "canAutoFix": false } ],
  "summary": { "blocking": 0, "important": 1, "strengths": 5, "info": 0,
    "score": 100 } }
```

### GET /api/v1/applications/[id]/assist/research
```jsonc
{ "organisation": { "id", "name", "slug", "organizationType", "contactEmail",
    "contactPhone", "website", "physicalAddress", "registrationNumber",
    "bbbeeLevel", "provincesOperating", "googleRating", "csdNumber",
    "enrichmentSources": [], "tenderCount", "activeTenderCount", "awardCount",
    "closedTenderCount", "cancellationCount" },
  "competitors": [ { "supplierName", "totalValue", "awardCount" } ],
  "provinceHealth": { "province", "score": 50, "activityLevel": "CAUTION" },
  "eligibility": { "cidb": { "status": "pass", "detail" },
    "bbbee": { "status": "pass", "detail" },
    "taxClearance": { "status": "pass", "detail" } },
  "intelItems": [] }
```

### GET /api/v1/applications/workspace/summary (board — stage source)
```jsonc
{ "applications": [ { "id", "stage": "add_information", "status": "DRAFT",
    "title", "organisation", "closingDate", "daysToClose", "estimatedValue",
    "province", "matchScore", "analysis", "blockingIssues", "weakeningIssues",
    "missingDocs", "generatedDocs", "proposalDocCount", "infoNeeded",
    "readinessScore", "hasAnalysableDocuments", "applicationId", "tenderId" } ],
  "autoArchived": ..., "hasMore": ... }
```
Route is admin-gated in code; the desktop treats 403 as "stage unknown" and falls back
to a status-derived stage rather than failing.

### PATCH /api/v1/applications/[id]/workspace
- `{action:'status', status}` → 200 `{success, status, submittedAt}` | 400
  `{error, allowed: string[]}` (invalid transition) | 400 `{error:'Company profile
  required'}` | 401/403/404.
- `{action:'stage', stage, baseStage}` → 200 `{success, persisted, stageOverride}`
  (`stage:null` clears).
- `{action:'remove'}` → 200 `{success, isArchived:true}`.
- Unknown action → 400 `{error:'Unknown action'}`.

## Desktop design

### Endpoint layer — extend `ApplicationsEndpoint` (no parallel client)
New methods on the existing class in `src/services/api/endpoints/applications.ts`
(routes are all application-scoped; adding a second client would be a parallel
implementation):

| Method | Route | Notes |
|---|---|---|
| `getCockpit(id, signal)` | GET `assist` | permissive schema, panel fields |
| `getComplianceGaps(id, signal)` | GET `assist/compliance-gaps` | |
| `getResearch(id, signal)` | GET `assist/research` | |
| `getWorkspaceStage(id, signal)` | GET `workspace/summary` | find card by applicationId; `undefined` on 403 |
| `updateWorkspace(id, action, body, signal)` | PATCH `workspace` | `{action, ...body}`; 400 surfaces `error` + `allowed` |

Schema policy (R-W-6): every panel schema is a permissive zod object — recognised
fields typed (`.nullable().optional()` where the live payload can be null), all schemas
`.passthrough()`, arrays default `[]`. `analysisStatus` etc. degrade to
"Analysis status unavailable" rather than `malformed`.

### UI — panels under `src/features/applications/workspace/`
`ApplicationWorkspace.tsx` stays the orchestrator (keeps its current header, notes and
documents sections from the detail route) and adds below it:

| Panel component | Data | Source |
|---|---|---|
| `StageBar.tsx` | 8-stage stepper, current stage, move/clear/status/archive controls | `getWorkspaceStage` + `updateWorkspace` |
| `UrgencyBanner.tsx` | urgency.level/color/message/daysRemaining | `getCockpit` |
| `AnalysisStatusPanel.tsx` | analysisStatus + qualityChecks | `getCockpit` |
| `ComplianceGapsPanel.tsx` | gaps + summary (severity-coloured) | `getComplianceGaps` |
| `ResearchPanel.tsx` | organisation, competitors (top 5), provinceHealth, eligibility | `getResearch` |
| `ValueEstimatePanel.tsx` | min/max/median + confidence + warnings | `getCockpit` |
| `ChecklistPanel.tsx` | checklistState progress + items | `getCockpit` |
| `EventsPanel.tsx` | events timeline | `getCockpit` |

Each panel runs its own `useAsync` and renders through `AsyncSection` (R-W-5). Panels
that share the cockpit payload are passed the parsed payload as a prop from one
`getCockpit` call (one request, many panels — but each panel still renders its own
error boundary via AsyncSection semantics).

### Lifecycle interactions (R-W-4, R-W-7)
- "Move to stage" select + button → `{action:'stage', stage, baseStage: currentStage}`;
  on success, refetch stage. "Clear override" → `{action:'stage', stage:null}`.
- "Change status" select (allowed list from the card status + parent's `manualTransitionsFrom`
  semantics) → `{action:'status', status}`; on 400, render the parent's `error` +
  `allowed` verbatim.
- "Archive" → confirm dialog → `{action:'remove'}` → navigate back to the application
  list. No restore control (parent defect, R-W-4).

### Wiring
- `src/app/auth-wiring.ts`: no new client needed (methods live on `ApplicationsEndpoint`).
- `src/tests/fixtures/api-clients.ts`: applications fixture gains the five methods
  (`idle()`).
- Capability scope: all routes under `/api/v1/` — already permitted; `endpoint-parity`
  test updated with the new routes.

### Tests
- `module-endpoints.test.ts`: contract tests per method with the live-verified shapes
  above (including null-able fields and the 403 stage fallback).
- `module-screens.test.tsx`: workspace renders all panels from stubs; a failing panel
  renders its own error while others render; stage/status/archive buttons issue the
  exact PATCH bodies; 400 transition shows the parent message.
- Regression: the existing `isArchived`-omitted detail test keeps passing.
