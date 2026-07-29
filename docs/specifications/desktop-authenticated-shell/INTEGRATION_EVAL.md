# Integration Evaluation — Tenders-SA Desktop Authenticated Shell (Phase 2)

> Update this file during implementation. No implementation is complete until every applicable
> item passes and evidence is recorded.
>
> **Current status: IMPLEMENTATION COMPLETE — TWO GATES OUTSTANDING.** All eleven tasks are
> done with recorded evidence, 310 tests pass, and no parent file was modified. Two items
> cannot be closed from this environment and are recorded as named blockers, not ticked:
> the Windows package/launch gate (**G4**) and the PERF-2 measurement. See §Result.

## Specification Validation

- [x] Derived from an approved, evidence-based audit — `docs/audits/phase-2-plan.md` (TASK-1.7)
- [x] Predecessor contract complete — Phase 0–1 merged, three open items carried here explicitly
- [x] Reality check recorded: enhance existing, no new foundational module, no duplicate backend
- [x] Frozen-module assessment completed; no parent mutation is in scope
- [x] **Platform-adaptation policy recorded** — the production web application is not modified
      for this client; all ten Phase 1 parent-side items are absorbed desktop-side
- [x] Requirements, design, tasks, contract, and evaluation files created
- [x] Every task maps to requirements/design and includes files, pre-check, verification, commit
- [x] Contract task list mirrors `tasks.md` at specification creation
- [x] Rollback, security, and compatibility constraints documented
- [x] **User approved the specification** — 2026-07-29, status `APPROVED` (gate G1)

## Pre-Implementation Check

- [x] `SPEC_CONTRACT.md` status is `APPROVED`
- [x] Desktop worktree is clean except approved scope
- [x] **Parent contract re-verified at a current baseline** (TASK-2.1) — the parent has **not
      moved**: still `8ff2e4c2`, 0 commits since, all 15 cited files unchanged, and 18/18
      load-bearing claims re-asserted against source
- [x] Parent repository readable for that re-verification — 9794 tracked files, worktree clean
- [x] No unapproved parent repository edit is required

## Phase 2A Evaluation — transport

- [x] `tauri-plugin-http` added, registered, and requests confirmed to execute in Rust (CORS
      blocker cleared)
- [x] Capability grants `http:default` plus an allowlist of **exactly one** entry — the API
      origin
- [x] `dangerous-settings` and `unsafe-headers` features are **off**
- [x] A request to an origin outside the allowlist is rejected by the plugin
- [x] CSP `script-src 'self'` and the restricted `connect-src` are unchanged — **asserted by
      test**, because they are SEC-A2's exfiltration containment and not incidental hardening
- [x] Transport adapter reuses TASK-0.7's policy layer without duplicating it
- [x] Timeout, cancellation via `fetch_cancel`, 429-never-retried, bounded 5xx retry, offline,
      malformed 2xx covered
- [x] `docs/architecture/auth.md` §2 superseded where it claims Rust assembles request headers
- [x] **PA-1 closed** — no Developer API host or `/v1`–`/v2` path in source or fixtures, enforced
      by a test

## Phase 2B Evaluation — authentication

- [x] `AuthFailureKind` expresses `account-inactive`, `rate-limited`, `server-error`
- [x] Adapter parses **every** TASK-1.3 contract fixture
- [x] `user === null` at HTTP 200 is treated as no session
- [x] The renewal token from `/me` is persisted, preserving the sliding window
- [x] Logout clears locally even when the remote call throws
- [x] Token is opaque — never parsed, verified, or signed
- [x] Token absent from SQLite, Zustand, browser storage, URLs and logs — asserted by test
- [x] Token read from the keychain per request and **not retained** in any module-level or global
      JavaScript variable — asserted by test (SEC-A1)
- [x] Login shell renders all five failure states; `rate-limited` surfaces `Retry-After`
- [x] Password never appears in a thrown error or in the DOM
- [x] Keyboard operation, accessible names, and error-to-field association pass

## Phase 2C Evaluation — first real read

- [x] Subscription schema is hand-authored and marked `awaiting-contract`
- [x] Synthesised free plan (`id: null`, `tier: 'free'`) parses and is **not** treated as "no
      entitlement"
- [x] `feature-access` HTTP 500 with `hasAccess: false` surfaces as an error, not an upsell
- [x] Failure parsing accepts `{error}` with and without `message`, and does not require
      `success: false`
- [x] Command Centre renders loading, empty, error, and schema-validation-failure states
- [x] A schema-validation failure is a handled state, never a crash
- [x] Gate still requires both the flag and an adapter
- [x] `ProtectedRoute`'s unauthenticated escape hatch disables itself — asserted by test

## Final Evaluation

- [x] Every REQ, NFR, INT, and success criterion has linked evidence
- [x] Task and contract checklists are identical — verified mechanically
- [x] No task was skipped, reordered, or combined without approved spec revision
- [x] No parent file was modified — verified in the attached parent checkout
- [x] No production write, migration, deployment, or automatic bid action occurred
- [x] All scoped automated checks pass
- [x] Commit history uses task-specific messages
- [ ] Human or approved Windows CI evidence confirms package/build/launch — **BLOCKED (gate G4)**: requires a human-triggered `workflow_dispatch` run and someone to install and start the result
- [ ] **PERF-2 measured on the reference device** (PERF-A1) — **BLOCKED**: needs the agreed Windows 11 reference device; a figure from CI or this container would be evidence of nothing

## Carried-forward items from Phase 0–1

Three items were left open at the end of Phase 1 with named reasons. One closes here; two do not.

