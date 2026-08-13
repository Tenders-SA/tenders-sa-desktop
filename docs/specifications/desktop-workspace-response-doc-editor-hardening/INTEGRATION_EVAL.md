# Desktop Workspace — Response Document Editor Hardening — INTEGRATION_EVAL (Slice 8)

- **Status**: pending — spec not yet implemented

## Gates

| Gate | Task | Evidence | Date |
|---|---|---|---|
| Shared helper | T1 | `vitest module-screens` — row uses shared helpers, no raw `status.error` | — |
| Editor honesty | T2 | `vitest draft-stage` — 402/409/failed/template/placeholder/Retry | — |
| Stuck-gen recovery | T3 | `vitest draft-stage` — Check-again recovers to ready | — |
| Reference pane | T4 | reference-pane cases — no keyword table, honest empty state, drawer | — |
| Full suite + static | T5 | `vitest` (all), `tsc --noEmit`, `eslint`, `prettier --check` — 0 errors | — |
| Live human verification | T6 | user confirms all RH items in `pnpm tauri dev` | — |

## Deviations

- _(none — to be filled during implementation)_
