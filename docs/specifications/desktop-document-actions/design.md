# Desktop — Document Actions — Design (Slice 8)

## Implementation Strategy

- **Approach**: Enhance Existing.
- **Justification**: Slice 7 already owns resolution and binary download; Slice 6
  already owns user-approved writes. New work is orchestration and narrowly scoped
  native ports only.
- **Risk**: native opener/file permissions can widen desktop reach. Mitigation:
  `$TEMP/tenders-sa/**` only for Open, user-picked directory only for batch, and
  configuration assertions that reject URL opening, shell, wildcard paths, or
  additional origins.

## Architecture

### Canonical flow

```text
single Save -> downloadTenderDocument(id) -> saveDownload(existing port)
Open        -> downloadTenderDocument(id) -> openDownloadedDocument(temp port)
Download all-> chooseDirectory() -> for each id sequentially:
               downloadTenderDocument(id) -> collision-safe path -> writeBytes()
Vault Save  -> existing DocumentDownloadButton -> existing saveDownload()
```

### Files to create

| File | Purpose |
|---|---|
| `src/services/storage/document-actions.ts` | Temp-open and sequential batch orchestration with injectable native port |
| `src/features/tenders/DocumentBatchDownloadButton.tsx` | Shared batch UI for TenderDetail and ApplicationWorkspace |

### Files to modify

| File | Change |
|---|---|
| `src/features/tenders/DocumentDownloadButton.tsx` | Add optional Open action using the same endpoint |
| `src/features/tenders/TenderDetail.tsx` | Mount shared batch action and pass open port |
| `src/features/applications/ApplicationWorkspace.tsx` | Mount shared batch action and pass open port |
| `src/features/documents/DocumentVault.tsx` | Replace website-only copy with existing per-document Download control |
| `src/app/router/routes.tsx` | Pass the existing documents client to all three consumers |
| `src/services/storage/save-download.ts` | Return saved path without changing silent-cancel semantics; expose native primitives through the shared port family |
| `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `package.json`, `pnpm-lock.yaml` | Register Tauri opener plugin |
| `src-tauri/capabilities/default.json` | Add directory picker and path-scoped temp opener/write permissions |
| `src/tests/save-download.test.ts`, `src/tests/module-screens.test.tsx`, `src/tests/tender-detail.test.tsx`, `src/tests/capability-scope.test.ts` | Regression and boundary coverage |

## Native port design

`DocumentActionPort` is injectable and provides only:

```ts
interface DocumentActionPort {
  chooseDirectory(): Promise<string | null>;
  tempDirectory(): Promise<string>;
  joinPath(...parts: string[]): Promise<string>;
  createDirectory(path: string): Promise<void>;
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
  openPath(path: string): Promise<void>;
}
```

The real adapter dynamically imports Tauri APIs. Tests use fakes. `openPath` is
called only with a path produced under `<temp>/tenders-sa/`; capability scope is
the native enforcement layer.

## Batch behavior

- Input is the screen's already-loaded `{id, fileName?}[]`; no second list call.
- The directory picker runs once. Cancel returns `cancelled` before any download.
- Process sequentially with `for ... of`; each item invokes the existing endpoint
  once and writes immediately.
- Sanitise path separators/control characters. Maintain an in-memory case-folded
  set; collisions gain `-2`, `-3`, etc. before the extension.
- Catch per-item failures and continue. Result is `{saved, failed, failures[]}`;
  UI reports success or partial failure without server strings.

## Open behavior

- Download through the existing endpoint.
- Create `$TEMP/tenders-sa` recursively, derive a safe collision-resistant filename
  using document id plus the resolved filename, write, then open with the OS viewer.
- No URL is sent to the opener and no user-provided arbitrary path enters it.
- Reopening may replace the same temp file for that document; temp content is a
  disposable local copy, never canonical state.

## Capability design

- Keep the HTTP allow-list exactly three entries.
- Add `dialog:allow-open` solely for directory selection; retain
  `dialog:allow-save`.
- Add filesystem create/write scope only for `$TEMP/tenders-sa/**`; arbitrary batch
  directory write remains dialog-granted at runtime.
- Add `opener:allow-open-path` scoped only to `$TEMP/tenders-sa/**`.
- Never add `opener:allow-open-url`, `opener:default`, or any `shell:` permission.

## Compatibility and rollback

- Existing Download remains the default action and retains its behavior.
- All new props are optional for isolated component tests.
- Rollback removes the added controls/plugin permissions without changing API or
  stored data. No migration or parent deployment is involved.

## Validation Plan

- Unit tests: saved-path return, temp-open path, sanitisation/collision suffixing,
  sequential order, cancel, partial failure.
- Screen tests: Open state/single-flight/error, Vault Download, batch progress,
  cancellation and result summaries on both tender screens.
- Capability tests: exact permissions/scopes; no new origin, URL opener, shell, or
  broad filesystem access.
- Gates: full Vitest, `npm run typecheck`, `npm run lint`, `npm run format:check`,
  and `npm run rust:check`. No build.

