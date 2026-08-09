# Desktop — Tender Document Download — SPEC_CONTRACT (Slice 7)

- **Status**: `APPROVED`
- **Date**: 2026-08-09
- **Scope**: Slice 7 — tender document download (R-D1..R-D8).
- **Approved by**: user (in-session directive, 2026-08-09)
- **Approval date**: 2026-08-09

## Contract checklist (mirrors tasks.md)

| # | Item | Contract |
|---|---|---|
| C1 | Absolute-URL download | `DownloadOptions.url` on the existing generic `download()` — https only, origin restricted to `docs.tenders-sa.org` + `etenders-api.tenders-sa.org`, keyless, `retry: "never"`, shared timeout/cancel/error policy; invalid URL → typed error |
| C2 | Endpoint method | `DocumentsEndpoint.downloadTenderDocument(id)` — resolve via the parent `download-url?requireR2=1`, then fetch the resolved URL; `timeoutMs: 120_000`; filename precedence Content-Disposition > payload `fileName` > derived from content type |
| C3 | Least-privilege capability | exactly two scoped http entries added — `https://docs.tenders-sa.org/docs/*`, `https://etenders-api.tenders-sa.org/api/document*`; no bare origins, no `shell:`, no `opener:`, no new fs scope |
| C4 | Capability test | `capability-scope.test.ts` updated deliberately: scoped-origin assertions, shell/opener/static-fs still forbidden |
| C5 | Shared download UI | one `DocumentDownloadButton` per document in TenderDetail.DocumentsSection and ApplicationWorkspace's documents panel; per-document `Downloading…` state; saves via the Slice 6 `saveDownload` port; dialog cancel silent; errors via `describeApiError(error, "the document")` |
| C6 | Wiring | routes pass `clients.documents` + default `createTauriSavePort()`; fixtures gain `downloadTenderDocument: idle()`; parity pins `download-url` + `requireR2` |
| C7 | Verification gates | full `vitest`, `tsc --noEmit`, `eslint .`, `prettier --check .` — zero errors |
| C8 | Human verification | user downloads a real document from both screens; filename/dialog/cancel/403 copy verified; recorded in `INTEGRATION_EVAL.md` |

## Explicitly out of contract

Document preview/opening, batch download, vault download button UI, worker
or parent-repo changes, government-source fallback URLs.

## Non-negotiable constraints

- The parent's `download-url` route is the **only** resolver (INT-4): no
  direct fetches of `sourceUrl`, no client-side R2 key construction.
- The external fetch adds **no** auth headers and never triggers session
  loss; session-loss stays scoped to `path`-based API calls.
- `ApiError.message` / parent `error` strings never shown verbatim.
- `capability-scope.test.ts` may only change as specified in C4 — an edit
  that widens the http allow-list beyond the two scoped entries fails CI by
  design.
- No `npm run build` / `next build` / prisma migrations (repo rule).
