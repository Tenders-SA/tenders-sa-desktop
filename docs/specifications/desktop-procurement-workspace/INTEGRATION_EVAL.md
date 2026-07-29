# Integration Evaluation — Tenders-SA Desktop Procurement Workspace

> Update this file during implementation. No implementation is complete until every applicable item passes and evidence is recorded.
>
> **Current status: PHASE 0 AND PHASE 1 COMPLETE.** Every Phase 0 gate passes with recorded evidence: all automated checks, human-triggered Windows packaging, confirmed application launch, and PERF-1 start-up within target. Phase 1's parent data and API audit is complete against pinned parent commit `8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1`, with seven audit artifacts, no parent file modified, and **three precisely named items left open** (§Result).

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
- [x] Parent audit baseline commit is still available — **RESOLVED in TASK-1.1**. The parent repository is attached and fully readable (9794 tracked files). `be09f9d51` **does exist** and is a reachable ancestor of the default branch, so the earlier doubt was unfounded — but it is 15 commits stale and the drift lands inside the audit surface (eight Phase-2-dependency routes differ), so the baseline was deliberately re-pinned to the default-branch tip `8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1` and the substitution disclosed in full. See `docs/audits/parent-baseline.md` §2.
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
- [x] **Human or approved Windows CI evidence confirms package/build/launch success** — build and package via two human-triggered `workflow_dispatch` runs (below); **launch confirmed by the user on 2026-07-28**, who installed the package and ran the application.
- [x] **PERF-1 start-up is within target** — user-confirmed cold start **under 3 seconds** on 2026-07-28. An initial first-run launch measured ~5s; that figure carried one-time costs a steady-state cold start does not (WebView2 first-run initialisation and the initial SQLite migration), and subsequent launches are within target. Recorded because the distinction matters for anyone re-measuring.

## Phase 1 Evaluation

All Phase 1 audits are complete against pinned parent commit `8ff2e4c2`. The parent repository was attached and fully readable, so nothing below is inferred — every finding is read from parent source.

- [x] Parent repository URL, branch, SHA, registry version, and dirty-tree disclosure are recorded — `parent-baseline.md`; remote `freelancing-solutions/tendersa`, default branch `aws-production-app` (confirmed, not assumed), SHA `8ff2e4c2`, registry v2.0, **working tree clean** so there is no drift to disclose
- [x] Canonical model inventory covers all desktop Phase 2 dependencies — `model-inventory.md`; 14 required entities plus the company vault, each in exactly one canonical domain file; domain-vs-generated drift **checked, not assumed** (193/193, zero orphans); `base.prisma` added to the canonical set after an enum turned up outside the domain files
- [x] Endpoint inventory covers route, method, auth, CSRF/idempotency, pagination, schema evidence, and stability — `endpoint-inventory.md`; 16 endpoints under a stated selection rule against 714 handlers, with the 16/714 ratio recorded so coverage is visible rather than implied
- [x] OpenAPI drift and undocumented contracts are explicit — `endpoint-inventory.md` §5; **both** parent documents analysed. The parent's own `v1.yaml` is well-formed (19/19 ops with a 200 schema); the **published** v2.1.0 manages 1/98, so INT-6's drift is re-attributed to the published artifact. Neither describes the parent-internal API, so all 16 endpoints are hand-authored `awaiting-contract`
- [x] Native auth/subscription ADR reaches accepted or precisely blocked status — `auth-subscription-contract.md` + `docs/architecture/auth.md` (**Accepted**); INT-1 resolved to Bearer/body-token on code **and parent-test** evidence; contract CONFIRMED, production auth **remains gated** pending Phase 2
- [x] Cross-domain mappings preserve server ownership and data provenance — `domain-mappings.md`; all nine REQ-12 domains on five axes; no mapping makes the desktop a source of truth for a parent-owned record
- [x] Tender document flow follows existing Worker/R2/D1 architecture — `domain-mappings.md` §9; topology read from source, and **`requireR2=1` turns INT-4 into a server-side guarantee** — the parent returns 404 rather than falling back to a government URL
- [x] Every apparent gap was searched against parent code/spec/TODO evidence — `workspace-gap-report.md` §1; eight searches, which **reclassified four items** and avoided four duplicate proposals out of thirteen
- [x] Gap classifications and parent approval boundaries are complete — `workspace-gap-report.md`; 47 gaps across all six categories, every parent item routed to a separate specification. **Zero new parent endpoints are needed**
- [x] Phase 2 plan is a small vertical slice with rollout and rollback gates — `phase-2-plan.md`; authenticated shell, eight reasoned non-goals, 16 acceptance criteria, three-level rollback, six approval gates. **Plan only** — no Phase 2 code or spec

