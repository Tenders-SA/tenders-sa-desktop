# Desktop — Tender Document Downloads Destination — Requirements (Slice 11)

**Context**: Today every surface that lists tender documents offers a
per-document **Download** button (and a **Download all** batch button) that
resolves through the parent's `download-url?requireR2=1` route and writes
straight to disk, alongside an **Open** button that navigates into the
authenticated in-app document viewer (`/tenders/:tenderId/documents/:documentId`).

User directive (2026-08-16): **tender-document downloads happen where "Open"
leads.** The Open screen (the viewer) is the single place a tender document is
downloaded. Everywhere else, document links are *Open links only*:

1. All existing **Open** links stay Open links and keep leading to the Open
   screen exactly as they do today.
2. **Download links are removed from the tender-detail screens.**
3. On the **application workspace** screens, directly **under the Draft menu
   item** in the workflow stage navigation, a new button **"Official Tender
   Documents Downloads"** leads to the same screen Open leads to.
4. On the **tender detail page**, directly **under the Preparation coverage
   sidebar component** (the `TenderAnalysisWorkbench` aside), a new **Tender
   documents** component shows the **total number of documents** and a single
   link to the tender document downloads screen again.

User-confirmed scope decisions (2026-08-16):

- Workspace per-document downloads are removed too: the workspace "Tender
  documents" panel and the Draft-stage references pane become Open-only. The
  new menu button is the download entry point.
- When a tender has zero documents, the new buttons/components stay visible
  with a count (`0`) and a "No tender documents yet" explanation, with the
  link disabled — they never navigate nowhere.

**Parent contract** (unchanged from Slice 7, read from parent source
2026-08-09):

- `GET /api/v1/documents/[documentId]/download-url?requireR2=1` — JWT + an
  `APPLICATION_ASSIST` entitlement check (403 otherwise); resolves, in order:
  1. stored `r2StorageUrl` on `https://docs.tenders-sa.org/docs/...`
  2. constructed URL from `r2StorageKey`
  3. the Cloudflare Worker resolver (`https://etenders-api.tenders-sa.org`)
  4. stored worker `/api/document?id=...` URLs; `requireR2=1` rejects plain
     government `downloadUrl` fallbacks. Response: `{downloadUrl, fileName,
     source}`.
- The resolved URL is a **binary document on one of two serving origins**:
  `docs.tenders-sa.org` (R2) or `etenders-api.tenders-sa.org/api/document`
  (Worker). Neither needs an API key to fetch.

## Requirements

| # | Requirement | Verification |
|---|---|---|
| R-01 | **Open screen is the single download destination.** The authenticated document viewer (`/tenders/:tenderId/documents/:documentId`, `TenderDocumentViewer`) keeps its existing download affordances (header compact download button, unsupported-preview download button) and its Open behaviour. No viewer changes. | viewer tests stay green unmodified |
| R-02 | **Open links stay Open links.** Every document row that offers Open today keeps navigating to the same viewer route with the same behaviour (`onOpenDocument` semantics unchanged; route-based navigation through the workspace's dirty-save guard where one exists). | screen tests: same route asserted |
| R-03 | **Downloads removed from tender-detail screens.** `TenderDocumentsSection` (used by `TenderDetail` and the workspace `UnderstandStage`): per-document Download buttons and the batch "Download all" button are removed; each row becomes an Open link. When no Open handler is wired the row keeps rendering as static text (pure-read contract preserved). | `vitest tender-detail`; updated `module-screens` understand cases |
| R-04 | **Workspace "Tender documents" panel is Open-only.** `ApplicationWorkspace`'s Tender documents panel loses the batch button and per-document Download buttons; rows become Open links to the viewer. The panel keeps its count header. | `vitest module-screens` workspace cases |
| R-05 | **Draft-stage references pane is Open-only.** `DraftDocumentReferences` ("Official tender files") loses its compact per-document Download buttons; Open buttons remain and keep navigating through the draft's dirty-save guard. | updated draft-stage screen tests |
| R-06 | **New menu button "Official Tender Documents Downloads".** In the workspace stage navigation sidebar (`WorkflowNavigation` inside `ApplicationWorkflowShell`), a button rendered directly under the **Draft** stage item leads to the Open screen (viewer) for the tender's first document. With zero documents the button is disabled and shows "No tender documents yet". | `vitest module-screens` workspace navigation cases |
| R-07 | **New "Tender documents" component under Preparation coverage.** On the tender detail page (and wherever `TenderAnalysisWorkbench` is reused, e.g. `UnderstandStage`), directly under the Preparation coverage block in the component's aside, a component shows the **total number of documents** (`documentStats.total` falling back to `documents.length`) and a single link to the tender document downloads screen (viewer, first document). With zero documents or no Open handler the count renders with "No tender documents yet" and no link. | `vitest tender-detail` + understand cases |
| R-08 | **One canonical destination.** Both new entry points and every Open link resolve to the same route: `/tenders/:tenderId/documents/:<firstDocumentId>` where `<firstDocumentId>` is the first entry of `tender.documents` in server order, resolved by one shared helper so the two surfaces cannot drift. | helper unit test + screen assertions |
| R-09 | **Replaced paths deleted.** `BatchDocumentDownloadButton.tsx`, `src/services/storage/batch-download.ts` and `src/services/storage/document-actions.ts` (plus `batch-download.test.ts`, `document-actions.test.ts` and the batch/download cases in screen tests) are deleted — no orphaned code claims to offer downloads after the UI is gone. `DocumentDownloadButton` itself stays (viewer + DocumentVault still use it). | `git grep` for the deleted identifiers returns nothing |
| R-10 | **Download-client props reduced to where downloads exist.** The `documents`/`savePort`/`documentActionPort` prop threading is stripped from `TenderDetail`, `TenderDocumentsSection`, `UnderstandStage`, `ApplicationWorkspace`, `ApplicationWorkspaceRoute`, `DraftStage` and `DraftDocumentReferences`; the `documents` client and `savePort` remain on the routes that need them (viewer route, DocumentVault). `onOpenDocument`/`tenderId`+`firstDocumentId` navigation props replace them. | `tsc --noEmit` clean; diff shows prop removal only |
| R-11 | **Verification gates.** Full `vitest`, `tsc --noEmit`, `eslint .`, `prettier --check .` — zero errors. Capability allow-list, endpoint parity and the parent resolver contract are untouched (no new capability, no new route, downloads still use `download-url?requireR2=1` + the two serving origins). | gates + `vitest capability-scope` + `vitest endpoint-parity` green |

## Explicitly out of scope

- **DocumentVault** (company compliance documents) keeps its download buttons —
  a different document domain, excluded by Slice 7 the same way.
- Viewer behaviour, copy or capability changes (no new Tauri scope).
- Batch download as a feature: re-adding it as an in-viewer action is a future
  slice; this slice only deletes the out-of-place entry points.
- Parent-repo / backend / Cloudflare changes; the `download-url` resolver and
  the two serving origins are unchanged.