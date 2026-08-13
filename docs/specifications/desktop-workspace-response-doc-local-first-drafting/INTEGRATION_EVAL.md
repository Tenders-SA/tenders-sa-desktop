# Desktop Workspace — Response Document Local-First Drafting — INTEGRATION_EVAL (Slice 10)

- **Status**: pending — spec not yet implemented (SEC-1 amendment awaiting user
  approval)

## Gates

| Gate | Task | Evidence | Date |
|---|---|---|---|
| Additive schema + repos | T1 | `vitest db-repositories` (extended); `cargo check` if Rust changed | — |
| Store + save-path wiring | T2 | store/hook tests — draft persist/clear, offline enqueue, generate not queued | — |
| Replay + UI | T3 | screen + sync-replay tests — restore, pending-sync, restore-without-PUT | — |
| Full suite + static | T4 | `vitest` (all), `tsc --noEmit`, `eslint`, `prettier --check` — 0 errors | — |
| Live human verification | T5 | user confirms crash recovery, offline sync, version restore | — |

## Deviations

- _(none — to be filled during implementation)_
