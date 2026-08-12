# Desktop tender analysis workbench — design

## Data flow

```text
Existing GET /api/tenders/[id]
  → desktop Zod boundary retains nested documents[].analyses[]
  → pure desktop normalizer consolidates and deduplicates points
  → tender detail workbench presents compliance first
  → existing application action opens preparation workspace
```

The desktop schema mirrors only fields already returned by the route. Unknown
extra response fields remain harmlessly stripped.

## Desktop composition

- Wide tender header and core procurement facts.
- Dominant compliance/submission analysis card with counts and source files.
- Full analysis groups for evaluation, technical, financial, dates and contact.
- Sticky coverage rail derived from current document analysis records.
- Submission checklist and tender-event timeline.
- Description, eligibility, B-BBEE and official document downloads remain
  available below the decision-support content.

## Files

| File | Responsibility |
|---|---|
| `src/services/api/endpoints/tenders.ts` | Existing response projection |
| `src/features/tenders/detail/analysis-presentation.ts` | Pure consolidation and ordering |
| `src/features/tenders/detail/TenderAnalysisWorkbench.tsx` | Desktop analysis presentation |
| `src/features/tenders/TenderDetail.tsx` | Tender orchestration and application facts |
| Focused tests | Existing-contract and UI regressions |

No parent repository file is modified.
