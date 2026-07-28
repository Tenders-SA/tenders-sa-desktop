# Integration Evaluation — Tenders-SA Desktop Procurement Workspace

> Update this file during implementation. No implementation is complete until every applicable item passes and evidence is recorded.
>
> **Current status: Phase 0 evaluated with one open gap.** Every automated gate passes, human-triggered Windows packaging evidence exists, and the application has been confirmed to launch. The remaining gap is PERF-1: cold start measured at ~5s against a 3s target, warm start unmeasured. That deviation is recorded below rather than waived.

## Specification Validation

- [x] Original product prompt preserved verbatim under `docs/prompts/`
- [x] Git history and parent working-tree state reviewed
- [x] Existing parent routes, models, OpenAPI documents, and application-workspace assets sampled
- [x] Create-new desktop vs enhance-existing backend decision documented
- [x] Frozen-module assessment completed; no parent mutation is in scope
- [x] Requirements, design, tasks, contract, and evaluation files created
- [x] Every task maps to requirements/design and includes files, pre-check, verification, and commit
- [x] Contract task list mirrors tasks.md at specification creation
- [x] Rollback, security, offline conflict, and compatibility constraints documented
- [x] User approved the specification — status set to `APPROVED` 2026-07-27

## Pre-Implementation Check

- [x] `SPEC_CONTRACT.md` status is `APPROVED`
- [x] Desktop worktree is clean except approved scope
- [ ] Parent audit baseline commit is still available — **UNVERIFIED**. `freelancing-solutions/tendersa` cannot be added to this session (cross-owner adds unsupported), so `be09f9d51` could not be confirmed. Phase 1 must re-establish this from a session with parent access.
- [x] Current official Tauri 2 documentation reviewed for scaffold, capabilities, SQL, secure storage, updater, and testing — **with a caveat**: `v2.tauri.app` is blocked by this environment's egress policy, so the pinned `tauri` 2.11.5 / `tauri-build` 2.6.3 / `tauri-utils` 2.9.3 crate sources under `~/.cargo/registry` were used instead. For a lockfile-pinned implementation that is the more exact source.
- [x] All Phase 0 pattern references and planned paths remain valid
- [x] No unapproved parent repository edits are required — no parent file was touched

## Phase 0A Evaluation

- [x] Tauri/React/Rust workspace is valid under non-release checks — `cargo check`, `cargo fmt --check`, `pnpm typecheck`, `pnpm build` all pass
- [x] Strict TypeScript, linting, formatting, tests, and Rust checks are configured — and enforced in CI on every push/PR
- [x] Runtime configuration validates and contains no secrets or hard-coded production endpoint — allowlist-based loader, fails closed; 7 tests including a secret-non-leakage case
- [x] Capabilities are default-deny, command inputs validate, and no generic shell permission exists — `core:default` plus six explicit `allow-*` command permissions and scoped `sql:` access; the scaffold's unscoped `tauri-plugin-opener` grant was removed
- [x] Secure-storage and signed-update decisions are recorded — `docs/architecture/security.md`

## Phase 0B Evaluation

- [x] SQLite migrations pass empty and upgrade fixture tests — applied against real in-memory SQLite via `rusqlite`, incl. CHECK/UNIQUE constraints
- [x] Local schema contains no duplicate server authority and no auth tokens — table-by-table pre-check in `docs/architecture/local-data.md`
- [x] Sync queue covers retry, dependency, conflict, failure, cancellation, and idempotency — 28 tests across state machine, ordering, and conflicts
- [x] API transport covers runtime validation, cancellation, timeout, envelope/error variants, and safe retries — 16 tests; envelope verified against the live API, correcting design.md's sketch
- [x] Dark design-system tokens are complete, single-theme only, brand-aligned, and pass automated WCAG 2.2 AA contrast checks on every surface/interactive-state pairing — 34 assertions parsing the shipped CSS; **six real AA failures in design.md's proposed palette were found and corrected**
- [x] Production authentication remains gated until its contract is approved — gate requires both the feature flag *and* an audited adapter; no audited adapter exists
- [x] Shell navigation, protected routing, keyboard/focus, errors, and sync status pass tests — 23 tests
- [x] Logs redact credentials, pricing, document content, and personal data — allowlist-based redaction, re-applied independently on the Rust side; 35 tests
- [x] CI and contributor documentation are reproducible — `docs/development.md` lists the exact commands CI runs
- [x] **Human or approved Windows CI evidence confirms package/build/launch success** — build and package via two human-triggered `workflow_dispatch` runs (below); **launch confirmed by the user on 2026-07-28**, who installed the package and reported the application opening in approximately 5 seconds.

## Phase 1 Evaluation

Phase 1 has not started. Every item below remains open, and three Phase 0 pre-checks were deferred into it because the parent repository is unreachable from this session.

