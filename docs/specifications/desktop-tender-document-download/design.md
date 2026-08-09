# Desktop — Tender Document Download — Design (Slice 7)

## Flow

```
user presses Download
  -> GET /api/v1/documents/:id/download-url?requireR2=1   (DocumentsEndpoint.getDownloadUrl, exists)
  -> GET <resolved absolute URL>                          (ApiTransport.download with url: option, new)
  -> saveDownload(savePort, {bytes, filename, contentType})  (Slice 6 service, exists)
```

Resolution and fetch are one endpoint method (`downloadTenderDocument`) so
the UI cannot accidentally skip the parent resolver (R-D1).

## 1. Transport — absolute-URL downloads

Extend `DownloadOptions` with an optional `url?: string`:

- When present it is fetched verbatim instead of `buildUrl(baseUrl, path,
  query)`; `path` becomes optional for that shape (kept for the API-key
  session-loss choke point — `onUnauthorized` fires only for `path` routes,
  and an external binary fetch is never a session signal).
- **Client-side origin guard** (defence in depth; the capability layer is the
  real boundary): the URL must be `https` and its origin one of
  `https://docs.tenders-sa.org` or `https://etenders-api.tenders-sa.org`;
  anything else throws `offlineError()`-style invalid-request error (new
  `invalidRequestError` kind or reuse `validation`; decide in implementation
  — pick the kind `malformed`-adjacent so the shared describe copy stays
  honest). No auth headers are attached (external fetches are keyless).
- Timeout/cancel/error mapping unchanged (`attemptDownload`); `retry` stays
  `"never"` for the file fetch.

## 2. Endpoint — `DocumentsEndpoint.downloadTenderDocument`

```ts
async downloadTenderDocument(
  documentId: string,
  signal?: AbortSignal,
): Promise<DownloadResult>
```

- Calls `getDownloadUrl(documentId, signal)`; extends `downloadUrlSchema` to
  capture `fileName` (and `source`, for tests) — currently dropped by
  passthrough.
- Then `transport.download({ url, filenameFallback: sanitised fileName from
  the payload, policy: { retry: "never", timeoutMs: 120_000 }, signal })`.
- Filename precedence: Content-Disposition > payload `fileName` >
  `document-<id>` + extension from content type (R-D3).

## 3. Capability — two scoped origins

`src-tauri/capabilities/default.json`, `http:default` allow-list grows from
one entry to three:

- `https://www.tenders-sa.org/api/*` (existing)
- `https://docs.tenders-sa.org/docs/*` (R2 serving path; the parent route
  guarantees the pathname starts with `/docs/`)
- `https://etenders-api.tenders-sa.org/api/document*` (worker document URL)

`capability-scope.test.ts` updated deliberately: the two new origins allowed
**only** with those path prefixes (assert no bare-origin entries); shell,
opener, static fs scope remain forbidden; CSP untouched.

## 4. UI

A shared `DocumentDownloadButton` component
(`src/features/tenders/DocumentDownloadButton.tsx`):

- Props: `{ endpoint: Pick<DocumentsEndpoint, "downloadTenderDocument">;
  documentId: string; fileName?: string; savePort?: SaveDownloadPort }`.
- Per-document state: `idle | downloading | saved | error`; button label
  `Download` → `Downloading…` (disabled); on success no toast — the file is
  on disk where the user pointed it (mirrors export); cancel is silent;
  errors render inline under the button via
  `describeApiError(error, "the document")`.
- Mounted in:
  - `TenderDetail.DocumentsSection` — replaces the *"not available in this
    build"* line with one button per document (new optional prop
    `documents?: Pick<DocumentsEndpoint, "downloadTenderDocument">` and
    `savePort?: SaveDownloadPort`, both defaulting off so existing tests
    and the pure-read contract hold; the route passes `clients.documents`).
  - `ApplicationWorkspace` documents panel — same component per document;
    new optional props `documents?` + `savePort?` on `ApplicationWorkspace`;
    the workspace route passes `clients.documents`.
- The "Tender documents" panel header count stays.

## 5. Wiring

`TenderDetailRoute` (`src/app/router/routes.tsx`) passes
`documents={clients.documents}` and a default `createTauriSavePort()` (or
the route-level default from Slice 6's pattern). The ApplicationWorkspace
route does the same. `savePort` defaults to `createTauriSavePort()` inside
the button when not provided, matching `ResponseBlueprintPanel`.

## 6. Tests

- Transport: absolute-URL fetch (method GET, no query build, keyless),
  origin guard rejects `http`/foreign hosts, timeout override honoured,
  never retried.
- Endpoint: `downloadTenderDocument` = resolve then fetch same URL; filename
  precedence; 403 entitlement maps; 404; payload `fileName` captured.
- Capability: the two scoped origins allowed; bare origins denied; shell /
  opener / static fs still denied.
- Screens: TenderDetail + ApplicationWorkspace — button per document,
  downloading state, saved (no error), silent cancel, entitlement 403 copy,
  generic error copy.
- Fixtures: `api-clients.ts` gains `downloadTenderDocument: idle()`.
- Parity: endpoint-parity pins `requireR2` query + `download-url` path (the
  literal list).
