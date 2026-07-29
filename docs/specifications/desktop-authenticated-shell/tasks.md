# Tenders-SA Desktop Authenticated Shell — Implementation Tasks

> **READ BEFORE STARTING**: Read all five specification files. **Do not implement while
> `SPEC_CONTRACT.md` is `PENDING APPROVAL`.** Do not skip, reorder, or combine tasks. Complete
> each pre-check and verification before marking a task complete. Mirror every checkbox change
> in `SPEC_CONTRACT.md`.

## Current Status

- [ ] Specification approved by user
- [ ] Contract re-verified against parent source at a current baseline
- [ ] Phase 2 slice implemented
- [ ] Integration evaluation passed
- [ ] All success criteria verified

## Phase 2A: Contract re-verification and transport

- [ ] **TASK-2.1 — Re-verify the audited contract at a current parent baseline**
  - *Refs*: INT-A4, INT-A1
  - *Files*: update `docs/audits/parent-baseline.md` with a Phase 2 baseline entry; update
    `src/tests/fixtures/parent-auth-contract.ts` only if the contract moved
  - *Pre-check*: confirm the parent repository is attached and readable; record the current
    default-branch tip
  - *Verify*: every claim in `auth-subscription-contract.md` §2–§8 is re-read from parent source
    at the new SHA; each is confirmed unchanged or the change is recorded with its impact. If
    the contract moved materially, **stop** and revise the specification before implementing
  - *Commit*: `docs(auth-shell/2.1): re-verify parent auth contract`

- [ ] **TASK-2.2 — Add the origin-scoped native HTTP command**
  - *Refs*: REQ-A1, SEC-A1, SEC-A2, SEC-A3
  - *Files*: create `src-tauri/src/commands/http.rs`; update `src-tauri/src/lib.rs`,
    `src-tauri/capabilities/default.json`
  - *Pre-check*: confirm the configured API origin is available to Rust from validated
    configuration, and that no existing capability already grants HTTP reach
  - *Verify*: the command accepts a **path, not a URL**; rejects schemes, authorities and `..`;
    attaches `Authorization` from the keychain so the webview cannot set, read, or override it;
    returns `SecurityError` carrying no secret material. `cargo test` covers each rejection case
  - *Commit*: `feat(auth-shell/2.2): add origin-scoped native http command`

- [ ] **TASK-2.3 — Implement the transport adapter**
  - *Refs*: REQ-A2, REL-A2, PERF-3
  - *Files*: create `src/services/api/tauri-transport.ts`, `src/tests/tauri-transport.test.ts`
  - *Pre-check*: confirm TASK-0.7's transport seam is consumed as-is, with no duplicated
    timeout, retry, or error-normalisation logic
  - *Verify*: timeout, caller cancellation, 429 never auto-retried, bounded retry on 5xx,
    offline, and malformed 2xx all covered; CSP `connect-src` remains unwidened
  - *Commit*: `feat(auth-shell/2.3): route transport through the native command`

- [ ] **TASK-2.4 — Close the endpoint-parity gap (PA-1)**
  - *Refs*: REQ-A14, INT-A3
  - *Files*: update `src/tests/api-transport.test.ts`; create `src/tests/endpoint-parity.test.ts`
  - *Pre-check*: enumerate every occurrence of the Developer API host and `/v1`–`/v2` paths in
    desktop source and fixtures
  - *Verify*: fixtures use a main-application base URL and `page`/`limit` pagination; a test
    fails if any Developer API host or `/v1`–`/v2` path reappears anywhere in source
  - *Commit*: `test(auth-shell/2.4): retarget fixtures at the main application api`

## Phase 2B: Authentication

- [ ] **TASK-2.5 — Extend the authentication failure union**
  - *Refs*: REQ-A5, REQ-A6
  - *Files*: update `src/services/auth/ports.ts`, `gated-auth-service.ts`,
    `src/tests/auth-service.test.ts`
  - *Pre-check*: confirm every failure state the audited contract produces is enumerated before
    changing the union
  - *Verify*: `account-inactive`, `rate-limited` (carrying retry seconds) and `server-error`
    exist; existing gate behaviour and its tests are unchanged
  - *Commit*: `feat(auth-shell/2.5): express audited auth failure states`

