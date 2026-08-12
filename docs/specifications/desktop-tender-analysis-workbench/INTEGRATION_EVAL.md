# Integration evaluation — desktop tender analysis workbench

## Result

**Viable with one parent API prerequisite.** The analysis already exists and is
already loaded by the existing tender detail handler. The missing pieces are
complete safe serialization, entitlement enforcement, and desktop presentation.

## Existing owners to reuse

| Concern | Existing owner |
|---|---|
| AI production | Canonical `extract → index → analyze → rewrite` pipeline |
| Stored analysis | `TenderDocumentAnalysis` attached to tender documents |
| Web semantics/order | `TenderAIChecklistServer`, `DocumentAnalysisSection`, section dedup/prioritization utilities |
| Tender read | Existing `GET /api/tenders/[id]` |
| Feature entitlement | Existing `documentAnalysis` feature-service decision and desktop `SubscriptionEndpoint` |
| Company comparison | Existing desktop Application Workspace compliance/readiness panels |
| Document access | Existing desktop R2-backed document download client |

## Confirmed gap

The parent route currently maps nested analysis to seven legacy fields and the
desktop Zod schema discards the nested analyses entirely. Extended analysis is
therefore not available to the desktop even though it has already been produced.

## Key risk

The existing route uses a shared tender-detail cache. Entitled analysis must not
be cached in a way that lets a locked user receive another user's allowed
payload. Implementation must separate the cached base tender from the
per-request access-controlled projection or prove an equivalently safe cache
key strategy.

## Repository sequencing

1. Parent specification, security tests, additive route projection, deploy.
2. Desktop contract adoption and workbench implementation.
3. Parent and desktop changelogs and staged release validation.

## Governance conclusion

- This is an enhancement of existing owners, not a greenfield pipeline.
- No database migration is required.
- No frozen module is currently expected to change.
- Parent API implementation still requires its own approved parent spec under
  `.kiro/specs/` before code is written.
- This specification remains pending approval and contains no implementation
  authorization.
