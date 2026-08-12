# Desktop tender analysis workbench — requirements

## Status

Planning complete; implementation pending approval.

## Evidence and current state

- The desktop tender window exists at `src/features/tenders/TenderDetail.tsx`.
  It renders core metadata, three defensive requirement fields, documents, and
  the existing pursue/save actions.
- Its adapter, `src/services/api/endpoints/tenders.ts`, deliberately projects
  no analysis fields. Nested `documents[].analyses[]` from the parent response
  are therefore discarded.
- The existing parent handler, `src/app/api/tenders/[id]/route.ts`, already
  loads `documents.analyses`, but formats only seven legacy fields. It omits
  extended taxonomy sections, structured evaluation, extraction provenance,
  and the tender-level `aiSummary` / `aiKeyRequirements` presentation fields.
- The web application presents the same stored records through
  `TenderAIChecklistServer.tsx`, `DocumentAnalysisSection.tsx`, and
  `ActiveTenderLayout.tsx`. These are references for ordering and semantics,
  not components to copy into the desktop app.
- The canonical AI pipeline is unchanged: `/api/cron/tender-pipeline` →
  `PipelineOrchestrator` → `extract`, `index`, `analyze`, `rewrite`. This feature
  only reads its persisted output.
- The desktop already owns `SubscriptionEndpoint.getFeatureAccess()` and the
  `documentAnalysis` entitlement key. It must remain the entitlement source.

## Objective

Turn the tender detail window into a desktop analysis workbench that helps a
company decide whether to pursue an opportunity and move directly into tender
preparation, with **AI-Analyzed Compliance Requirements** as the dominant
decision-support surface.

## Functional requirements

### R1 — Complete read contract

1. The parent detail response shall expose the stored analysis fields needed
   by the existing web presentation: submission guidelines, returnable
   documents, evaluation criteria (text and structured), technical
   specifications, methodology, experience and qualifications, quality,
   pricing/financial requirements, compliance, B-BBEE, health and safety,
   environmental, contractual/special conditions, local content, HDI or
   subcontracting, dates, contacts, extended taxonomy sections, document
   identity, confidence, extraction method/version, and extracted time when
   those values exist.
2. It shall expose `aiSummary` and `aiKeyRequirements` when present.
3. Fields shall be additive and nullable/optional. Older and partly analysed
   tenders must remain readable.
4. The response shall not include extracted document text, prompts, model raw
   output, chunks, embeddings, queue state, or internal errors.

### R2 — Entitlement and confidentiality

1. The parent must enforce `documentAnalysis` access before returning analysis
   text; hiding it only in the desktop UI is insufficient.
2. An entitled response may contain the full analysis projection.
3. A non-entitled response may contain only safe availability metadata such as
   state and counts, never blurred or hidden requirement text.
4. A feature-access outage must render as unavailable/retryable, not as a
   false upgrade decision.

### R3 — Emphasised compliance view

1. The first substantive panel after the tender decision header shall be
   titled **AI-Analyzed Compliance Requirements**.
2. It shall consolidate actionable points across all analysed documents,
   group them by procurement category, remove empty/noise values, and suppress
   exact or near duplicates.
3. Compliance/regulatory, returnable documents, submission rules, eligibility,
   B-BBEE/local-content, mandatory briefings, and health/safety requirements
   shall appear before descriptive or advisory analysis.
4. Every point shall retain a source-document label when provenance exists.
5. “AI analysed” must never be represented as a legal determination. The panel
   shall tell the user to verify requirements against the official documents.

### R4 — Full analysis explorer

1. All meaningful analysis sections shall remain accessible after the
   consolidated compliance view.
2. The primary/specification document shall be open by default; supporting
   documents shall use collapsible document groups.
3. Structured evaluation criteria shall render as readable criteria, weights,
   phases, and thresholds rather than raw JSON.
4. Users shall be able to filter or jump to Compliance, Submission,
   Evaluation, Technical, Financial, Dates, and Contacts without losing their
   position in the tender.
5. Long content shall be scrollable and selectable; no requirement may be
   truncated without an explicit expansion control.

### R5 — Desktop preparation workflow

1. The window shall use the available desktop width rather than the current
   narrow article column.
2. A sticky tender header shall retain reference, organisation, closing state,
   save state, and the existing start/continue-application action.
3. A left section navigator, central analysis canvas, and right preparation
   rail may be used at wide widths. At narrower widths they shall collapse in
   logical reading order.
4. The preparation rail shall show document processing coverage and the next
   human action. It shall route into the existing Application Workspace for
   company comparison, readiness gaps, task tracking, and response drafting.
5. The detail window shall not submit a bid, make a pursue decision, or start
   new AI processing automatically.

### R6 — Honest lifecycle states

The interface shall distinguish:

- no source documents;
- documents still processing;
- analysis pending;
- partial analysis (some documents complete);
- complete analysis;
- analysis failed/unavailable;
- access locked; and
- entitled analysis with no meaningful extracted points.

It must never say that a tender has no requirements merely because analysis is
pending or unavailable.

## Non-goals

- No new AI prompt, model call, queue, cron, extraction path, embedding path,
  analysis trigger, or local desktop analysis cache.
- No duplication of web React components or Next.js-only presentation code.
- No company-versus-tender gap calculation inside the detail view; that remains
  in Application Workspace.
- No tender submission, pricing decision, or compliance approval by AI.
- No database or Prisma schema change.

## Success criteria

- An entitled user can see every meaningful persisted analysis section.
- Compliance requirements are visible above the generic description and can
  be scanned without opening each source document.
- Every rendered requirement can identify its source document when supplied.
- Locked users receive no analysis text in the network payload.
- Existing tenders with no/legacy/partial analysis still render correctly.
- The existing application-preparation action remains the primary next step.
