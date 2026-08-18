# Desktop — Tender Document Downloads Destination — Design (Slice 11)

## Canonical destination and shared resolution

One helper owns "the first document of this tender":

```ts
// src/features/tenders/document-label.ts (or a new sibling)
export function firstTenderDocumentId(
  documents: ReadonlyArray<{ id: string }> | undefined,
): string | undefined {
  return documents?.[0]?.id;
}
```

Every Open link and both new entry points navigate to
`/tenders/${tenderId}/documents/${firstTenderDocumentId(tender.documents)}`
— the same route `Open` uses today (R-02, R-08). The viewer route already
handles the missing-document case; the entry points never navigate when no
first document exists (R-06, R-07).

```
user presses any Open link / new entry point
  -> navigate('/tenders/:tenderId/documents/:firstDocumentId')   (route-based)
  -> TenderDocumentViewerRoute loads the tender
  -> TenderDocumentViewer opens the document  (download happens HERE, R-01)
```

## 1. Tender-detail screens — `TenderDocumentsSection` becomes Open-only

`src/features/tenders/detail/TenderDocumentsSection.tsx` (shared by
`TenderDetail` and the workspace `UnderstandStage`):

- Delete the `BatchDocumentDownloadButton` block and the
  `DocumentDownloadButton` rows (R-03, R-09).
- Each row becomes an Open control: document name (fileName +
  documentCategory, as the workspace panel formats today) with an **Open**
  button that calls the existing `onOpenDocument?.(document.id)` prop — the
  same prop and navigation the route already wires for `TenderDetail` (R-02).
- When `onOpenDocument` is undefined the row renders the name as static text
  (the pure-read contract, exactly how the no-download fallback renders
  today).
- Props change: drop `documents`, `savePort`, `documentActionPort`; keep
  `tender`, `onOpenDocument` (R-10).

`TenderDetail.tsx`: remove the `documents`/`savePort`/`documentActionPort`
props and their pass-through; the route's `onOpenDocument` wiring is
unchanged (R-02). `UnderstandStage.tsx` now passes `onOpenDocument` too —
currently it does not — so its rows become Open links as required (R-03).

## 2. Application workspace — panels and reference pane become Open-only

`src/features/applications/ApplicationWorkspace.tsx`, "Tender documents"
panel (R-04):

- Remove the batch button and per-document `DocumentDownloadButton` rows;
  render per-row Open links using the same navigate-to-viewer call the rows
  already use for Open today.
- Drop the `documents`/`savePort`/`documentActionPort` props from
  `ApplicationWorkspace`/`WorkspaceBody` and from `ApplicationWorkspaceRoute`
  (R-10). The route keeps passing `tenders` and `eligibility`.

`src/features/applications/workflow/DraftDocumentReferences.tsx` (R-05):

- Replace the compact `DocumentDownloadButton` rows (download + open) with
  Open-only rows. Open keeps going through `onOpenDocument` →
  `requestNavigation`, so the draft dirty-save guard still applies.
- Drop `documentsEndpoint` and `savePort` props; keep `tenderId`,
  `onOpenDocument`. `DraftStage` stops passing the download client and save
  port to the references pane (R-10).

## 3. Workspace menu button — "Official Tender Documents Downloads" under Draft

`src/features/applications/workflow/WorkflowNavigation.tsx` (R-06):

- New optional prop:
  ```ts
  officialDownloads?: {
    tenderId: string;
    firstDocumentId?: string;
    documentCount: number;
  };
  ```
- Rendered as an unnumbered action directly **after the Draft stage `<li>`**
  (before Review & Export), styled as a nav-row button consistent with the
  stage items, label **"Official Tender Documents Downloads"** with a small
  secondary line showing the document count.
- Click → `navigate('/tenders/:tenderId/documents/:firstDocumentId')`.
  When `firstDocumentId` is undefined the button is `disabled` and the
  secondary line reads "No tender documents yet" (R-06).

`ApplicationWorkflowShell` gains `tenderDocumentsCount: number` and
`firstDocumentId?: string` props and passes them to `WorkflowNavigation`.
`WorkspaceBody` (ApplicationWorkspace) supplies them from
`application.tender.documents` via the shared helper (R-08).

## 4. Tender detail page — "Tender documents" component under Preparation coverage

`src/features/tenders/detail/TenderAnalysisWorkbench.tsx` (R-07):

- New sibling block inside the existing `<aside>` (the "Preparation coverage"
  sidebar), directly under the coverage block, with a top border divider:
  - Heading: **"Tender documents"**
  - Count: `tender.documentStats?.total ?? tender.documents?.length ?? 0`
    (the same resolution the workbench header uses for its
    "X of Y documents" line today)
  - Single link: **"View tender documents"** → the canonical viewer route via
    a new optional prop `onOpenDocuments?: () => void`.
  - With count `0` or `onOpenDocuments` missing: the count renders with
    "No tender documents yet" and no link (R-07, pure-read contract).
- New optional prop on `TenderAnalysisWorkbench`: `onOpenDocuments?`.
  `TenderDetail` passes it (wired by `TenderDetailRoute` using the shared
  helper on the loaded tender — or directly from the component with
  `firstTenderDocumentId` and `useNavigate` if the component is allowed to
  navigate; prefer the route/callback-injection pattern used by
  `TenderDocumentsSection` so tests stay router-free). `UnderstandStage`
  passes the same callback from its own scope.

## 5. Deletions (R-09)

- `src/features/tenders/BatchDocumentDownloadButton.tsx`
- `src/services/storage/batch-download.ts`
- `src/services/storage/document-actions.ts`
- `src/tests/batch-download.test.ts`, `src/tests/document-actions.test.ts`
- Download/batch cases in `src/tests/tender-detail.test.tsx` and
  `src/tests/module-screens.test.tsx` are replaced by Open-link cases.

`DocumentDownloadButton.tsx` is **kept**: `TenderDocumentViewer` (header +
unsupported preview) and `DocumentVault` still use it (R-01, out of scope).
No Tauri capability, Rust command or `default.json` entry is touched: the
viewer's download uses the same two serving origins already allowed.

## 6. Tests

- Helper: `firstTenderDocumentId` — undefined on empty/absent, first id on a
  populated list.
- TenderDetail: rows render Open links and no Download button; no batch
  button; summary component shows count + link; zero-doc tender shows the
  disabled copy; no-handler renders static text.
- Understand: `onOpenDocument` now wired; rows are Open links; summary shown.
- Workspace: panel rows are Open links; nav shows "Official Tender Documents
  Downloads" directly under Draft; disabled + "No tender documents yet" at
  zero docs; clicking navigates to the canonical viewer route.
- Draft references: Open-only rows; dirty guard still intercepts navigation.
- Gates: full `vitest`, `tsc --noEmit`, `eslint .`, `prettier --check .`;
  `capability-scope` and `endpoint-parity` suites unchanged and green;
  `git grep` for `BatchDocumentDownloadButton|batch-download|document-actions`
  returns nothing in `src/`.
- Human verification (final task): user opens a real tender from the detail
  page and from a workspace, confirms Open lands on the viewer, downloads
  still work there, no Download buttons remain on detail/workspace rows, both
  new entry points land on the same screen, and a zero-document tender shows
  the disabled copy.