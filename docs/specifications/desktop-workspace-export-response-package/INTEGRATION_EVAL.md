# Desktop Workspace — Export Response Package — INTEGRATION_EVAL (Slice 6)

- **Status**: complete — T1–T5 verified
- **Spec**: `desktop-workspace-export-response-package/` (requirements
  R-Ex-1..R-Ex-6, design, tasks)

## Gates

| Gate | Task | Evidence | Date |
|---|---|---|---|
| Transport + endpoint contract tests | T1 | `vitest transport-download` (12 new: binary passthrough, quoted/bare/missing disposition, sanitising + fallback, 409/401/403/404/500 mapping, session-loss hook, timeout, cancel, never-retry) + `module-endpoints` (6 new: query/verb, docx, 409 → `validation`, 403/404/500, never-retry) | 2026-08-09 |
| Capability + save service | T2 | `vitest capability-scope` (scoped fs/dialog assertions) + `save-download` (6: filters, write, cancel silent, unknown content type); `cargo check` clean with tauri-plugin-dialog + tauri-plugin-fs registered | 2026-08-09 |
| Panel tests | T3 | `vitest module-screens` — 6 new (choice opens, PDF once → Exporting… → save under parsed filename, DOCX, cancel silent, 409 copy, 500 copy) | 2026-08-09 |
| Full suite + static gates | T4 | `vitest` (all) 643/643 · 37 files; `tsc --noEmit` 0 errors; `eslint .` 0 errors; `prettier --check .` clean | 2026-08-09 |
| Capability/parity | T4 | `vitest capability-scope endpoint-parity` — pins the `assist/workspace-export` literal; fixtures stub gains `exportWorkspacePackage` | 2026-08-09 |
| Live human verification | T5 | User confirmed PDF and DOCX exports are valid, the save flow works, cancellation is silent, and the 409 precondition copy is correct. | 2026-08-09 |

## Live contract evidence (2026-08-09)

Route contract read from parent code:

- `src/app/api/v1/applications/[applicationId]/assist/workspace-export/route.ts`
  — POST, `format=pdf|docx` query (default `pdf`, else 400); 401/400
  ("Company profile required")/403/404/500 as JSON errors; **409** when
  neither `generatedCoverLetter` nor `generatedCapability` exists
  (lines 82-87, "Generate your proposal documents before exporting.");
  200 → binary `application/pdf` or DOCX mime with
  `Content-Disposition: attachment; filename="proposal-<ref>.pdf|docx"`
  (lines 130-162); filename base
  `proposal-${(tenderReference || applicationId).replace(/[^\w.-]+/g, '_')}`.
- Package content: generated cover letter, capability, methodology, email
  plus every non-base `__responseDocs` entry (tender-specific docs authored
  in the workspace), placeholders resolved, markdown cleaned
  (`proposal-format.ts` `buildProposalSections` / `resolvePlaceholders`).
- No subscription gate: the route has no Pro-tier check (unlike
  enrich-blueprint). Synchronous rendering, no AI.
- Save-path security (Tauri): the dialog plugin's `save` command extends the
  fs scope at runtime to exactly the user-picked path
  (`tauri_scope.allow_file(&path)` in `tauri-plugin-dialog/src/commands.rs`),
  so `dialog:allow-save` + `fs:allow-write-file` need no static fs scope.
- Out of contract confirmed: `assist/briefing-pack` (same binary machinery,
  own slice), `assist/refine`, `assist/workspace-generate`, submission
  recording, board screen, agent/chat.

## Deviations

- *(none)*
