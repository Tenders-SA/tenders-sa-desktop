# Desktop tender analysis workbench — design

## Decision

Enhance the existing tender detail endpoint and desktop tender window. Do not
create a second analysis API or processing service.

## Information architecture

```text
Sticky decision header
├─ Tender identity, organisation, deadline and status
├─ Save / Start or continue application
└─ Analysis coverage indicator

Desktop workbench (wide)
├─ Left: section navigator
├─ Centre
│  ├─ AI-Analyzed Compliance Requirements (dominant)
│  ├─ Key bidder takeaways
│  ├─ Full analysis explorer by document/category
│  ├─ Tender description and official metadata
│  └─ Source document downloads
└─ Right: preparation rail
   ├─ closing/briefing risk
   ├─ analysed-document coverage
   ├─ verification notice
   └─ open application workspace
```

At compact widths the order becomes header → compliance → next action → full
analysis → description → documents. The section navigator becomes a horizontal
overflow strip or compact select; the preparation rail becomes inline cards.

## Data contract

### Parent projection

Extend the existing formatter in `src/app/api/tenders/[id]/route.ts`; its query
already includes each document's `analyses`. Project a stable nested shape:

```ts
analysisAccess: {
  state: "available" | "locked" | "pending" | "partial" | "unavailable";
  analysedDocuments: number;
  totalDocuments: number;
};
aiSummary?: string | null;
aiKeyRequirements?: string | null;
documents[].analyses?: Array<{
  id: string;
  submissionGuidelines?: string | null;
  evaluationCriteria?: string | null;
  evaluationStructured?: unknown;
  importantDates?: string | null;
  contactInformation?: string | null;
  technicalSpecifications?: string | null;
  financialRequirements?: string | null;
  complianceRequirements?: string | null;
  localContentRequirement?: string | null;
  hdiRequirement?: string | null;
  analysisSections?: Array<{
    sectionType: string;
    content: string;
    source?: {
      documentId?: string;
      documentName?: string | null;
      documentCategory?: string | null;
    };
  }>;
  confidence?: number | null;
  extractionMethod?: string | null;
  extractionVersion?: number | null;
  sectionTaxonomyVersion?: number | null;
  extractedAt?: string | null;
}>;
```

Exact names must be verified against the current Prisma model before coding;
the route currently calls one field `confidenceScore` while the public tender
type calls it `aiConfidence`. The API adapter must normalize this mismatch at
the boundary rather than guessing in the UI.

### Server-side access

The parent handler must authenticate the user and reuse the same feature-service
decision used by the web tender workspace for `documentAnalysis`, including
bundle-wallet access. Cache entries must not mix entitled content between
users. The safe design is to cache the base tender independently, then attach
or strip analysis after the per-request entitlement decision. If the current
shared detail cache cannot guarantee that separation, analysis must not be put
inside its shared cached value.

The desktop may also call its existing feature-access endpoint to choose the
correct UX, but that client check is presentation only and cannot authorize
the payload.

## Desktop components

Keep `TenderDetail.tsx` as orchestration and split presentation into focused
components under `src/features/tenders/detail/`:

- `TenderDecisionHeader.tsx` — sticky identity, deadline, coverage, actions.
- `TenderAnalysisWorkbench.tsx` — layout and lifecycle states.
- `ComplianceRequirementsPanel.tsx` — emphasised consolidated checklist.
- `AnalysisSectionNavigator.tsx` — keyboard-operable section jumps/filters.
- `DocumentAnalysisExplorer.tsx` — primary document plus collapsible support
  documents and all extended sections.
- `StructuredEvaluation.tsx` — defensive structured/text evaluation renderer.
- `PreparationRail.tsx` — coverage, verification, and workspace handoff.
- `analysis-presentation.ts` — pure normalization, ordering, noise filtering,
  deduplication, source attribution, and lifecycle derivation.

Reuse the web semantics and ordering from `TenderAIChecklistServer.tsx`,
`DocumentAnalysisSection.tsx`, `section-dedup.ts`, and
`document-prioritization.ts`, but implement desktop-local pure functions. The
desktop cannot import Next.js components and must not copy server-only code.

## Visual direction

- Keep neutral application chrome and Tenders-SA green for trusted analysis.
- Give the compliance panel stronger hierarchy with a shield marker, a dark
  title band or restrained green edge, point/category counts, and clear source
  chips. Red is reserved for explicit mandatory/risk items, not the whole card.
- Use dense but readable desktop spacing, persistent navigation, selectable
  text, and collapsible supporting evidence rather than a long marketing page.
- Show confidence only when it is meaningful and explain it as extraction
  confidence, never bid-success probability.

## Error and compatibility strategy

- Zod fields are optional/nullable and tolerate unknown future section types.
- Unknown sections receive a humanised label and generic document icon.
- Invalid structured evaluation falls back to formatted text.
- Noise/empty sections disappear individually; one malformed section cannot
  hide the rest of the tender.
- Abort analysis/entitlement requests on navigation.
- The existing core tender, download, save, and pursue behaviors continue even
  if analysis loading fails.

## Impact map

| Repository | File/surface | Change | Risk | Frozen |
|---|---|---|---|---|
| Parent | `src/app/api/tenders/[id]/route.ts` | Add entitled complete analysis projection | High: access/cache boundary | No registry entry found |
| Parent | route tests and cache/security regression tests | Verify full/locked/partial shapes and no cross-user leakage | High | N/A |
| Desktop | `src/services/api/endpoints/tenders.ts` | Add tolerant analysis schemas | Medium | N/A |
| Desktop | `src/app/router/routes.tsx` | Inject existing subscription/workspace navigation dependencies | Low | N/A |
| Desktop | `src/features/tenders/TenderDetail.tsx` | Adopt workbench composition | Medium | N/A |
| Desktop | `src/features/tenders/detail/*` | New presentation components and pure normalizer | Medium | N/A |
| Desktop | tender endpoint/detail tests | Contract, lifecycle, accessibility and interaction coverage | Medium | N/A |

No database, AI pipeline, prompts, cron, auth core, payment plan definition,
document download contract, or Tauri capability changes are planned.

## Rollout

1. Land and deploy the additive parent response with server-side entitlement
   tests first. The desktop schema remains compatible because it strips new
   fields.
2. Validate representative production-shaped fixtures: legacy seven-field,
   extended taxonomy, multi-document duplicate, partial, locked, and empty.
3. Land the desktop adapter and workbench after the parent contract is live.
4. Keep the old generic requirements sections as fallback until parity tests
   prove the analysis view covers legacy tenders; then avoid duplicate display.

## Verification

- Parent: focused route tests, entitlement/cache isolation tests, targeted
  TypeScript and lint. No build and no database command.
- Desktop: endpoint schema tests, pure normalization tests, component tests,
  keyboard/long-content/partial/error states, TypeScript, scoped lint,
  formatting, and `git diff --check`.
- Manual desktop QA at approximately 1024, 1280, 1440 and 1920 CSS pixels,
  plus 200% zoom.
