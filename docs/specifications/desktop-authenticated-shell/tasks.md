# Tenders-SA Desktop Authenticated Shell — Implementation Tasks

> **READ BEFORE STARTING**: Read all five specification files. **Do not implement while
> `SPEC_CONTRACT.md` is `PENDING APPROVAL`.** Do not skip, reorder, or combine tasks. Complete
> each pre-check and verification before marking a task complete. Mirror every checkbox change
> in `SPEC_CONTRACT.md`.

## Current Status

- [x] Specification approved by user — 2026-07-29 (gate G1)
- [x] Contract re-verified against parent source at a current baseline — TASK-2.1
- [ ] Phase 2 slice implemented
- [ ] Integration evaluation passed
- [ ] All success criteria verified

## Phase 2A: Contract re-verification and transport

- [x] **TASK-2.1 — Re-verify the audited contract at a current parent baseline**
  - *Refs*: INT-A4, INT-A1
  - *Files*: update `docs/audits/parent-baseline.md` with a Phase 2 baseline entry; update
    `src/tests/fixtures/parent-auth-contract.ts` only if the contract moved
  - *Pre-check*: confirm the parent repository is attached and readable; record the current
    default-branch tip
  - *Verify*: every claim in `auth-subscription-contract.md` §2–§8 is re-read from parent source
    at the new SHA; each is confirmed unchanged or the change is recorded with its impact. If
    the contract moved materially, **stop** and revise the specification before implementing
  - *Commit*: `docs(auth-shell/2.1): re-verify parent auth contract`
  - *Evidence*: `docs/audits/parent-baseline.md` §7a. **Pre-check**: parent attached and readable — 9794 tracked files, worktree clean. **The parent has not moved**: `origin/aws-production-app` is still `8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1`, **0 commits** since the audit baseline, and all 15 files cited by `auth-subscription-contract.md` are unchanged. Byte-identity follows from the SHA, but the **18 load-bearing behavioural claims were re-asserted directly against source anyway** rather than inferred: Bearer precedence plus the parent test guarding it, the login body token and `sameSite: 'strict'` cookie, the 10-per-15-minute IP-keyed limiter, the three status-indistinguishable 401s, `/me`'s 200-with-`user: null` and its token re-minting and lower-cased tier overlay, the absence of any revocation primitive, the 7-day expiry, CSRF validated by exactly one route and none in middleware, `/api/auth/me` on the public allowlist while the subscription routes are gated, the synthesised free plan with `id: null`, `feature-access`'s `hasAccess: false` inside its HTTP 500, and no CORS on any needed route. **All 18 confirmed.** One check failed on first run — the synthesised-free-plan assertion — and investigating showed a too-narrow `grep -A3` window rather than a contract change (`id: null` is four lines in); the finding stands and the check was wrong, which is recorded because a silently "fixed" check is exactly the kind of thing this task exists to catch. **No specification revision is required**; implementation proceeds against `8ff2e4c2`. No parent file was modified.