### Deferred Phase 0 pre-checks — all three resolved

- [x] **Parent auth contract** (deferred from TASK-0.9) — resolved in TASK-1.3. INT-1 settled: Bearer token from the login response body, backed by `jwt-auth.ts:25-52` **and** a parent test asserting the precedence
- [x] **Parent API contract** (deferred from TASK-0.7) — resolved in TASK-1.4. `src/lib/api-client.ts` read and closed as an input; it defines no contract. The parent-internal API has **no single envelope** — nine shapes — which confirms Phase 0's per-call-site schema design was right
- [x] **Parent brand hues** (deferred from TASK-0.8) — resolved and **passing**. Five of seven hues match the parent's light-theme brand exactly, two shift 3°; saturation/lightness differences are the deliberate, test-guarded dark-surface contrast corrections. **The divergence was recorded, not "fixed"** — re-aligning to the parent's light hues would reintroduce six WCAG 2.2 AA failures, and re-aligning to the parent's *dark* overrides would additionally abandon the brand hues (success 160→120, info 221→240)

## Final Evaluation

- [x] Every REQ, NFR, INT, and success criterion has linked evidence — see §Requirement Trace. **Three items are deliberately left open** with named reasons rather than ticked
- [x] Task and contract checklists are identical — verified **mechanically**, not by eye: 21 entries each, identical task sets, zero checkbox mismatches
- [x] No task was skipped, reordered, or combined without approved spec revision — TASK-1.1 → 1.8 executed in order, one commit each
- [x] No parent Tier 1, Tier 2, or Tier 3 file was modified — verified in the attached parent checkout: `git status --porcelain` **empty**, `git rev-list origin/aws-production-app..HEAD` = **0**, HEAD still at the baseline SHA, no stashes. This is a stronger claim than Phase 0's, which could only say the parent was inaccessible
- [x] No production write, migration, deployment, or automatic bid action occurred — Phase 1 performed reads only (`git show`/`log`/`diff` and filesystem reads); no production credentials were used
- [x] All scoped automated checks pass — see Evidence Record
- [x] Commit history uses task-specific messages — seven commits, `docs(desktop-workspace/1.N)`, each touching its own artifact plus the two checklist files; the two extra files are disclosed in their task evidence
- [x] Phase 2 implementation has not started without a new approved contract — `phase-2-plan.md` is a plan; no Phase 2 code, no Phase 2 spec, and `SPEC_CONTRACT.md`'s approved scope is unchanged

## Requirement Trace

