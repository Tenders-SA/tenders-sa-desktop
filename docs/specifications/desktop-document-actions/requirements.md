# Desktop — Document Actions — Requirements (Slice 8)

## Context

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
- **Non-goals**: government/source URL fallbacks, upload, preview inside the webview,
  ZIP creation, background downloads, retrying paid/API mutations, or parent changes.

## Functional Requirements

- [ ] R-DA1: A user can press **Open** on a tender document; the client resolves and
  downloads through `downloadTenderDocument`, writes beneath
  `$TEMP/tenders-sa/**`, and opens it in the OS-associated viewer.
- [ ] R-DA2: Opening has a per-document `Opening…` single-flight state, fixed safe
  error copy, and never exposes or accepts a government/source URL.
- [ ] R-DA3: Every company document row in Document Vault has the existing
  per-document Download flow, including save dialog, silent cancel, filename
  fallback, and entitlement/error copy.
- [ ] R-DA4: TenderDetail and ApplicationWorkspace offer **Download all** only when
  at least two tender documents exist. One directory picker is shown, then each
  document is resolved and downloaded exactly once and written to that directory.
- [ ] R-DA5: Batch filenames are sanitised and collision-safe. Duplicate names gain
  deterministic `-2`, `-3`, … suffixes without overwriting an earlier file.
- [ ] R-DA6: Batch processing is sequential (bounded memory/network), exposes
  `Downloading n of m…`, is single-flight, treats folder-picker cancel silently,
  and reports a final saved/failed count without discarding successful files.
- [ ] R-DA7: Existing single-document Download behavior remains unchanged.

## Non-Functional Requirements

- [ ] SEC-DA1: Opener access is path-scoped to `$TEMP/tenders-sa/**`; no URL opener,
  shell permission, wildcard path, or broad filesystem read/write scope is granted.
- [ ] SEC-DA2: Batch writes only to a directory explicitly selected by the user;
  no static arbitrary-directory scope is added.
- [ ] PERF-DA1: Batch downloads are sequential and hold at most one document payload
  awaiting write at a time.
- [ ] UX-DA1: Every action is explicit, keyboard-operable, and labelled in text;
  cancel remains a silent no-op.
- [ ] REL-DA1: A failed item does not abort or delete already-saved batch items.

## Integration Requirements

- [ ] INT-DA1: Reuse `DocumentsEndpoint.downloadTenderDocument`; do not add an API
  route, alternate resolver, storage key construction, or external origin.
- [ ] INT-DA2: Extend the existing save/storage port family and
  `DocumentDownloadButton`; do not introduce a second binary transport.
- [ ] INT-DA3: Update capability tests deliberately for exactly
  `dialog:allow-open`, temp-path filesystem write scope, and path-only opener access.
- [ ] INT-DA4: Government-source fallback URLs remain excluded.

## Success Criteria

- [ ] Open launches a real downloaded document in its OS viewer.
- [ ] Vault Download saves a real company document.
- [ ] Download all saves every available tender document after one folder choice,
  preserves duplicate filenames safely, and reports partial failures honestly.
- [ ] Existing single-download, capability, endpoint-parity, and screen tests pass.
- [ ] Full Vitest, TypeScript, ESLint, Prettier, and Rust checks pass.