- [x] **TASK-2.2 — Add and scope `tauri-plugin-http`**
  - *Refs*: REQ-A1, SEC-A2, SEC-A3
  - *Files*: update `src-tauri/Cargo.toml`, `package.json`, `src-tauri/src/lib.rs`,
    `src-tauri/capabilities/default.json`; create `src/tests/capability-scope.test.ts`; update
    `docs/architecture/auth.md`
  - *Pre-check*: read the pinned plugin's `permissions/default.toml` and `src/scope.rs` to
    confirm the default grants **no** origin, and confirm no existing capability already grants
    HTTP reach
  - *Verify*: the capability grants `http:default` plus an allowlist of **exactly one** entry —
    the configured API origin; `dangerous-settings` and `unsafe-headers` features are **off**;
    CSP `script-src 'self'` and the restricted `connect-src` are unchanged; a test asserts the
    allowlist length, its contents, and both CSP directives, so widening any of them fails CI.
    `docs/architecture/auth.md` §2 is superseded where it claims Rust assembles the headers
  - *Commit*: `feat(auth-shell/2.2): add scoped http plugin`
  - *Evidence*: `tauri-plugin-http` 2.5.9 added to `src-tauri/Cargo.toml` with **`default-features = false`** and registered in `lib.rs`; `@tauri-apps/plugin-http` 2.5.9 added to `package.json`. **Pre-check**: confirmed no existing capability granted any HTTP reach (`core:default` + the five `allow-*` command permissions + `sql:*` only), and re-read the pinned plugin's `permissions/default.toml` and `src/scope.rs` to confirm the default set "enables all fetch operations but does not allow explicitly any origins to be fetched" — default-deny on origins, enforced by `is_allowed(&url)` inside the command. **The allow-list is `[{ "url": "http://localhost:3000/api/*" }]` — exactly one entry, path-scoped rather than a bare host.** A design point worth recording: capability allow-lists are **build-time** and cannot read `VITE_API_BASE_URL`, which looks like it collides with REQ-3's "no hard-coded production endpoints". It does not, because the two do different jobs — runtime config *chooses* the origin, the capability *bounds* the set of origins config may point at, and a config value outside the list fails closed. Only the localhost dev origin is listed now; the production origin is added at release time under gate **G5**, which already exists for exactly that decision. **`src/tests/capability-scope.test.ts` (13 tests) makes the boundary enforceable rather than aspirational**, parsing the shipped `default.json`, `tauri.conf.json` and `Cargo.toml` instead of restating their values: allow-list present, exactly one entry, path-scoped, no wildcard host or scheme, no Developer API host (REQ-A14), no `fs:`/`shell:`/`opener:` alongside it, `script-src 'self'` exact, `connect-src` containing `'self'` but **not** the API host or a wildcard, `object-src 'none'`, `base-uri 'self'`, and neither `dangerous-settings` nor `unsafe-headers` enabled. The `connect-src` assertion is the counter-intuitive one and is commented as such: the plugin does not use the webview network stack, so `connect-src` needs no allowance for the API — and a future task "letting the API through" there would delete a containment guarantee while gaining nothing. `docs/architecture/auth.md` §2 is superseded in part: its conclusion (requests from Rust, CORS not applicable) stands, but its claim that the webview "never holds the credential" is now **inaccurate** and is replaced by SEC-A1/SEC-A2's tested containment, with the residual same-request-window XSS risk recorded rather than glossed. **Verification gap, stated rather than hidden**: `cargo check` could not run — this container lacks the GTK/WebKit libraries Tauri's Linux backend needs and installing them requires root. `cargo metadata` resolves the graph and `cargo fmt --check` passes, but the `lib.rs` change is **compiled for the first time in CI**. Frontend gates all pass: `format:check`, `lint`, `typecheck`, `test` (**200 passing**, 187 + 13 new).

- [x] **TASK-2.3 — Implement the transport adapter**
  - *Refs*: REQ-A2, REL-A2, PERF-3
  - *Files*: create `src/services/api/tauri-http-transport.ts`,
    `src/tests/tauri-http-transport.test.ts`
  - *Pre-check*: confirm TASK-0.7's transport seam is consumed as-is, with no duplicated
    timeout, retry, or error-normalisation logic
  - *Verify*: timeout, caller cancellation **via the plugin's `fetch_cancel`**, 429 never
    auto-retried, bounded retry on 5xx, offline, and malformed 2xx all covered; a request to an
    origin outside the allowlist is rejected; CSP `connect-src` remains unwidened
  - *Commit*: `feat(auth-shell/2.3): route transport through the http plugin`
  - *Evidence*: `src/services/api/tauri-http-transport.ts` plus a new `ApiTransport.request()` path; `src/tests/tauri-http-transport.test.ts` (21 tests). **Pre-check confirmed the seam was designed correctly**: the plugin's `fetch` is signature-compatible with the web one (`(input, init?) => Promise<Response>`), so retargeting is an **injection into TASK-0.7's existing `fetchImpl`**, not a rewrite — the timeout, cancellation, bounded-retry and error-normalisation policy is reused untouched (REQ-A2). `fetchImpl` stays injectable rather than hard-wired because the plugin's `fetch` throws outside a Tauri runtime, which would otherwise make the transport untestable. **Two real gaps in the Phase 0 transport had to be closed, both traceable to Phase 1 findings.** (1) It was **GET-only** and forced `apiSuccessEnvelope` — i.e. `{success, data}`. Per `endpoint-inventory.md` §3 the parent-internal API has **nine** top-level shapes with `success` absent from three, so `request()` takes a method plus a schema validating the **whole** body, with no envelope to unwrap (REQ-A12). (2) Its error parsing **required `success: false`**, which no parent-internal failure emits; `parentErrorSchema` accepts `{error}` with or without `message`, covering both the route-handler and middleware forms. **A deliberate behaviour change is recorded rather than slipped in**: REQ-A6 requires that a 429 never be auto-retried, but Phase 0 listed `rate-limited` as transient and a Phase 0 test asserted the retry. `ApiError.isTransient` now excludes it and the Phase 0 test was rewritten to assert the new behaviour with the reasoning inline — the parent's limiter is IP-keyed, 10 per 15 minutes, and **deliberately not reset on success**, so retrying spends the user's own budget for nothing and can lock out everyone behind one office NAT. `Retry-After` is now parsed into `ApiError.retryAfterSeconds` so the UI can show a real wait instead of guessing. Mutations also default to `retry: "never"` because **no parent endpoint supports an idempotency key**, making a replayed POST a genuine duplicate. Validation issues are dropped from `malformed` errors rather than attached, since they quote the offending values which may be tender or proposal content (REQ-8) — asserted by a test that plants a pricing-shaped string and checks it reaches neither the message nor the log fields. Verified: `format:check`, `lint`, `typecheck`, `test` (**221 passing**, 200 + 21 new).

