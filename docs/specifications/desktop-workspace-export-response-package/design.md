# Desktop Workspace — Export Response Package — Design (Slice 6)

Extends the Slice 5 blueprint surface with one panel-level export action and
adds the desktop's first binary-download path. Requirements R-Ex-1..R-Ex-6.

## Transport — one generic `download()` on `ApiTransport` (no parallel client)

`src/services/api/transport.ts`, alongside `request()`:

- `download(options: DownloadOptions): Promise<DownloadResult>` where
  `DownloadOptions` = `{ method: HttpMethod, path, query?, headers?, signal?, policy? }`
  and `DownloadResult = { bytes: Uint8Array, filename: string, contentType: string }`.
- Shares the timeout/cancellation/retry scaffolding with `performRequest`
  (REQ-A2); `retry` defaults to `"never"` for the POST (R-Ex-5) and the
  `onUnauthorized` choke point is preserved for 401s.
- Reads `Content-Disposition` and extracts `filename="..."`; falls back to
  `proposal-<applicationId>.<ext>` when the header is absent.
- On `!response.ok`, keeps the existing JSON error path verbatim
  (`parentErrorSchema` → `fromParentError`), so 401/400/403/404/409/500 map
  exactly as they do today (`errors.ts kindForStatus` — 409 → `validation`).
- On success, `await response.arrayBuffer()` → `new Uint8Array(buffer)`.
  No zod validation: the body is binary (permissive by contract).

`tauri-plugin-http`'s `fetch` returns a standard `Response`, so `arrayBuffer()`
works in Rust-executed requests; in tests the injected `fetchImpl` supplies
the binary response.

## Endpoint layer — `ApplicationsEndpoint`

`src/services/api/endpoints/applications.ts`, after the `enrichBlueprint`
block:

```ts
export interface ExportPackageResult {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
}

/** POST .../assist/workspace-export?format=pdf|docx — 409 gate; retry:"never". */
async exportWorkspacePackage(
  id: string,
  format: "pdf" | "docx",
  signal?: AbortSignal,
): Promise<ExportPackageResult>
```

Query `format` always sent explicitly (`"pdf" | "docx"`, never defaulted
client-side — the parent defaults, but the desktop UI always chooses).

## Save to disk — `src/services/storage/save-download.ts`

New service in the existing `storage/` directory (wrapper pattern, injectable
for tests like `fetchImpl`):

```ts
export interface SaveDownloadPort {
  saveDialog(options: {
    suggestedName: string;
    filterName: string;
    extensions: string[];
  }): Promise<string | null>;            // null = user cancelled
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
}

export function saveDownload(
  port: SaveDownloadPort,
  result: ExportPackageResult,
): Promise<"saved" | "cancelled">
```

- `saveDialog` → `@tauri-apps/plugin-dialog` `save({ defaultPath: suggestedName, filters })`.
- `writeBytes` → `@tauri-apps/plugin-fs` `writeFile(path, bytes)`.
- Real port builds both from the plugins; tests inject fakes — the plugin
  functions throw outside a Tauri runtime, so nothing imports them at module
  scope (same rule as `tauri-http-transport.ts`).

## Capabilities — new plugins, least privilege

- `package.json`: `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs` (^2).
- `src-tauri/Cargo.toml`: `tauri-plugin-dialog = "2"`, `tauri-plugin-fs = "2"`.
- `src-tauri/src/lib.rs`: `.plugin(tauri_plugin_dialog::init())`,
  `.plugin(tauri_plugin_fs::init())`.
- `src-tauri/capabilities/default.json`: add `dialog:allow-save` and
  `fs:allow-write-file` **only** (no `dialog:default`, no `fs:default`, no
  `fs:scope`). The dialog plugin extends the fs scope at runtime to exactly
  the user-picked path (`tauri_scope.allow_file` in the plugin's `save`
  command) — that runtime extension is the whole reason no static fs scope is
  needed (R-Ex-3).
