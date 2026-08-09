# Desktop Workspace — Export Response Package — SPEC_CONTRACT (Slice 6)

- **Status**: `PENDING APPROVAL`
- **Date**: 2026-08-09
- **Scope**: Slice 6 — export response package (R-Ex-1..R-Ex-6).
- **Approved by**: *(awaiting user)*
- **Approval date**: —

## Contract checklist (mirrors tasks.md)

| # | Item | Contract |
|---|---|---|
| C1 | Binary transport | generic `download()` on `ApiTransport` — `{bytes, filename, contentType}`, `Content-Disposition` parse + fallback, shared timeout/cancel/error policy, `retry: "never"` (R-Ex-2, R-Ex-5) |
| C2 | Endpoint method | `exportWorkspacePackage(id, "pdf"\|"docx")` → `ExportPackageResult`; `format` always in query; 409 → `validation` kind |
| C3 | Save to disk | `saveDownload` service + injectable `SaveDownloadPort`; dialog cancel = silent no-op (R-Ex-3) |
| C4 | Least-privilege capability | `dialog:allow-save` + `fs:allow-write-file` only; no `fs:scope`, no `shell:`, no `opener:`; dialog plugin runtime-extends the fs scope to the picked path |
| C5 | Capability test | `capability-scope.test.ts` updated deliberately: fs only `fs:allow-write-file`, dialog only `dialog:allow-save`, shell/opener forbidden; http/CSP assertions untouched (R-Ex-6) |
| C6 | Export action | panel header beside Deep-analyse, PDF/DOCX choice, "Exporting…" + disabled in flight, one POST per press (R-Ex-1) |
| C7 | 409 honesty | *"Generate your proposal documents before exporting."* — keyed off the action, `role="alert"`; other errors → `describeApiError(error, "the export")` (R-Ex-4) |
| C8 | Wiring + coverage | fixtures gain the method; parity pins the `workspace-export` literal |
| C9 | Verification gates | `vitest` full suite, `tsc --noEmit`, `eslint .`, `prettier --check .`, `cargo check` — zero errors |
| C10 | Human verification | user live-verifies Export → save dialog → valid file on disk, the 409 copy, and a silent dialog cancel; recorded in `INTEGRATION_EVAL.md` |

## Explicitly out of contract

Briefing pack (`POST assist/briefing-pack` — same download machinery, its own
slice), refine (`POST assist/refine`), submission recording, board screen,
agent/chat, `workspace-generate`. Parent repo changes: none. No AI runs on
export — it packages already-generated documents.

## Non-negotiable constraints

- Live deployment is the contract; the binary path is one generic
  `download()` method — never a parallel HTTP client.
- No mutation without an explicit human press (R-W-7); no auto-retry of the
  POST; no write to any path not picked by the user (R-Ex-3).
- `ApiError.message` / the parent's `error`/`message` strings are never shown
  verbatim (describe-error docblock).
- `capability-scope.test.ts` may only be changed as specified in C5 — an
  edit that widens the http allow-list or CSP fails CI by design.
- No `npm run build` / `next build` / prisma migrations (repo rule).