| Req | Status | Evidence |
|-----|--------|----------|
| REQ-1 Repository foundation | **OPEN** | Tauri 2 + React 19 + strict TS + Rust + Vite 7 + Tailwind 4 + TanStack Query + Zustand + Zod all present — but **React Hook Form is absent and no accessible component foundation (Radix/shadcn) is installed**. Both are named in REQ-1. See §Result |
| REQ-2 Native shell | PASS | TASK-0.10; 23 tests |
| REQ-3 Runtime configuration | PASS | TASK-0.3; 7 tests, allowlist loader, fails closed |
| REQ-4 Secure authentication boundary | PASS | TASK-0.9 + TASK-1.3; two-condition gate; contract confirmed, production still gated |
| REQ-5 Typed API foundation | PASS | TASK-0.7; 16 tests. Transport must move to Rust for live calls (C-1) — a Phase 2 adapter swap behind the existing seam, not a foundation defect |
| REQ-6 Local data boundary | PASS | TASK-0.5; migrations + repository tests; no auth tokens in SQLite |
| REQ-7 Offline queue safety | PASS | TASK-0.6; 28 tests. Phase 1 confirmed no parent idempotency support (E-1) and identified `Application`'s unique constraint as the real replay guarantee |
| REQ-8 Observability and errors | PASS | TASK-0.11; allowlist redaction, independently re-applied in Rust; 35 tests |
| REQ-9 Quality tooling | PASS | TASK-0.12; CI green; packaging gated to human/approved CI |
| REQ-10 Model inventory | PASS | `model-inventory.md`, pinned to `8ff2e4c2` |
| REQ-11 Endpoint inventory | PASS | `endpoint-inventory.md`; route code outranks documentation throughout |
| REQ-12 Domain mappings | PASS | `domain-mappings.md`; nine domains × five axes |
| REQ-13 Auth decision record | PASS | `auth-subscription-contract.md` + accepted ADR; auth unmodified |
| REQ-14 Gap report | PASS | `workspace-gap-report.md`; 47 gaps; no duplicate proposal |
| REQ-15 Phase 2 handoff | PASS | `phase-2-plan.md` |
| REQ-16 Brief traceability | PASS | `docs/prompts/` verbatim; every task traces to REQ/INT refs; nothing claims a later phase is implemented |
| REQ-17 Design system | PASS | TASK-0.8; 34 assertions. Parent-hue fidelity check now **completed and passing** |
| PERF-1 | PASS | User-confirmed cold start under 3s |
| PERF-2 | **OPEN** | Pagination/bounded-list rule defined and enforced (PERF-3, E-1 findings), but the **100 ms input-acknowledgement target has never been measured** on the reference device. The Phase 0 harness records marks and deliberately asserts no threshold |
| PERF-3 | PASS | Indexed/bounded local queries; explicit `limit` required on every list call |
| SEC-1 | PASS | `core:default` + explicit command permissions; no generic shell |
| SEC-2 | PASS | OS keychain; AES-256-GCM for local payloads |
| SEC-3 | PASS | Reaffirmed by TASK-1.3 §8 — entitlement is server-authoritative and cannot be computed locally |
| SEC-4 | PASS | Signing secrets referenced by name only |
| REL-1 / REL-2 | PASS | TASK-0.6 state machine; all six states covered |
| A11Y-1 | PASS | jsx-a11y, keyboard/focus tests, WCAG AA contrast checks |
| PRIV-1 | PASS | Logout always clears locally — TASK-1.3 confirmed this is the *only* real logout, since the parent does not revoke |
| OPS-1 | PASS | Structured logs with version/environment/correlation context |
| INT-1 | PASS | Bearer contract audited; token treated as opaque; no JWT logic reimplemented |
| INT-2 | PASS | Per-endpoint validation; the "single envelope" premise was tested and **disproved** (nine shapes) |
| INT-3 | PASS | Server IDs retained; `updatedAt` as base version; no parent model has a version column |
| INT-4 | PASS | Worker/R2/D1 flow mapped; `requireR2=1` mandatory; `downloadUrl` excluded from the projection |
| INT-5 | PASS | Server-enforced entitlement; two response traps pinned by fixtures |
| INT-6 | PASS | Both parent OpenAPI documents compared to route code; all 16 endpoints marked `awaiting-contract` |
| INT-7 | PASS | Ten parent proposals, **none made**; parent tree verified untouched |
| INT-8 | PASS | Provenance fields identified per domain; five domains flagged |

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
| PERF-1 cold start | Human observation, user's Windows machine | PASS — under 3s (target 3s) | 2026-07-28 / `ea02e08` |
| PERF-1 first-run launch | Human observation, user's Windows machine | ~5s — one-time WebView2 + migration cost, not steady state | 2026-07-28 / `ea02e08` |
| PERF-1 warm start | Not separately timed | Bounded by the cold-start figure; judged acceptable by the user | 2026-07-28 / `ea02e08` |

Test totals at Phase 0: **187** (161 TypeScript + 26 Rust).

### Phase 1 evidence

All Phase 1 audits performed against parent commit **`8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1`** (`freelancing-solutions/tendersa`, branch `aws-production-app`, working tree clean, frozen registry v2.0).

| Gate | Command or document | Result | Date/commit |
|---|---|---|---|
| Parent read access | `git ls-files \| wc -l` in parent | PASS — 9794 tracked files, tree fully readable | 2026-07-28 / `8ff2e4c2` |
| Parent baseline pinned | `docs/audits/parent-baseline.md` | PASS — `be09f9d51` confirmed to exist, re-pinned to tip with disclosure | 2026-07-28 / `b611fa0` |
| Model inventory | `docs/audits/model-inventory.md` | PASS — 14 entities + vault; 193/193 domain-vs-generated, zero drift | 2026-07-28 / `eb7fb27` |
| Auth/subscription contract | `docs/audits/auth-subscription-contract.md`, `docs/architecture/auth.md` | PASS — contract CONFIRMED, production gated | 2026-07-28 / `8a3f4e4` |
| Endpoint inventory | `docs/audits/endpoint-inventory.md` | PASS — 16/714 under a stated rule; both OpenAPI docs compared | 2026-07-28 / `9c8c018` |
| Domain mappings | `docs/audits/domain-mappings.md` | PASS — 9 domains × 5 axes | 2026-07-28 / `0c05310` |
| Gap report | `docs/audits/workspace-gap-report.md` | PASS — 47 gaps; 0 new parent endpoints | 2026-07-28 / `b0514f7` |
| Phase 2 plan | `docs/audits/phase-2-plan.md` | PASS — plan only | 2026-07-28 / `826d1f9` |
| Parent unmodified | `git status --porcelain`; `git rev-list origin/aws-production-app..HEAD` | PASS — empty; 0 commits; HEAD at baseline; no stashes | 2026-07-28 |
| Task/contract parity | Automated diff of both checklists | PASS — 21/21, identical sets, 0 mismatches | 2026-07-28 |
| Gap-ID closure | Automated diff of defined vs classified IDs | PASS — 27/27 after fixing A-4, A-5, E-7 | 2026-07-28 |
| Formatting | `pnpm run format:check` | PASS | 2026-07-28 |
| Lint | `pnpm run lint` | PASS | 2026-07-28 |
| Types (strict) | `pnpm run typecheck` | PASS | 2026-07-28 |
| Frontend tests | `pnpm run test` | PASS — **187 tests, 14 files** (161 + 26 new contract tests) | 2026-07-28 |
| Frontend build | `pnpm run build` | PASS | 2026-07-28 |
| Rust formatting | `cargo fmt -- --check` | PASS | 2026-07-28 |
| Rust tests | `cargo test` | **NOT RE-RUN** — this container lacks the GTK/WebKit system libraries Tauri's Linux backend needs to compile, and installing them requires root the session does not have. **Phase 1 changed no Rust**: `git diff --name-only 105d5e4..HEAD -- src-tauri/ '*.rs' 'Cargo.*'` is empty, and the only non-documentation files changed are two TypeScript test files. Last green: 26 tests at Phase 0 `ea02e08`; CI re-runs them on push | 2026-07-28 |