- `src/tests/capability-scope.test.ts` (R-Ex-6):
  - replace the blanket `fs:` prohibition with: fs allowed **only** as
    `fs:allow-write-file`; no other `fs:` identifier present; no `shell:` or
    `opener:` identifier; dialog allowed **only** as `dialog:allow-save`;
  - keep every existing http/CSP assertion untouched.

## UI — ResponseBlueprintPanel gains the Export action

No new files: the panel already carries the `ActionState`
(idle/working/error+message) pattern from Slice 5's Deep-analyse.

- **Export** button in the panel header `aside` (beside Deep-analyse, only
  when a blueprint renders); pressing it reveals the format choice
  (PDF | DOCX) inline — no menu primitive exists in `src/components/common`,
  so a minimal two-option disclosure (existing styling, no new component
  library).
- Choosing a format runs the export; the button reads "Exporting…" and the
  whole action group is disabled while in flight (R-Ex-1) — one POST per
  choice.
- **Success** → `saveDownload` with the parsed filename; `"cancelled"` is a
  silent no-op (R-Ex-3); `"saved"` needs no toast — the file on disk is the
  feedback.
- **409** (kind `validation` is shared by 400/409, so key off the action +
  status 409 via the error): *"Generate your proposal documents before
  exporting."* (R-Ex-4).
- **Other errors**: `describeApiError(error, "the export")` — 5xx →
  "Could not export right now.", retryable via the same action (R-Ex-5).

## Orchestrator wiring

`ApplicationWorkspace.tsx`: no structural change — the panel is already
mounted; the passed `endpoint` instance gains the method at T1, and the
panel receives the save port (default real, injectable in tests).

## Tests

- `src/tests/module-endpoints.test.ts` — contract tests: 200 binary →
  `{bytes, filename, contentType}`; `Content-Disposition` parsing (quoted
  name, missing header fallback); 409 → kind `validation`; 401/403/404/500
  mapping; never retries (single call on a transient network failure);
  `format` appears in the query string.
- `src/tests/transport-download.test.ts` (new) — the download path itself:
  binary body passthrough, error-JSON mapping, timeout → `timeoutError`,
  caller abort → `cancelledError`, 401 triggers `onUnauthorized`.
- `src/tests/module-screens.test.tsx` — screen tests: Export renders beside
  Deep-analyse; PDF/DOCX choice POSTs once with "Exporting…" disabled;
  success → save port called with the parsed filename; save-dialog cancel is
  silent; 409 shows the honest copy; a 500 shows the server copy.
- `src/tests/fixtures/api-clients.ts` — stub gains `exportWorkspacePackage`
  (`idle()`).
- `src/tests/endpoint-parity.test.ts` — route literal
  `` `.../assist/workspace-export` `` pinned with the other workspace routes.
- `src/tests/capability-scope.test.ts` — scoped fs/dialog assertions (above).

## Files touched

| File | Change |
|---|---|
| `src/services/api/transport.ts` | +`download()` (binary, never-retry) |
| `src/services/api/endpoints/applications.ts` | +`ExportPackageResult`, +`exportWorkspacePackage` |
| `src/services/storage/save-download.ts` | **new** — save port + `saveDownload` |
| `src/features/applications/workspace/ResponseBlueprintPanel.tsx` | +Export action + format choice + alert copy |
| `package.json`, `src-tauri/Cargo.toml` | +dialog, +fs plugins |
| `src-tauri/src/lib.rs` | +plugin registration |
| `src-tauri/capabilities/default.json` | +`dialog:allow-save`, +`fs:allow-write-file` |
| `src/tests/capability-scope.test.ts` | scoped fs/dialog assertions |
| `src/tests/transport-download.test.ts` | **new** — download contract tests |
| `src/tests/module-endpoints.test.ts` | +contract tests |
| `src/tests/module-screens.test.tsx` | +screen tests |
| `src/tests/fixtures/api-clients.ts` | +stub method |
| `src/tests/endpoint-parity.test.ts` | +route literal |
