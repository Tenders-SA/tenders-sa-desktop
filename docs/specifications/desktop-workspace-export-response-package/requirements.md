# Desktop Workspace — Export Response Package — Requirements (Slice 6)

## Problem

Slices 3–5 let the user view the blueprint, author response documents, and
deep-analyse the tender into an AI-tailored plan. But the finished response
cannot leave the desktop: there is no download path. The parent's branded
proposal-package export (`POST /assist/workspace-export`) has no desktop
surface, and the desktop transport is JSON-only — it cannot even carry a
binary response yet.

The route was read from parent source (2026-08-09): it renders a real,
branded proposal package (PDF via jsPDF, DOCX via the `docx` library) from
the generated cover letter, capability, methodology, email **and every
tender-specific response document authored in the workspace**
(`__responseDocs`), with markdown cleaned and known placeholders resolved.
It is synchronous, runs no AI, and is not subscription-gated.

## Live-verified parent contract (2026-08-09, read from parent route source)

### POST /api/v1/applications/[applicationId]/assist/workspace-export?format=pdf|docx

```
// No request body. `format` defaults to `pdf`; anything else -> 400.
// 200 — binary attachment:
//   Content-Type: application/pdf
//              | application/vnd.openxmlformats-officedocument.wordprocessingml.document
//   Content-Disposition: attachment; filename="proposal-<reference>.pdf|docx"
//   (<reference> = tender referenceNumber or tender_id, [^\w.-] -> _)
// 401 — session lost      (JSON error body)
// 400 — no company profile (JSON: { error: "Company profile required" })
// 403 — application belongs to another company
// 404 — application not found
// 409 — no generatedCoverLetter && no generatedCapability:
//       { error: "Generate your proposal documents before exporting." }
// 500 — render failure     (JSON: { error: "Internal server error" })
```

- **409 is the state gate**: the export includes the generated documents, so
  an application with none cannot export. The desktop must surface this
  honestly, keyed off the action (the parent's `error` string is never shown
  verbatim).
- **No 402**: unlike deep-analyse, export is not subscription-gated — there is
  no Pro tier check in the route.
- **The filename lives in `Content-Disposition`**, not in the body. The
  desktop must parse it; the bytes themselves carry no name.
- Success bodies are binary — the JSON transport path cannot be reused.

### Explicitly NOT in this slice

- `POST /assist/briefing-pack?format=pdf|docx` — briefing attendance pack;
  same binary-download machinery, separate slice. The transport download
  method is designed generic so that slice reuses it (no parallel path).
- `POST /assist/refine`, `assist/workspace-generate`, submission recording,
  board screen, agent/chat.
- Any parent change: none needed.

## Functional requirements

### R-Ex-1 — Export action
The Response Blueprint panel offers an **Export** action (panel header, next
to the Deep-analyse action) whenever a blueprint renders, with a PDF/DOCX
choice. Pressing it is the only human input (R-W-7); the action shows a
working state ("Exporting…") and is disabled while in flight — no double
POST.

### R-Ex-2 — Binary download through the existing transport
`ApiTransport` gains one `download()` method (REQ-A2 — same timeout,
cancellation, error-normalisation, never-retry POST policy; no parallel
HTTP client). On success it returns `{ bytes, filename, contentType }` with
`filename` parsed from `Content-Disposition` (fallback
`proposal-<applicationId>.pdf`). Non-2xx responses keep the existing JSON
error mapping (`parentErrorSchema`) unchanged.

### R-Ex-3 — Save to disk, least privilege
The bytes are saved through the OS save dialog with the server's suggested
filename and a format filter. The user picking a destination is the only way
a path is written. Cancelling the dialog is a silent no-op (no error copy).
The capability adds exactly `dialog:allow-save` + `fs:allow-write-file`; the
dialog plugin extends the fs scope at runtime to the picked path only
(`tauri_scope.allow_file`, plugin source). No shell, no opener, no broad fs
scope.

### R-Ex-4 — 409 honesty
The export 409 means "nothing to export yet". The copy is keyed off the
action, never off the server string: *"Generate your proposal documents
before exporting."* — `role="alert"`, component-owned (describe-error
docblock). A retry after authoring works via the same button.

### R-Ex-5 — Mutation transport rules
`policy: { retry: "never" }` (R-W-7): the transport must not auto-retry a
POST that renders a package. A 5xx surfaces as the standard server copy
("Could not export right now."), retryable by the user's own press. 401 goes
through the existing single choke point for session loss.

### R-Ex-6 — Capability governance
`capability-scope.test.ts` is updated deliberately, not silently: the
blanket "no `fs:` permission" assertion becomes a scoped one — fs is allowed
only as `fs:allow-write-file` (command-level, dialog-scoped), `shell:` and
`opener:` stay forbidden, and no dialog permission beyond `dialog:allow-save`
is granted.

## Non-functional

- Same transport/error/redaction rules as the rest of the desktop (REQ-5,
  REQ-8). Route under `/api/v1/applications/[id]/assist/` — already in
  capability scope.
- No new parent routes, no schema changes, no parallel download machinery.
  The binary download path is one generic `download()` method, reused by
  later slices (briefing-pack) — never a second HTTP client.
- Error copy is component-owned; `ApiError.message` and the parent's
  `error`/`message` strings are never shown verbatim (describe-error docblock).

## Out of scope (later slices)

Briefing pack (reuses the download machinery), refine (prompt rewriting),
submission recording, board screen, agent/chat, workspace-generate.

## Success criteria

1. A DRAFT workspace with generated documents shows **Export** on the
   blueprint panel; choosing PDF/DOCX downloads once, shows "Exporting…",
   opens the OS save dialog with the server's suggested filename, and writes
   a valid package to the picked path.
2. A workspace with no generated documents shows the 409 copy; a 500 shows
   the server copy; the save-dialog cancel is silent.
3. `vitest`, `tsc --noEmit`, `eslint`, `prettier --check` pass; the
   capability test asserts the scoped fs/dialog permissions.