Test totals now: **213** (187 TypeScript + 26 Rust, the latter from the last green run).

## Result

- **Status**: **PHASE 0 AND PHASE 1 COMPLETE** — with three named items left open below.
- **Phase 1 passing**: seven audit artifacts against a pinned, verified parent baseline; all three deferred Phase 0 pre-checks resolved; **no parent file created, modified, or deleted**, verified in the attached checkout; task and contract checklists mechanically identical; commit history task-scoped; every REQ/NFR/INT traced to evidence.

### Open items — precise, not hand-waved

Each is stated as a named blocker rather than ticked, per the rule that a recorded blocker is a valid outcome and a fabricated pass is not.

1. **REQ-1 is incomplete.** REQ-1 names "an accessible component foundation … React Hook Form". Neither is installed: `react-hook-form` is absent from `package.json`, and no Radix/shadcn package is present. Every other element of REQ-1 is satisfied. This is not new breakage — Phase 0's TASK-0.8 recorded that no shadcn/ui components were installed yet, and the login form is still a deliberately disabled shell with no form library needed. **Resolution**: both arrive with Phase 2's activated login form. Tracked as a Phase 2 acceptance item.
2. **PERF-2's 100 ms input-acknowledgement target has never been measured.** The pagination/bounded-list half is satisfied. The Phase 0 performance harness records marks but deliberately asserts no threshold, because a figure from CI or developer hardware would be evidence of nothing. **Resolution**: measure on the agreed Windows 11 reference device, as was done for PERF-1.
3. **Success criterion 4 is not met**: "the shell can call a non-destructive audited test endpoint through the typed transport and render validated data/error states." The shell has never made a live parent call. TASK-1.3 found why this could not have worked as built — **the parent sets no CORS headers on any route the desktop needs**, so webview `fetch` cannot reach it, and the transport must move to Rust. **Resolution**: this is precisely Phase 2's vertical slice (`phase-2-plan.md` §2, item 6, acceptance criteria A9/A13).

None of the three blocks Phase 1, and none is a defect in the audit. All three are Phase 2 work, and all three are scoped in `phase-2-plan.md`.

### Carried forward

- **Ten parent proposals** (P-1…P-10), each requiring its own approved parent-repository specification. None blocks Phase 2. **P-5 merits parent attention on its own terms**: `PUT /api/v1/company/profile` stores an unvalidated string that the unguarded `JSON.parse` on read then 500s on permanently — reachable from the existing web application, not only the desktop.
- **PA-1**: Phase 0's `src/tests/api-transport.test.ts` still carries Developer-API fixtures (`api.tenders-sa.org`, `cursor` pagination) that no main-application route uses. Configuration is correct; only the test fixture is misleading. Phase 2 re-points it under acceptance criterion **A16**.
- **Endpoint parity is binding**: the desktop consumes the **same parent-internal routes the main web application uses**, never the public Developer API. Recorded in `phase-2-plan.md` §2.
- **Open product decision, not a blocker**: the offline WebView2 installer costs +391 MB, roughly three times the estimate it was approved on, because NSIS and MSI each embed a copy. Dropping one installer format would remove one copy.
- **Phase 2 requires a new approved contract.** No Phase 2 code or specification exists, and this contract's approved scope is unchanged.

- **Approved by**: user, 2026-07-28 — Phase 0 launch and start-up confirmed acceptable. Phase 1 awaits review.
