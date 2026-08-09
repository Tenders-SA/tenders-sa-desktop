# Desktop Workspace — Export Response Package — Tasks (Slice 6)

Status legend: `[ ]` open · `[x]` done. Implementation order is top-down.
Tasks reference requirements R-Ex-1..R-Ex-6 and the live-verified contracts
in `design.md`.

## T1 — Binary download transport + endpoint method

- **Pre-check**: live contracts in `design.md` read; Slice 5 merged.
- **Files**: `src/services/api/transport.ts`,
  `src/services/api/endpoints/applications.ts`,
  `src/tests/transport-download.test.ts`, `src/tests/module-endpoints.test.ts`.
- **Work**:
  1. Generic `download()` on `ApiTransport` — binary passthrough,
     `Content-Disposition` filename parsing with fallback, shared timeout/
     cancellation/error-normalisation, `retry: "never"` (R-Ex-2, R-Ex-5).
  2. `exportWorkspacePackage(id, format)` on `ApplicationsEndpoint`
     returning `ExportPackageResult`; `format` always sent in the query.
- **Verification**: new transport contract tests pass (binary success,
  filename parse incl. quoted + fallback, 401→`onUnauthorized`, timeout,
  cancel, never-retry); endpoint tests pass (query, 409 → `validation`,
  401/403/404/500 mapping).

## T2 — Save to disk + least-privilege capabilities

- **Pre-check**: T1 merged.
- **Files**: `src/services/storage/save-download.ts` (new),
  `package.json`, `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`,
  `src-tauri/capabilities/default.json`, `src/tests/capability-scope.test.ts`.
- **Work**:
  1. `SaveDownloadPort` + `saveDownload` service; plugin wrappers injected,
     never imported at module scope.
  2. Add `@tauri-apps/plugin-dialog` + `@tauri-apps/plugin-fs` (npm + cargo),
     register both in `lib.rs`.
  3. Capability: `dialog:allow-save` + `fs:allow-write-file` only (R-Ex-3).
  4. Update `capability-scope.test.ts` (R-Ex-6): scoped fs assertion (only
     `fs:allow-write-file`), dialog only `dialog:allow-save`, `shell:` and
     `opener:` stay forbidden; http/CSP assertions untouched.
- **Verification**: `pnpm exec vitest run src/tests/capability-scope.test.ts` —
  new assertions pass; `cargo check` (`pnpm run rust:check`) succeeds.

## T3 — Export action on the blueprint panel

- **Pre-check**: T1 and T2 merged.
- **Files**: `src/features/applications/workspace/ResponseBlueprintPanel.tsx`,
  `src/tests/module-screens.test.tsx`.
- **Work**:
  1. Export button + inline PDF/DOCX choice in the header `aside` (only when
     a blueprint renders); working state "Exporting…" + disabled while in
     flight (R-Ex-1).
  2. Success → `saveDownload` with the parsed filename; cancel → silent
     no-op (R-Ex-3).
  3. 409 → *"Generate your proposal documents before exporting."* (R-Ex-4);
     other errors → `describeApiError(error, "the export")` (R-Ex-5); all
     `role="alert"`.
- **Verification**: `pnpm exec vitest run src/tests/module-screens.test.tsx` —
  button/working/success-save/cancel/409/500 tests.

## T4 — Fixtures + parity + full gates

- **Pre-check**: T3 merged.
- **Files**: `src/tests/fixtures/api-clients.ts`, `src/tests/endpoint-parity.test.ts`.
- **Work**: fixture stub gains `exportWorkspacePackage` (`idle()`); parity
  test pins the `workspace-export` literal.
- **Verification**: `pnpm exec vitest run` (full suite), `pnpm exec tsc --noEmit`,
  `pnpm exec eslint .`, `pnpm exec prettier --check .`.

## T5 — Live verification (human)

- **Pre-check**: T4 merged; app running via `pnpm tauri dev`.
- **Work**: user opens a live DRAFT workspace with generated documents and
  confirms: Export → PDF/DOCX choice → "Exporting…" → OS save dialog with the
  suggested filename → a valid package written to the picked path; an empty
  workspace shows the 409 copy; a save-dialog cancel is silent.
- **Verification**: user sign-off; record in `INTEGRATION_EVAL.md`.

## Status (2026-08-09)

- T1: DONE.
- T2: DONE.
- T3: DONE.
- T4: DONE.
- T5: OPEN — awaiting user live verification (`pnpm tauri dev`).
