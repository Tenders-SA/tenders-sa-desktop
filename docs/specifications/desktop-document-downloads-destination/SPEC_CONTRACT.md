# Desktop — Tender Document Downloads Destination — SPEC_CONTRACT (Slice 11)

- **Status**: `PENDING APPROVAL`
- **Date**: 2026-08-16
- **Scope**: Slice 11 — tender-document downloads move to the Open screen
  (R-01..R-11).

## Contract checklist (mirrors tasks.md)

| # | Item | Contract |
|---|---|---|
| C1 | Shared resolution | one `firstTenderDocumentId(documents)` helper — first entry of `tender.documents` in server order; `undefined` on empty/absent; every new entry point and Open link resolves through it |
| C2 | Tender-detail screens Open-only | `TenderDocumentsSection` (TenderDetail + UnderstandStage): batch and per-document Download removed; rows are Open links (static text when no handler); `documents`/`savePort`/`documentActionPort` props stripped from section + `TenderDetail`; `UnderstandStage` wires `onOpenDocument` |
| C3 | Workspace surfaces Open-only | workspace "Tender documents" panel and `DraftDocumentReferences` rows are Open links only; download props stripped from `ApplicationWorkspace`/`WorkspaceBody`/`ApplicationWorkspaceRoute`/`DraftStage`/`DraftDocumentReferences`; the draft dirty-save guard keeps intercepting Open navigation |
| C4 | Menu button under Draft | "Official Tender Documents Downloads" rendered directly under the Draft stage item in `WorkflowNavigation`; navigates to the canonical viewer route; disabled + "No tender documents yet" at zero documents; count surfaced |
| C5 | Summary under Preparation coverage | "Tender documents" block in the `TenderAnalysisWorkbench` aside, directly under the Preparation coverage block: total count (`documentStats.total` → `documents.length` → 0) + single link to the same viewer route; count + "No tender documents yet" and no link at zero docs or without a handler |
| C6 | Canonical destination | both new entry points and all Open links land on `/tenders/:tenderId/documents/:<firstDocumentId>` — the Open screen, unchanged viewer |
| C7 | Replaced paths deleted | `BatchDocumentDownloadButton.tsx`, `services/storage/batch-download.ts`, `services/storage/document-actions.ts` and their tests deleted; `git grep` for those identifiers in `src/` returns nothing; `DocumentDownloadButton` kept for viewer + DocumentVault only |
| C8 | Contract surfaces untouched | no Tauri capability change, no Rust change, no route addition, `capability-scope` and `endpoint-parity` suites unchanged and green; downloads still resolve via `download-url?requireR2=1` inside the viewer |
| C9 | Verification gates | full `vitest`, `tsc --noEmit`, `eslint .`, `prettier --check .` — zero errors |
| C10 | Human verification | user verifies Open → viewer, downloads still work in the viewer, no Download buttons on detail/workspace rows, both new entry points land on the same screen, zero-document copy; recorded in `INTEGRATION_EVAL.md` |

## Explicitly out of contract

- DocumentVault download buttons (company compliance documents).
- Viewer behaviour, copy or capability changes.
- Batch download re-added inside the viewer (future slice).
- Parent-repo / backend / Cloudflare changes.

## Non-negotiable constraints

- The parent's `download-url` route is the **only** resolver (INT-4) — the
  viewer keeps it; nothing here introduces a second download path.
- `ApiError.message` / parent `error` strings never shown verbatim (existing
  `describeApiError` copy rule carries over to any new error surface).
- No new Tauri capability: the existing two serving-origin scopes are enough
  because downloads still happen only in the viewer.
- Route-based Open navigation keeps the existing dirty-save guard in the
  Draft stage — never bypass it.
- No `npm run build` / `next build` / prisma migrations (repo rule).
- A replacement is not complete until the replaced path is deleted (C7) —
  orphaned download code is a defect.
