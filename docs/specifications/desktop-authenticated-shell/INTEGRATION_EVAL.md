# Integration Evaluation — Tenders-SA Desktop Authenticated Shell (Phase 2)

> Update this file during implementation. No implementation is complete until every applicable
> item passes and evidence is recorded.
>
> **Current status: APPROVED — IN PROGRESS.** Approved 2026-07-29 (gate G1). TASK-2.1 is
> complete and found the parent unmoved, so implementation proceeds against `8ff2e4c2`.

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

- [ ] `tauri-plugin-http` added, registered, and requests confirmed to execute in Rust (CORS
      blocker cleared)
- [ ] Capability grants `http:default` plus an allowlist of **exactly one** entry — the API
      origin
- [ ] `dangerous-settings` and `unsafe-headers` features are **off**
- [ ] A request to an origin outside the allowlist is rejected by the plugin
- [ ] CSP `script-src 'self'` and the restricted `connect-src` are unchanged — **asserted by
      test**, because they are SEC-A2's exfiltration containment and not incidental hardening
- [ ] Transport adapter reuses TASK-0.7's policy layer without duplicating it
- [ ] Timeout, cancellation via `fetch_cancel`, 429-never-retried, bounded 5xx retry, offline,
      malformed 2xx covered
- [ ] `docs/architecture/auth.md` §2 superseded where it claims Rust assembles request headers
- [ ] **PA-1 closed** — no Developer API host or `/v1`–`/v2` path in source or fixtures, enforced
      by a test

## Phase 2B Evaluation — authentication

- [ ] `AuthFailureKind` expresses `account-inactive`, `rate-limited`, `server-error`
- [ ] Adapter parses **every** TASK-1.3 contract fixture
- [ ] `user === null` at HTTP 200 is treated as no session
- [ ] The renewal token from `/me` is persisted, preserving the sliding window
- [ ] Logout clears locally even when the remote call throws
- [ ] Token is opaque — never parsed, verified, or signed
- [ ] Token absent from SQLite, Zustand, browser storage, URLs and logs — asserted by test
- [ ] Token read from the keychain per request and **not retained** in any module-level or global
      JavaScript variable — asserted by test (SEC-A1)
- [ ] Login shell renders all five failure states; `rate-limited` surfaces `Retry-After`
- [ ] Password never appears in a thrown error or in the DOM
- [ ] Keyboard operation, accessible names, and error-to-field association pass

## Phase 2C Evaluation — first real read

- [ ] Subscription schema is hand-authored and marked `awaiting-contract`
- [ ] Synthesised free plan (`id: null`, `tier: 'free'`) parses and is **not** treated as "no
      entitlement"
- [ ] `feature-access` HTTP 500 with `hasAccess: false` surfaces as an error, not an upsell
- [ ] Failure parsing accepts `{error}` with and without `message`, and does not require
      `success: false`
- [ ] Command Centre renders loading, empty, error, and schema-validation-failure states
- [ ] A schema-validation failure is a handled state, never a crash
- [ ] Gate still requires both the flag and an adapter
- [ ] `ProtectedRoute`'s unauthenticated escape hatch disables itself — asserted by test

## Final Evaluation

- [ ] Every REQ, NFR, INT, and success criterion has linked evidence
- [ ] Task and contract checklists are identical — verified mechanically
- [ ] No task was skipped, reordered, or combined without approved spec revision
- [ ] No parent file was modified — verified in the attached parent checkout
- [ ] No production write, migration, deployment, or automatic bid action occurred
- [ ] All scoped automated checks pass
- [ ] Commit history uses task-specific messages
- [ ] Human or approved Windows CI evidence confirms package/build/launch
- [ ] **PERF-2 measured on the reference device** (PERF-A1) — carried from Phase 1 as open

## Carried-forward items from Phase 0–1

Three items were left open at the end of Phase 1 with named reasons. Two close here; one is
tracked but not owned by this slice.

| Item | Owner | Status |
|------|-------|--------|
| **REQ-1 incomplete** — React Hook Form and an accessible component foundation both absent | This slice, partially | The activated login form (TASK-2.7) is the natural place both arrive. **If TASK-2.7 ships without them, REQ-1 stays open** and must be recorded as such rather than quietly ticked |
| **PERF-2 unmeasured** | This slice | PERF-A1; measured at TASK-2.11 |
| **Success criterion 4** — shell has never made a live parent call | This slice | The whole point of TASK-2.8/2.9 |

## Evidence Record

| Gate | Command or document | Result | Date/commit |
|---|---|---|---|
| Specification structure | Manual cross-file review | PASS | 2026-07-29 / this commit |
| Contract approval (G1) | User | **PASS** | 2026-07-29 |
| TASK-2.1 parent re-verification | `docs/audits/parent-baseline.md` §7a | PASS — parent unmoved at `8ff2e4c2`; 18/18 claims confirmed | 2026-07-29 |

## Result

- **Status**: **APPROVED — IN PROGRESS**
- **Gate G1**: cleared 2026-07-29.
- **TASK-2.1**: complete. Parent unmoved at `8ff2e4c2`; no specification revision needed.
- **Outstanding gates**: G2 (adapter accepted as audited) blocks TASK-2.10; G3, G4, G5 unchanged.
