# Desktop — Tender Document Download — Requirements (Slice 7)

**Context**: Both places that list tender documents — the TenderDetail screen
(`src/features/tenders/TenderDetail.tsx`) and the ApplicationWorkspace
"Tender documents" panel — render file names only and say *"Opening tender
documents is not available in this build."* The parent's resolution route
exists and the desktop already has the binary-download + save-to-disk
machinery (Slice 6). This slice connects them.

**Parent contract** (read from parent source today, 2026-08-09):

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
| R-D1 | Resolve a tender document through the parent's `download-url` route with `requireR2=1`; never reach a government `sourceUrl` or storage bucket directly (INT-4). | endpoint contract test pins route + query + auth header |
| R-D2 | Fetch the resolved binary from **only** the two serving origins, and nothing else; the Tauri HTTP capability gains exactly those two scoped entries. | `capability-scope.test.ts` updated deliberately; transport rejects URLs outside them in unit tests |
| R-D3 | Suggested filename: `Content-Disposition` if present, else the route's `fileName`, sanitised; extension derived from content type as a last resort. | download tests assert each fallback |
| R-D4 | Save through the existing Slice 6 `saveDownload` port; user-picked path only; dialog cancel is a silent no-op (R-Ex-3 carried over). | screen tests: saved + silent cancel |
| R-D5 | Per-document Download button in the TenderDetail documents section **and** the ApplicationWorkspace documents panel; per-document state (`Downloading…`, disabled in flight); errors via `describeApiError(error, "the document")` — the entitlement 403 already reads *"Your plan does not include…"*. | screen tests for both screens |
| R-D6 | One resolution + one fetch per press; `retry: "never"` on both; a generous timeout (120s) because documents are large and cold R2 misses are slow. | endpoint/transport tests |
| R-D7 | No capability beyond HTTP scopes + the existing dialog/fs pair; no `shell:`, no `opener:`, no new static fs scope. | capability-scope assertions |
| R-D8 | Wire the real `DocumentsEndpoint` into both routes from `ApiClients`; fixtures and parity tests updated. | fixture + route tests |

## Explicitly out of scope

Document **preview**/opening, batch download, the document-vault download
button (the vault already has `getDownloadUrl`; wiring its own UI is a
separate slice), government-source fallbacks, worker changes, parent-repo
changes.