| Item | Outcome |
|------|---------|
| **Phase 0–1 success criterion 4** — the shell had never made a live parent call | **CLOSED.** TASK-2.8/2.9 render `GET /api/subscription/status` through the plugin, transport, Bearer header and schema validation, end to end. The CORS finding explained why it could not have worked before |
| **Phase 0–1 REQ-1 incomplete** — React Hook Form and an accessible component foundation both absent | **STILL OPEN, and recorded rather than quietly ticked.** This file said at authoring time: *"If TASK-2.7 ships without them, REQ-1 stays open."* It did. `package.json` still has no `react-hook-form` and no Radix/shadcn package. The activated login form uses plain React state and hand-written accessible markup — `useId`, `aria-invalid`, `aria-describedby`, `role="alert"`, keyboard-tested — which **satisfies A11Y-A1 but not REQ-1 as written**. Two honest options for whoever picks this up: adopt both libraries in the slice that first needs a complex form (the company-profile slice is the obvious candidate), or propose amending REQ-1, since a hand-rolled accessible form is a legitimate engineering choice and the requirement may be over-prescriptive. **Not decided here** — it is a Phase 0–1 contract requirement and not this contract's to reinterpret |
| **PERF-2 unmeasured** | **STILL OPEN.** PERF-A1 required it and it is blocked, not skipped — see §Result |

## Evidence Record

| Gate | Command or document | Result | Date/commit |
|---|---|---|---|
| Specification structure | Manual cross-file review | PASS | 2026-07-29 |
| Contract approval (G1) | User | **PASS** | 2026-07-29 |
| Adapter accepted as audited (G2) | User | **PASS** | 2026-07-29 |
| TASK-2.1 parent re-verification | `docs/audits/parent-baseline.md` §7a | PASS — parent unmoved at `8ff2e4c2`; 18/18 claims re-asserted | 2026-07-29 |
| Task/contract parity | Automated diff of both checklists | PASS — 11/11, identical sets, 0 mismatches | 2026-07-29 |
| Parent unmodified | `git status --porcelain`; `git rev-list origin/aws-production-app..HEAD` | PASS — empty; 0 commits; HEAD still at baseline | 2026-07-29 |
| Formatting | `pnpm run format:check` | PASS | 2026-07-29 |
| Lint (incl. jsx-a11y) | `pnpm run lint` | PASS | 2026-07-29 |
| Types (strict) | `pnpm run typecheck` | PASS | 2026-07-29 |
| Frontend tests | `pnpm run test` | PASS — **310 tests, 21 files** | 2026-07-29 |
| Frontend build | `pnpm run build` | PASS | 2026-07-29 |
| Rust formatting | `cargo fmt -- --check` | PASS | 2026-07-29 |
| Rust compile / clippy / tests | GitHub Actions **Rust checks** | PASS on every Phase 2 commit — this is the only place `cargo check` can run, since the container lacks the GTK/WebKit libraries and root to install them | 2026-07-29 |
| Endpoint parity guard | `endpoint-parity.test.ts` + `capability-scope.test.ts` | PASS — 22 tests; verified in **both** directions (fails on a planted violation) | 2026-07-29 |
| Windows package/launch (G4) | — | **NOT RUN** — see §Result | — |
| PERF-2 on reference device | — | **NOT MEASURED** — see §Result | — |

## Result

- **Status**: **IMPLEMENTATION COMPLETE — TWO BLOCKERS, PRECISELY NAMED**
- **Gates cleared**: G1 (contract) and G2 (adapter accepted as audited), both 2026-07-29.
- **Passing**: all eleven tasks with recorded evidence; 310 frontend tests across 21 files;
  Rust compile/clippy/tests green in CI on every commit; format, lint, strict types and build
  all pass; task and contract checklists mechanically identical; **no parent file created,
  modified, or deleted**, verified in the attached parent checkout.

### Blocked, not skipped

Both need hardware or a human action this environment cannot supply. A recorded blocker is a
valid outcome; a fabricated pass is not.

1. **Windows package and launch — gate G4.** `.github/workflows/windows-package.yml` is
   `workflow_dispatch`-only *by design* (TASK-0.12 made packaging a human/approved-CI gate), and
   launch cannot be automated at all — someone must install the artifact and start it. Phase 0
   closed the equivalent gate exactly this way, with the user running the build. **Note the
   payload changed**: this slice adds `tauri-plugin-http` and its `reqwest`/TLS dependency tree,
   so the Windows artifact size should be re-checked against the 399 MB Phase 0 figure.
2. **PERF-2's 100 ms input-acknowledgement target.** Carried from Phase 1 as PERF-A1. It must be
   measured on the agreed Windows 11 reference device; a figure from CI or this Linux container
   would be evidence of nothing, which is why the Phase 0 harness deliberately asserts no
   threshold.

### Also still open, and not this contract's to close

**Phase 0–1 REQ-1** remains incomplete: React Hook Form and an accessible component foundation
are both still absent. This file predicted the possibility and required it be recorded rather
than ticked, and it happened — the activated form uses plain React state with hand-written
accessible markup, which satisfies A11Y-A1 but not REQ-1 as written. See the carried-forward
table for the two honest ways to resolve it.

### Gates still outstanding

| Gate | Meaning |
|------|---------|
| **G3** | Enabling `desktopAuth`. The flag is now load-bearing and is deliberately left `false`; the adapter exists, so flipping it is a real decision |
| **G4** | Windows package + launch verification |
| **G5** | Production endpoint configuration — also requires adding the production origin to the http allow-list in `src-tauri/capabilities/default.json`, which is a build-time security boundary, not runtime config |

### Watch item

The parent's unimplemented `api-response-standardization` spec names `auth/login/route.ts` in its
files-to-modify list. If it lands, login's response shape changes. Per-endpoint schemas confine
the blast radius to one adapter and boundary validation fails visibly rather than corrupting
state, so the action is to **watch it**, not to design around it.