- [x] **TASK-2.4 — Close the endpoint-parity gap (PA-1)**
  - *Refs*: REQ-A14, INT-A3
  - *Files*: update `src/tests/api-transport.test.ts`; create `src/tests/endpoint-parity.test.ts`
  - *Pre-check*: enumerate every occurrence of the Developer API host and `/v1`–`/v2` paths in
    desktop source and fixtures
  - *Verify*: fixtures use a main-application base URL and `page`/`limit` pagination; a test
    fails if any Developer API host or `/v1`–`/v2` path reappears anywhere in source
  - *Commit*: `test(auth-shell/2.4): retarget fixtures at the main application api`
  - *Evidence*: `src/tests/endpoint-parity.test.ts` (9 tests) plus retargeted fixtures in `src/tests/api-transport.test.ts`. **Pre-check enumerated every occurrence**: PA-1 was confined to one file — 2 Developer-API host references and 16 `/v2/*` path literals in `api-transport.test.ts`. The two hits in `capability-scope.test.ts` are *negative* assertions (asserting the host is absent) and were correctly kept. Fixtures now use `http://localhost:3000`, `/api/*` paths, and `page`/`limit` pagination. A header comment states plainly what that file tests (retry/timeout/cancellation/envelope-unwrap policy) and what it does **not** imply, and records that `get()`/`apiSuccessEnvelope` have no production caller after Phase 2 — the `{success, data}` shape they assert is real, but it is parent **shape #1** (login), not a universal envelope, so whether to delete `get()` is left as an explicit cleanup decision for TASK-2.11 rather than silently removed here. **The guard shipped broken on its first draft and a sensitivity check caught it.** Rather than trust a passing test, I planted a violating file: the guard still passed. Cause: `stripComments` used `line.indexOf("//")`, which matches the `//` inside `https://` and truncated the line *before* the host, so the offending URL vanished and the entire guard was vacuous. Fixed to `line.replace(/(^|[^:])\/\/.*$/, "$1")`, which preserves scheme separators while still stripping real comments including those trailing a URL. Re-verified **both directions**: 9/9 pass clean, and 2 assertions fail with the canary present. Two regression tests now pin the fix so a future rewrite of the stripper cannot silently re-break it, and a "scans a non-trivial number of source files" assertion guards against a broken directory walk making everything pass vacuously. A second self-inflicted error was also corrected: the regression test initially asserted the *path* regex would fire on a full URL, which is wrong — in `https://host/v2/tenders` the `/v2/` is preceded by the host, not a quote, so the host check is what catches it; the assertion was narrowed and the reasoning recorded inline. The guard deliberately still permits `/api/v1/*`, which belongs to the main application and must stay usable — pinned by its own test so the rule cannot be over-tightened either. Verified: `format:check`, `lint`, `typecheck`, `test` (**230 passing**, 221 + 9 new).

## Phase 2B: Authentication

