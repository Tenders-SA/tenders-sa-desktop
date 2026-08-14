# Desktop — Document Actions — Requirements (Slice 8)

## Context

### Internal viewer amendment — approved 2026-08-14

The user has superseded the OS-launch decision for tender documents. Every
tender-document **Open** action must now navigate to one canonical internal
viewer, while **Download** continues saving the original bytes. The existing
authenticated resolver/download contract and tender-detail analysis payload are
sufficient; the parent repository remains read-only.

- **Approved scope**: user approved document opening, Document Vault downloads,
  and batch tender-document downloads on 2026-08-09. Government-source fallback
  downloads were explicitly excluded.
- **Recent related work**: Slice 6 (`b49be73`) introduced binary save-to-disk;
  Slice 7 (`16ee61e`) added the canonical tender-document resolver/download path;
  `bb4de39` fixed the workspace summary decoder; live verification through Slice
  7 was completed by `4b36095`.
- **Reality check — Enhance Existing**: `DocumentsEndpoint.downloadTenderDocument`
  already performs the only permitted resolve + binary-fetch flow;
  `DocumentDownloadButton` already owns per-document save UI;
  `save-download.ts` already owns dialog-scoped writes; `DocumentVault` already
  lists company documents with the same endpoint. No opener or batch coordinator
  exists. This slice extends those owners and creates no parallel HTTP client.
- **Frozen-module impact**: desktop-only files; no parent Tier 1/2 module, parent
  route, database schema, document-analysis pipeline, auth, or payment code changes.

## Objective

- **Why**: users should be able to retrieve, inspect, and collect documents without
  switching back to the website or repeating one save flow per tender document.
- **Goal**: add safe OS opening, Vault downloads, and one-action batch downloads by
  composing the existing resolver and storage ports.
- **Permanent non-goal**: government/source URL fallback is explicitly rejected,
  not deferred. Do not add it to a later task without a new user decision.
- **Other non-goals**: upload, preview inside the webview,
  ZIP creation, background downloads, retrying paid/API mutations, or parent changes.

## Functional Requirements

- [ ] R-DA8: `/tenders/:tenderId/documents/:documentId` renders a dedicated,
  addressable three-pane tender-document verification workspace.
- [ ] R-DA9: The document rail renders every tender document in server order
  with a readable filename, file icon, processing/analysis status and exact-id
  selection. The rail and analysis pane are independently collapsible.
- [ ] R-DA10: Selecting a document downloads its original bytes once through
  `DocumentsEndpoint.downloadTenderDocument`; it never fetches metadata
  `sourceUrl` or a raw/exposed storage URL.
- [ ] R-DA11: PDFs render inside the desktop application with scrolling, page
  count/navigation and zoom. Unsupported formats show honest metadata and an
  explicit Download fallback instead of failing silently.
- [ ] R-DA12: The analysis pane is scoped only to the selected document and
  renders its summary, key points, submission guidelines, evaluation criteria,
  dates, contacts, technical, financial and compliance requirements, confidence
  and honest pending/empty/failed states.
- [ ] R-DA13: Every tender-document Open action in Tender Detail, Application
  Workspace and Draft references navigates to the internal viewer using known
  tender/document context. The native temp-file opener is no longer a tender-
  document Open implementation.

- [x] R-DA1: A user can press **Open** on a tender document; the client resolves and
  downloads through `downloadTenderDocument`, writes beneath
  `$TEMP/tenders-sa/**`, and opens it in the OS-associated viewer.
- [x] R-DA2: Opening has a per-document `Opening…` single-flight state, fixed safe
  error copy, and never exposes or accepts a government/source URL.
- [x] R-DA3: Every company document row in Document Vault has the existing
  per-document Download flow, including save dialog, silent cancel, filename
  fallback, and entitlement/error copy.
- [x] R-DA4: TenderDetail and ApplicationWorkspace offer **Download all** only when
  at least two tender documents exist. One directory picker is shown, then each
  document is resolved and downloaded exactly once and written to that directory.
- [x] R-DA5: Batch filenames are sanitised and collision-safe. Duplicate names gain
  deterministic `-2`, `-3`, … suffixes without overwriting an earlier file.
- [x] R-DA6: Batch processing is sequential (bounded memory/network), exposes
  `Downloading n of m…`, is single-flight, treats folder-picker cancel silently,
  and reports a final saved/failed count without discarding successful files.
- [x] R-DA7: Existing single-document Download behavior remains unchanged.

## Non-Functional Requirements

- [ ] SEC-DA3: Preview object URLs are created only from authenticated bytes,
  revoked on selection/unmount, never logged and never persisted.
- [ ] PERF-DA2: Only the selected document is loaded/rendered; document changes
  abort stale requests and release the prior preview/PDF resources.
- [ ] A11Y-DA1: Viewer, page/zoom controls, document selection, collapse controls,
  errors and fallback downloads are named and keyboard operable.
- [ ] REL-DA2: A preview or analysis failure degrades only its pane; the document
  list and Download action remain usable.

- [x] SEC-DA1: Opener access is path-scoped to `$TEMP/tenders-sa/**`; no URL opener,
  shell permission, wildcard path, or broad filesystem read/write scope is granted.
- [x] SEC-DA2: Batch writes only to a directory explicitly selected by the user;
  no static arbitrary-directory scope is added.
- [x] PERF-DA1: Batch downloads are sequential and hold at most one document payload
  awaiting write at a time.
- [x] UX-DA1: Every action is explicit, keyboard-operable, and labelled in text;
  cancel remains a silent no-op.
- [x] REL-DA1: A failed item does not abort or delete already-saved batch items.

## Integration Requirements

- [ ] INT-DA5: Extend the existing route/client/component owners; do not add an
  HTTP client, parent endpoint, analysis path, native opener path or persistence.
- [ ] INT-DA6: Preserve the consolidated Tender Analysis Workbench unchanged;
  the new route presents selected-source verification only.

- [x] INT-DA1: Reuse `DocumentsEndpoint.downloadTenderDocument`; do not add an API
  route, alternate resolver, storage key construction, or external origin.
- [x] INT-DA2: Extend the existing save/storage port family and
  `DocumentDownloadButton`; do not introduce a second binary transport.
- [x] INT-DA3: Update capability tests deliberately for exactly
  `dialog:allow-open`, temp-path filesystem write scope, and path-only opener access.
- [x] INT-DA4: Government-source fallback URLs remain excluded.

## Success Criteria

- [x] Open launches a real downloaded document in its OS viewer.
- [x] Vault Download saves a real company document.
- [x] Download all saves every available tender document after one folder choice,
  preserves duplicate filenames safely, and reports partial failures honestly.
- [x] Existing single-download, capability, endpoint-parity, and screen tests pass.
- [x] Full Vitest, TypeScript, ESLint, Prettier, and Rust checks pass.
