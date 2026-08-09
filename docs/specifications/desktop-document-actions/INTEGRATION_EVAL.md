# Desktop — Document Actions — INTEGRATION_EVAL (Slice 8)

- **Status**: complete
- **Spec**: `desktop-document-actions/`

## Pre-implementation

- [x] Git history and current working tree reviewed.
- [x] Existing resolver, save port, shared button, Vault and screen owners identified.
- [x] Enhance-existing decision recorded; no parallel transport or resolver.
- [x] Parent immutable registry checked; no parent frozen module touched.
- [x] User approved T1–T6 and explicitly excluded government fallback.

## Gates

| Gate | Task | Evidence | Date |
|---|---|---|---|
| Native port + capability | T1 | 28 targeted tests, TypeScript and `cargo check` pass; HTTP origins remain exactly three; opener path is `$TEMP/tenders-sa/**` only | 2026-08-09 |
| Open action | T2 | TenderDetail verifies scoped temp write + OS open; ApplicationWorkspace verifies `Opening…`, both actions disabled and one resolver call | 2026-08-09 |
| Vault download | T3 | Vault screen tests verify saved bytes/path, silent cancel, safe failure and retained expiry context | 2026-08-09 |
| Batch download | T4 | Coordinator verifies one picker, sequential order, cancel, duplicate suffixes and continue-on-failure; both owning screens verify completion/partial summaries | 2026-08-09 |
| Full gates | T5 | All 689 tests pass together after stabilising the startup smoke-test timeout; TypeScript, ESLint, Prettier, `cargo check` and `git diff --check` pass | 2026-08-09 |
| Live human verification | T6 | User confirmed everything works: real OS Open, Vault save, batch save after one folder choice, duplicate-name protection, silent cancel and honest partial-failure behavior | 2026-08-09 |

## Final evaluation

- [x] Every R-DA, SEC-DA, PERF-DA, UX-DA, REL-DA and INT-DA item has evidence.
- [x] HTTP allow-list remains exactly three entries.
- [x] Existing single-document download behavior is unchanged.
- [x] No government fallback or parent change was introduced.
- [x] Full automated gates pass.
- [x] Live human verification recorded.

## Result

- **Status**: complete
- **Remaining issues**: none
- **Permanent exclusion**: government/source fallback is rejected scope and must
  not be reopened as a follow-up task without a new explicit user decision.