- [ ] **TASK-2.6 — Implement the audited auth adapter**
  - *Refs*: REQ-A3, REQ-A4, REQ-A7, REQ-A8, INT-A1, SEC-A1
  - *Files*: create `src/services/auth/parent-auth-adapter.ts`,
    `src/tests/parent-auth-adapter.test.ts`
  - *Pre-check*: TASK-2.1 complete; the contract fixtures are current
  - *Verify*: the adapter parses **every** TASK-1.3 fixture; `user === null` at HTTP 200 is
    treated as no session; the renewal token is persisted; logout clears locally even when the
    remote call throws; the token is treated as opaque and never parsed; tests prove it is
    absent from SQLite, Zustand, browser storage, URLs and logs
  - *Commit*: `feat(auth-shell/2.6): add audited parent auth adapter`

- [ ] **TASK-2.7 — Activate the login shell**
  - *Refs*: REQ-A5, A11Y-A1, SEC-A3
  - *Files*: update `src/features/auth/LoginShell.tsx`, `src/tests/login-shell.test.tsx`
  - *Pre-check*: confirm TASK-0.8 design tokens are used and no raw palette colours are
    introduced
  - *Verify*: all five failure states render distinctly; `rate-limited` surfaces `Retry-After`;
    the password never appears in a thrown error or in the DOM; keyboard operation, accessible
    names, and error-to-field association all pass
  - *Commit*: `feat(auth-shell/2.7): activate the login form`

## Phase 2C: First real read

- [ ] **TASK-2.8 — Add the subscription endpoint adapter**
  - *Refs*: REQ-A10, REQ-A11, REQ-A12, INT-A2
  - *Files*: create `src/services/api/endpoints/subscription.ts` and its tests
  - *Pre-check*: confirm the schema is hand-authored and marked `awaiting-contract`; confirm no
    global envelope is assumed
  - *Verify*: the synthesised free plan with `id: null` parses and is not treated as "no
    entitlement"; `currentPeriodStart: null` is handled; a `feature-access` HTTP 500 carrying
    `hasAccess: false` is surfaced as an error, not an upsell; failure parsing accepts `{error}`
    with and without `message`
  - *Commit*: `feat(auth-shell/2.8): add subscription endpoint adapter`

- [ ] **TASK-2.9 — Render real data in the Command Centre**
  - *Refs*: REQ-A10, REL-A1, A11Y-A1
  - *Files*: create `src/features/command-centre/SubscriptionPanel.tsx`; update the Command
    Centre and its tests
  - *Pre-check*: confirm no placeholder is presented as real functionality
  - *Verify*: loading, empty, error, and **schema-validation-failure** states all render; the
    last is a handled state, never a crash
  - *Commit*: `feat(auth-shell/2.9): render subscription data`

- [ ] **TASK-2.10 — Enable the gate**
  - *Refs*: REQ-A9, SEC-A4
  - *Files*: update configuration and documentation; no logic change
  - *Pre-check*: **human acceptance that the adapter is audited** (gate G2) — this task cannot
    start without it
  - *Verify*: `isEnabled()` still requires both the flag **and** an adapter; `desktopAuth=false`
    fully disables authentication; `ProtectedRoute`'s unauthenticated escape hatch disables
    itself, asserted by test
  - *Commit*: `feat(auth-shell/2.10): enable gated desktop authentication`

## Final Evaluation Gate

- [ ] **TASK-2.11 — Evaluate the authenticated shell**
  - *Refs*: all requirements and success criteria
  - *Files*: update `requirements.md`, `tasks.md`, `SPEC_CONTRACT.md`, `INTEGRATION_EVAL.md`
  - *Pre-check*: audit task/contract parity and trace every requirement to evidence
  - *Verify*: all automated gates pass; a human or approved Windows CI job confirms package and
    launch; **PERF-2 is measured on the reference device** (PERF-A1); no parent file was
    modified; commit history is task-scoped; the contract records PASS or a precise blocker
  - *Commit*: `docs(auth-shell/2.11): record authenticated shell evaluation`
