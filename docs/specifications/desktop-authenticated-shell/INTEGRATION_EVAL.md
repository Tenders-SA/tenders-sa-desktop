# Integration Evaluation — Tenders-SA Desktop Authenticated Shell (Phase 2)

> Update this file during implementation. No implementation is complete until every applicable
> item passes and evidence is recorded.
>
> **Current status: PENDING APPROVAL — NOT STARTED.** This specification was authored on
> 2026-07-29 following the merge of the Phase 0–1 contract. No Phase 2 code exists.

## Specification Validation

- [x] Derived from an approved, evidence-based audit — `docs/audits/phase-2-plan.md` (TASK-1.7)
- [x] Predecessor contract complete — Phase 0–1 merged, three open items carried here explicitly
- [x] Reality check recorded: enhance existing, no new foundational module, no duplicate backend
- [x] Frozen-module assessment completed; no parent mutation is in scope
- [x] Requirements, design, tasks, contract, and evaluation files created
- [x] Every task maps to requirements/design and includes files, pre-check, verification, commit
- [x] Contract task list mirrors `tasks.md` at specification creation
- [x] Rollback, security, and compatibility constraints documented
- [ ] **User approved the specification** — status remains `PENDING APPROVAL`

## Pre-Implementation Check

- [ ] `SPEC_CONTRACT.md` status is `APPROVED`
- [ ] Desktop worktree is clean except approved scope
- [ ] **Parent contract re-verified at a current baseline** (TASK-2.1) — the Phase 1 audit is
      pinned at `8ff2e4c2` and is a point-in-time artifact; commit `9fd93b2` showed in-scope
      parent routes moving within days
- [ ] Parent repository readable for that re-verification
- [ ] No unapproved parent repository edit is required

## Phase 2A Evaluation — transport

- [ ] Native HTTP command takes a **path, not a URL**, and rejects schemes, authorities and `..`
- [ ] `Authorization` is attached in Rust; the webview cannot set, read, or override it
- [ ] Command errors carry no secret material
- [ ] Transport adapter reuses TASK-0.7's policy layer without duplicating it
- [ ] Timeout, cancellation, 429-never-retried, bounded 5xx retry, offline, malformed 2xx covered
- [ ] CSP `connect-src` remains unwidened
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
- [ ] Token never reachable from webview JavaScript — asserted by test
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
| Contract approval | User | **PENDING** | — |

## Result

- **Status**: **PENDING APPROVAL — NOT STARTED**
- **Blocking**: gate G1. No Phase 2 file may be written until the user approves this contract.
- **First action after approval**: TASK-2.1 — re-verify the audited parent contract at a current
  baseline. If the contract has moved materially, the specification is revised before any code
  is written.
