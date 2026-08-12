# Desktop tender analysis workbench — requirements

**Status:** Approved and implemented from existing read contracts, 2026-08-12.

## Boundary

The main Tenders-SA repository is read-only. The desktop consumes the existing
authenticated `GET /api/tenders/[id]` response and existing document-download
and application-assistance APIs. It never reads the database, modifies a parent
route, or creates/triggers document analysis.

## Existing tender detail data to retain

- Tender identity, organisation, status, type, province, delivery, description,
  estimated value, closing date, categories, source and timestamps.
- Requirements, eligibility, B-BBEE, required documents, ordered submission
  requirements and tender timeline events.
- Organisation contact and classification information.
- Document metadata, processing status, summaries, key points and downloads.
- Every existing `documents[].analyses[]` record: submission guidelines,
  evaluation criteria, dates, contacts, technical specifications, financial
  requirements, compliance requirements, confidence and analysis date.

## Presentation requirements

- Put **AI-Analyzed Compliance Requirements** before generic description.
- Consolidate the existing analysis across all tender documents, remove empty
  and duplicate points, group by business meaning and retain the source file.
- Show evaluation, technical, financial, date and contact intelligence after
  compliance and submission information.
- Show submission requirements and timeline as application-ready checklists.
- Derive complete/partial/pending coverage locally from documents and
  `documentStats`; never depend on an invented server field.
- Preserve honest no-analysis and processing states and direct users to verify
  official documents.
- Keep the existing start/continue application action as the next workflow.

## Non-goals

- No parent code, API, database, schema, prompt, AI client, queue or cron change.
- No new endpoint and no local AI analysis.
- Do not claim access to web-server-only fields that existing desktop read
  contracts do not return.