- [x] **TASK-2.5 — Extend the authentication failure union**
  - *Refs*: REQ-A5, REQ-A6
  - *Files*: update `src/services/auth/ports.ts`, `gated-auth-service.ts`,
    `src/tests/auth-service.test.ts`
  - *Pre-check*: confirm every failure state the audited contract produces is enumerated before
    changing the union
  - *Verify*: `account-inactive`, `rate-limited` (carrying retry seconds) and `server-error`
    exist; existing gate behaviour and its tests are unchanged
  - *Commit*: `feat(auth-shell/2.5): express audited auth failure states`
  - *Evidence*: `src/services/auth/ports.ts`; 3 new tests in `src/tests/auth-service.test.ts`. **Pre-check enumerated the contract's failure states before touching the union**, from the TASK-1.3 fixtures: `invalidCredentials`, `noPasswordSet`, `accountInactive`, `rateLimited`, `serverError`, plus transport failure and the two gate states. Phase 0's union could express only three of them, so **`account-inactive` and `rate-limited` would both have surfaced as `invalid-credentials`** — actively misleading, because there is no password an unverified-email user can type that will work. Added `account-inactive`, `rate-limited` and `server-error`, and gave `AuthError` an optional `retryAfterSeconds` set only for `rate-limited` (REQ-A6), so the UI can show the real wait instead of inviting an immediate retry into an IP-keyed limiter that is deliberately not reset on success. `account-inactive` and `invalid-credentials` both arrive as HTTP 401 and are separable only by the `error` string (gap A-1) — which is precisely why they need distinct kinds here rather than being collapsed. **Existing gate behaviour and its tests are unchanged**: the two-condition `isEnabled()` check and all 18 Phase 0 auth tests still pass untouched. Verified: `format:check`, `lint`, `typecheck`, `test` (**233 passing**, 230 + 3 new).

- [x] **TASK-2.6 — Implement the audited auth adapter**
  - *Refs*: REQ-A3, REQ-A4, REQ-A7, REQ-A8, INT-A1, SEC-A1
  - *Files*: create `src/services/auth/parent-auth-adapter.ts`,
    `src/tests/parent-auth-adapter.test.ts`
  - *Pre-check*: TASK-2.1 complete; the contract fixtures are current
  - *Verify*: the adapter parses **every** TASK-1.3 fixture; `user === null` at HTTP 200 is
    treated as no session; the renewal token is persisted; logout clears locally even when the
    remote call throws; the token is treated as opaque and never parsed; tests prove it is
    absent from SQLite, Zustand, browser storage, URLs and logs, and that it is read from the
    keychain per request rather than cached in a module-level or global variable (SEC-A1)
  - *Commit*: `feat(auth-shell/2.6): add audited parent auth adapter`
  - *Evidence*: `src/services/auth/parent-auth-adapter.ts`; `src/tests/parent-auth-adapter.test.ts` (26 tests). **Pre-check**: TASK-2.1 complete and the fixtures current. **The adapter is tested against the TASK-1.3 contract fixtures rather than hand-rolled bodies**, so it is proven to parse what the parent actually returns, not what a test author imagined. Three hand-authored schemas marked `awaiting-contract` per INT-6, each validating the **whole** body because there is no single envelope — login is parent shape #1 (`{success, data}`), `/me` is shape #7 (bare object), logout is shape #3 (bare `{success:true}`). **All four audited traps are handled and each has a test naming the failure it prevents.** (1) `/me` returning **HTTP 200 with `user: null`** is treated as no session and clears the dead token — a client reading the status would believe it was signed in forever. (2) The **re-minted token is persisted** on every `/me`; the test asserts the stored value changed, because skipping this converts the sliding 7-day window into a hard expiry that logs users out mid-work *a week after release*. (3) **Logout clears the keychain unconditionally** — in a `finally`, so a network failure, a 500, or a thrown error cannot prevent it; the parent has no revocation primitive, so the local clear *is* the logout, and refusing to clear because the network failed would leave the user signed in against their explicit instruction. (4) The **`account-inactive` 401 is separated by its pinned error string** (gap A-1), isolated in one `classifyLoginFailure` function with the string asserted equal to the audited fixture, so a parent copy edit fails a test rather than silently telling an unverified-email user to check a password that can never work. **A deliberate non-obvious choice**: a transient failure during `restoreSession` **rethrows and keeps the token** rather than clearing it — offline is not logged out, and discarding it would force a re-login every time the app opens on a bad connection; only a 401 or an explicit `user: null` clears. `SessionSummary.expiresAt` is left absent because the contract exposes no expiry readable without decoding the JWT, which INT-A1 forbids. **SEC-A1 is enforced and asserted, not just intended**: the token is read from the keychain per request — a test performs two restores and asserts **two** loads, which a cached token would fail — and `JSON.stringify(adapter)` is asserted not to contain it. A further test plants a realistic password and asserts it reaches neither the message, the stack, nor the serialised error (SEC-A3). The adapter reports `isEnabled(): true` deliberately: gating itself would let one condition satisfy the two-condition gate that `GatedAuthService` owns. Verified: `format:check`, `lint`, `typecheck`, `test` (**259 passing**, 233 + 26 new).

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
