# Desktop Workspace — Export Response Package — INTEGRATION_EVAL (Slice 6)

- **Status**: pending
- **Spec**: `desktop-workspace-export-response-package/` (requirements
  R-Ex-1..R-Ex-6, design, tasks)

## Gates

| Gate | Task | Evidence | Date |
|---|---|---|---|
| Transport + endpoint contract tests | T1 | `vitest transport-download` + `module-endpoints` — binary success, filename parse, 401/403/404/409/500 mapping, never-retry | — |
| Capability + save service | T2 | `vitest capability-scope`; `cargo check` — scoped fs/dialog assertions pass | — |
| Panel tests | T3 | `vitest module-screens` — button/working/success-save/cancel/409/500 | — |
| Full suite + static gates | T4 | `vitest` (all), `tsc --noEmit`, `eslint .`, `prettier --check .` — 0 errors | — |
| Capability/parity | T4 | `vitest capability-scope endpoint-parity` | — |
| Live human verification | T5 | user live-verifies Export → save dialog → valid file on disk, 409 copy, silent cancel | — |

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
