# Desktop — Document Actions — INTEGRATION_EVAL (Slice 8)

- **Status**: internal viewer amendment complete
- **Spec**: `desktop-document-actions/`

## Pre-implementation

- [x] Git history and current working tree reviewed.
- [x] Existing resolver, save port, shared button, Vault and screen owners identified.
- [x] Enhance-existing decision recorded; no parallel transport or resolver.
- [x] Parent immutable registry checked; no parent frozen module touched.
- [x] User approved T1–T6 and explicitly excluded government fallback.
- [x] 2026-08-14 repository reality rechecked: the existing Open action uses
  temp-file OS launch; authenticated bytes and per-document analysis already
  exist; no parent change is required.
- [x] Enhance-existing decision: amend this canonical document-actions spec,
  reuse `downloadTenderDocument`, and migrate all tender Open consumers to one
  internal route.
- [x] User explicitly approved the internal viewer and side-by-side analysis.

## Internal viewer amendment gates

- [x] T7 contract and route ownership complete.
- [x] T8 viewer and selected-source analysis tests pass.
- [x] T9 all tender Open actions route internally; Vault remains Download-only.
- [x] T10 lifecycle/accessibility/recovery coverage passes.
- [x] T11 full permitted desktop gates and changelog pass.

## Gates

| Gate | Task | Evidence | Date |
|---|---|---|---|
| Native port + capability | T1 | 28 targeted tests, TypeScript and `cargo check` pass; HTTP origins remain exactly three; opener path is `$TEMP/tenders-sa/**` only | 2026-08-09 |
| Open action | T2 | TenderDetail verifies scoped temp write + OS open; ApplicationWorkspace verifies `Opening…`, both actions disabled and one resolver call | 2026-08-09 |
| Vault download | T3 | Vault screen tests verify saved bytes/path, silent cancel, safe failure and retained expiry context | 2026-08-09 |
| Batch download | T4 | Coordinator verifies one picker, sequential order, cancel, duplicate suffixes and continue-on-failure; both owning screens verify completion/partial summaries | 2026-08-09 |
| Full gates | T5 | All 689 tests pass together after stabilising the startup smoke-test timeout; TypeScript, ESLint, Prettier, `cargo check` and `git diff --check` pass | 2026-08-09 |
| Live human verification | T6 | User confirmed everything works: real OS Open, Vault save, batch save after one folder choice, duplicate-name protection, silent cancel and honest partial-failure behavior | 2026-08-09 |
| Internal viewer | T7–T10 | Dedicated route, selected-document authenticated bytes/analysis, PDF page and zoom controls, fallback preview, collapsible panes and internal Open routing covered by component, screen and reachability tests | 2026-08-14 |
| Amendment gates | T11 | Prettier, TypeScript, ESLint, Rust and diff checks pass; full Vitest ran 843/844 before one known DraftStage timeout, then all 19 DraftStage tests passed on isolated rerun; desktop changelog updated | 2026-08-14 |

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