- [ ] Parent repository URL, branch, SHA, registry version, and dirty-tree disclosure are recorded
- [ ] Canonical model inventory covers all desktop Phase 2 dependencies
- [ ] Endpoint inventory covers route, method, auth, CSRF/idempotency, pagination, schema evidence, and stability
- [ ] OpenAPI drift and undocumented contracts are explicit
- [ ] Native auth/subscription ADR reaches accepted or precisely blocked status
- [ ] Cross-domain mappings preserve server ownership and data provenance
- [ ] Tender document flow follows existing Worker/R2/D1 architecture
- [ ] Every apparent gap was searched against parent code/spec/TODO evidence
- [ ] Gap classifications and parent approval boundaries are complete
- [ ] Phase 2 plan is a small vertical slice with rollout and rollback gates

## Final Evaluation

- [x] Every REQ, NFR, INT, and success criterion has linked evidence — for Phase 0; Phase 1 requirements (REQ-10 to REQ-15) are not yet in scope
- [x] Task and contract checklists are identical
- [x] No task was skipped, reordered, or combined without approved spec revision
- [x] No parent Tier 1, Tier 2, or Tier 3 file was modified — no parent file was accessible, let alone modified
- [x] No production write, migration, deployment, or automatic bid action occurred
- [x] All scoped automated checks pass — see Evidence Record
- [x] Commit history uses task-specific messages
- [x] Phase 2 implementation has not started without a new approved contract

## Evidence Record

All commands run at commit `ea02e08`.

| Gate | Command or document | Result | Date/commit |
|---|---|---|---|
| Specification structure | Manual cross-file review | PASS | 2026-07-27 / initial spec commit |
| Formatting | `pnpm run format:check` | PASS | 2026-07-28 / `ea02e08` |
| Lint (incl. jsx-a11y) | `pnpm run lint` | PASS | 2026-07-28 / `ea02e08` |
| Types (strict) | `pnpm run typecheck` | PASS | 2026-07-28 / `ea02e08` |
| Frontend tests | `pnpm run test` | PASS — 161 tests, 13 files | 2026-07-28 / `ea02e08` |
| Frontend build | `pnpm run build` | PASS | 2026-07-28 / `ea02e08` |
| Rust formatting | `cargo fmt -- --check` | PASS | 2026-07-28 / `ea02e08` |
| Rust lint | `cargo clippy -- -D warnings` | PASS | 2026-07-28 / `ea02e08` |
| Rust tests | `cargo test` | PASS — 26 tests | 2026-07-28 / `ea02e08` |
| CI (automated) | [Actions run 30334729707](https://github.com/Tenders-SA/tenders-sa-desktop/actions/runs/30334729707) | PASS — both jobs | 2026-07-28 / `c7b763f` |
| Windows package/build | [Actions run 30335441194](https://github.com/Tenders-SA/tenders-sa-desktop/actions/runs/30335441194), `workflow_dispatch` by @freelancing-solutions | PASS — NSIS + MSI produced, 399 MB artifact | 2026-07-28 / `ea02e08` |
| Windows package (pre-offline-installer) | [Actions run 30313966903](https://github.com/Tenders-SA/tenders-sa-desktop/actions/runs/30313966903) | PASS — 7.8 MB artifact | 2026-07-27 / `e0cd4c9` |
| Windows launch | Human install + start, reported by user | PASS — application opens | 2026-07-28 / `ea02e08` |
| **PERF-1 cold start** | Human observation on user's Windows machine | **~5s vs 3s target — DEVIATION** | 2026-07-28 / `ea02e08` |
| **PERF-1 warm start** | Windows 11 reference device | **NOT MEASURED** | — |

Test totals: **187** (161 TypeScript + 26 Rust).

## Result

- **Status**: PHASE 0 EVALUATED — ONE GAP OPEN (PERF-1)
- **Passing**: every automated gate, human-triggered Windows packaging, and confirmed application launch.
- **Remaining issues**:
  1. **PERF-1 cold start misses its target.** Measured at approximately 5 seconds against a 3-second target. PERF-1 states that deviations "require recorded evidence and an approved threshold change", so this is recorded rather than waived. Two caveats on the measurement, both of which could move it: it was taken on the user's own machine rather than the agreed Windows 11 reference device, and a *first* launch includes one-time costs that a steady-state cold start does not — WebView2 first-run initialisation and the initial SQLite migration apply. **Warm start (1.5s target) has not been measured at all**, and is the figure users experience most often. Resolving this needs either a repeat measurement on the reference device, investigation to reach 3s, or an approved threshold change.
  2. **Three Phase 0 pre-checks were deferred to Phase 1** — the parent auth contract (TASK-0.9), the parent API envelope and `src/lib/api-client.ts` (TASK-0.7), and the parent brand hues in `src/app/globals.css` (TASK-0.8). All require a session started with `freelancing-solutions/tendersa` as its initial source.
- **Not a blocker but worth revisiting**: the offline WebView2 installer costs +391 MB, roughly three times the estimate it was approved on, because NSIS and MSI each embed a copy. Dropping one installer format would remove one copy.
- **Approved by**: pending user review of this evaluation.
