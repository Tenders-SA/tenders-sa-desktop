# Desktop — Tender Document Downloads Destination — Tasks (Slice 11)

> Read `requirements.md` and `design.md` before starting. Complete tasks in
> order; the contract checklist (`SPEC_CONTRACT.md`) must mirror this list.

## Status (2026-08-16)

- Spec created, `SPEC_CONTRACT.md` is `PENDING APPROVAL`. No implementation
  work until the user approves.

## Tasks

| # | Task | Pre-check | Verification |
|---|---|---|---|
| T1 | **Shared first-document resolution**: add `firstTenderDocumentId(documents)` helper in the tenders feature; unit-test empty/absent and populated cases | clean tree on this branch | `vitest` new helper cases |
| T2 | **Tender-detail screens Open-only**: `TenderDocumentsSection` loses batch + per-document Download buttons, rows become Open links (static text when `onOpenDocument` missing); strip `documents`/`savePort`/`documentActionPort` from `TenderDocumentsSection`, `TenderDetail`; `UnderstandStage` now passes `onOpenDocument`; update `tender-detail.test.tsx` + understand cases | T1 green | `vitest tender-detail` + updated `module-screens` cases |
| T3 | **Workspace surfaces Open-only**: `ApplicationWorkspace` "Tender documents" panel rows become Open links (batch + per-doc downloads removed); `DraftDocumentReferences` rows become Open-only (dirty-save guard intact); strip download props from `ApplicationWorkspace`, `WorkspaceBody`, `ApplicationWorkspaceRoute`, `DraftStage`, `DraftDocumentReferences` | T2 green | `vitest module-screens` + draft-stage cases; `tsc --noEmit` |
| T4 | **Menu button under Draft**: `WorkflowNavigation` gains `officialDownloads` (tenderId, firstDocumentId, documentCount) rendered directly under the Draft item with label "Official Tender Documents Downloads"; disabled + "No tender documents yet" at zero docs; `ApplicationWorkflowShell` + `WorkspaceBody` thread count + first id from `application.tender.documents` | T3 green | `vitest module-screens` workspace navigation cases |
| T5 | **Summary component under Preparation coverage**: `TenderAnalysisWorkbench` gains `onOpenDocuments` and a "Tender documents" block (count from `documentStats.total ?? documents.length`, single link, zero-doc/no-handler fallback copy) under the coverage block; `TenderDetailRoute` and `UnderstandStage` wire it to the canonical viewer route | T4 green | `vitest tender-detail` + understand cases |
| T6 | **Delete replaced paths**: remove `BatchDocumentDownloadButton.tsx`, `src/services/storage/batch-download.ts`, `src/services/storage/document-actions.ts`, `batch-download.test.ts`, `document-actions.test.ts`; remove remaining download/batch cases in screen tests; confirm `DocumentDownloadButton` still used only by viewer + vault | T5 green | `git grep -i "BatchDocumentDownloadButton\|batch-download\|document-actions" src/` empty; full suite green |
| T7 | **Gates + docs**: full `vitest`, `tsc --noEmit`, `eslint .`, `prettier --check .` zero errors; `capability-scope` and `endpoint-parity` unchanged and green; update `tasks.md`/`INTEGRATION_EVAL.md`; commit + push | T6 green | zero errors on all gates |
| T8 | **Human verification**: user opens a real tender document from TenderDetail and from an application workspace; verifies Open lands on the viewer, downloads still work there, no Download buttons remain on detail/workspace rows, both new entry points land on the same viewer screen, and a zero-document tender shows the disabled copy | T7 shipped | DONE — recorded in `INTEGRATION_EVAL.md` |