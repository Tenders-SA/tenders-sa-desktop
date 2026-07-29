# Tenders-SA Desktop Authenticated Shell Design

## Implementation Strategy

- **Approach**: Enhance existing. Phase 0 built the transport seam, auth ports, gated service,
  keychain commands, protected routing, and shell; this slice fills them in.
- **Justification**: every inbound dependency already exists and is tested. No foundational
  module is created, which is what keeps this slice small enough to be a first vertical.
- **Primary risks**: the HTTP plugin's URL allowlist being widened past the API origin; the
  Bearer token being retained in webview state rather than used transiently; the audited contract
  having drifted since the Phase 1 baseline; and the parent's `api-response-standardization` spec
  landing mid-slice.
- **Mitigation**: an allowlist of exactly one origin, asserted by test alongside the CSP
  restrictions that contain exfiltration (SEC-A2); keychain-at-rest storage with a
  no-retention test (SEC-A1); a mandatory contract re-verification before implementation
  (INT-A4); per-endpoint schemas that bound the blast radius of a parent envelope change to one
  adapter.

### Standing constraint: the desktop adapts to the platform

The Tenders-SA web application is in production and is **not modified to accommodate this
client**. The desktop is an extension of the existing platform, so every mismatch the Phase 1
audit found is absorbed on the desktop side. Phase 1 raised ten parent-side items (P-1…P-10);
**none is requested as a parent change**, and each has a desktop-side accommodation recorded in
`requirements.md` and the gap report's disposition note. Where an accommodation is uglier than a
parent fix would have been — string-matching login error strings (A-1) is the clearest case —
the ugliness stays on this side of the boundary.

## Architecture

```text
React feature UI  (LoginShell, Command Centre)
    │
    ▼
Auth service        GatedAuthService → ParentAuthAdapter (new)
    │  reads the token from the keychain per request, attaches it, discards it
    ▼
API transport       existing seam → TauriHttpTransport (new)
    │
    ▼  tauri-plugin-http — URL allowlist: the API origin ONLY
Rust  reqwest  ── HTTPS ──►  Main Tenders-SA application API
                              /api/auth/*, /api/subscription/*

Rust  security::secret_store  ──►  OS keychain   (token at rest, here only)
```

## Transport decision — `tauri-plugin-http`, and its recorded tradeoff

**Decision: use `tauri-plugin-http`.** This is a directed decision, made by the product owner on
2026-07-29, and it is recorded here with its consequences rather than silently absorbed.

### What it gets right

Verified by reading the plugin source (`tauri-plugin-http` 2.5.2, `src/commands.rs`,
`src/scope.rs`, `permissions/default.toml`) rather than from memory:

- **It solves the blocker.** The request is executed in Rust via `reqwest`, so browser CORS
  enforcement does not apply. This is the whole reason the slice exists
  (`auth-subscription-contract.md` §6).
- **It is default-deny on origins.** `permissions/default.toml` states the default permission
  set "enables all fetch operations but does not allow explicitly any origins to be fetched.
  This needs to be manually configured before usage." Scope is enforced in the command itself —
  `commands.rs:229` calls `is_allowed(&url)` against the chained command and global
  allow/deny lists.
- **It normalises the `Origin` header** (`commands.rs:290-295`), setting it to the target's own
  origin. The parent therefore never sees a `tauri://` origin, so nothing about this depends on
  parent-side behaviour.
- **It blocks forbidden headers** per the fetch spec unless the `unsafe-headers` feature is
  enabled. We will not enable it.

**Configuration**: the capability grants `http:default` plus an explicit allowlist of exactly
one entry — the configured API origin. No wildcard host, no second entry. The `dangerous-settings`
and `unsafe-headers` features stay off.

### The tradeoff, stated plainly

`tauri-plugin-http` takes request headers **from the caller** (`commands.rs:73`,
`headers: Vec<(String, String)>`). The `Authorization` header therefore has to be supplied by
TypeScript, which means **the token is briefly present in webview memory** on every request.

That is a real reduction in the boundary Phase 1 originally proposed, where Rust attached the
header and the webview never held the credential. It is not a hypothetical difference: an XSS
foothold in the webview could read the token during a request.

### Why it is nonetheless an acceptable posture here

Not "it's fine" — specifically, the exfiltration paths are narrow, and SEC-A2 requires keeping
them that way:

| Path an attacker would need | Status |
|---|---|
| Load a remote script | Blocked — CSP `script-src 'self'` |
| `fetch`/`XHR` to an attacker host | Blocked — CSP `connect-src 'self' ipc: http://ipc.localhost` |
| Use the HTTP plugin to POST the token elsewhere | Blocked — plugin allowlist contains only the API origin |
| Read the token from persistent storage | Nothing to read — at rest it is in the OS keychain only |
| Read a long-lived JS variable | Denied by design — the token is fetched per request and not retained |

The residual risk is a same-request-window read under an XSS that also has an existing
exfiltration channel. Given `script-src 'self'` and a bundled application with no remote script
sources, that is a materially smaller surface than the general case.

**Mitigations that are requirements, not intentions**: SEC-A1 forbids retaining the token in any
JS variable beyond the request; SEC-A2 requires tests asserting both the plugin allowlist and the
CSP restrictions. If either regresses, a test fails.

### Handling of the two sensitive headers

- **`Authorization`**: read from the keychain immediately before the request, passed to the
  plugin, not stored. No module-level cache.
- **`x-csrf-token`**: held in memory for the session (it is re-minted at every login and is not a
  bearer credential), attached to mutations. Its absence never blocks anything.

### What this changes from the Phase 1 position

`docs/architecture/auth.md` §2 records the Phase 1 decision as "requests are issued from Rust,
not from webview `fetch`". That remains **true** — the plugin issues them from Rust. The part
that changes is *who assembles the headers*. TASK-2.2 updates that ADR so the record matches the
implementation rather than leaving a stale claim, in the same superseding style used for
`docs/architecture/api.md` §0.

## Transport adapter

`TauriHttpTransport` implements the interface TASK-0.7 already defined, so the policy layer —
timeout, cancellation, bounded retry for safe idempotent operations, error normalisation,
correlation IDs — is reused rather than reimplemented. Only the byte-moving changes.

Cancellation uses the plugin's own `fetch_cancel` command, which the permission set already
grants (`allow-fetch-cancel`), so an aborted request is genuinely cancelled rather than merely
abandoned. This is better than the hand-rolled alternative would have been, and it is a point in
the plugin's favour.

**CSP `connect-src` is deliberately not widened.** The plugin does not route through the webview's
network stack, so it needs no CSP allowance — and leaving `connect-src` restricted is load-bearing
for SEC-A2, because it is what stops ordinary `fetch` from reaching an external host. Widening it
would quietly remove one of the containment guarantees.

## Auth adapter

`ParentAuthAdapter implements AuthPort`, built directly on the contract fixtures from TASK-1.3.

| Operation | Behaviour |
|-----------|-----------|
| `login` | `POST /api/auth/login` → on 200, store `data.token` in the keychain, hold `data.csrfToken` in memory, return a `SessionSummary` |
| `restoreSession` | `GET /api/auth/me` → **`user === null` means no session**, despite HTTP 200. On success, **replace** the stored token with the returned one |
| `logout` | `POST /api/auth/logout`, then clear the keychain **unconditionally** |

`SessionSummary.expiresAt` is left **absent**. The contract exposes no expiry the desktop may
read without parsing the JWT, which INT-1 forbids. The port already declares the field optional
for exactly this case. Expiry is discovered by `/me` returning `user: null`, or by a 401.

### Failure mapping

| Parent response | `AuthFailureKind` |
|-----------------|-------------------|
| 401 `Invalid credentials` | `invalid-credentials` |
| 401 `Invalid credentials or account not set up for password login` | `invalid-credentials` |
| 401 `Account is not active. …` | `account-inactive` **(new)** |
| 429 + `Retry-After` | `rate-limited` **(new)**, carrying the retry seconds |
| 5xx, or unparseable body | `server-error` **(new)** |
| Transport failure | `network` |
| Gate closed | `disabled` / `contract-unconfirmed` |

`account-inactive` requires **string-matching the `error` value**, because the parent emits no
machine-readable code (gap A-1). This is brittle by construction and is isolated in one mapping
function with the exact strings pinned by fixtures, so a parent copy edit fails a test rather
than silently degrading a user into a dead end. Gap A-1 proposes the parent-side fix.

## Session lifecycle

| Trigger | Action |
|---------|--------|
| Login 200 | `session_store(token)`; csrfToken → memory |
| App start | `restoreSession()` → `/me` |
| `/me` 200 with `user` | **overwrite** stored token — sliding 7-day window |
| `/me` 200 with `user: null` | `session_clear()`, unauthenticated |
| Any 401 | `session_clear()`, unauthenticated |
| Logout | remote call, then `session_clear()` regardless of outcome |
| Device reset | `session_clear()` + local purge, after human confirmation |

**Overwriting on renewal is load-bearing.** Skipping it converts the sliding window into a hard
7-day expiry that logs the user out mid-work, and the failure would appear a week after release.

## Subscription read path

`GET /api/subscription/status`, chosen because it is authenticated, non-mutating,
already-fixtured, and one of only two endpoint groups rated High stability.

Its schema is hand-authored and marked `awaiting-contract` (INT-6) — neither parent OpenAPI
document describes the parent-internal API. Two audited traps are handled explicitly:

- **`subscription === null` is not "no entitlement".** A user with application credits but no
  subscription receives a *synthesised* plan with `id: null` and `tier: 'free'`. Branching on
  null alone hides features they have paid for.
- **`currentPeriodStart` is hard-coded `null`** in both branches; no billing start is rendered.

The Command Centre renders plan, tier, slots, and credits, replacing placeholder content. It
renders loading, empty, error, and validation-failure states — REL-A1 requires the last to be a
handled state, not a crash.

## Files to Create

| Path | Purpose |
|---|---|
| `src/services/api/tauri-http-transport.ts` | Transport adapter over `tauri-plugin-http` |
| `src/services/auth/parent-auth-adapter.ts` | Audited `AuthPort` implementation |
| `src/services/api/endpoints/subscription.ts` | Endpoint adapter + Zod schema |
| `src/features/command-centre/SubscriptionPanel.tsx` | Real-data panel |
| `src/tests/parent-auth-adapter.test.ts` | Adapter contract tests |
| `src/tests/tauri-http-transport.test.ts` | Transport tests |
| `src/tests/capability-scope.test.ts` | Asserts the HTTP allowlist and CSP restrictions (SEC-A2) |
| `src/tests/endpoint-parity.test.ts` | Asserts no Developer API host or `/v1`–`/v2` path |

## Files to Modify

| Path | Change |
|---|---|
| `src/services/auth/ports.ts` | Extend `AuthFailureKind`; add optional retry metadata |
| `src/services/auth/gated-auth-service.ts` | Accept the adapter; map new failure kinds |
| `src/features/auth/LoginShell.tsx` | Activate; render all failure states |
| `src/features/command-centre/**` | Mount the subscription panel |
| `src-tauri/Cargo.toml`, `package.json` | Add `tauri-plugin-http` / `@tauri-apps/plugin-http` |
| `src-tauri/src/lib.rs` | Register the plugin |
| `src-tauri/capabilities/default.json` | Add `http:default` + an allowlist of exactly the API origin |
| `docs/architecture/auth.md` | Supersede §2's header-assembly claim (TASK-2.2) |
| `src/tests/api-transport.test.ts` | **PA-1** — re-point Developer-API fixtures |
| `src/tests/auth-service.test.ts`, `login-shell.test.tsx` | Cover new failure kinds |
| `.env.example`, config schema | API base URL documentation if needed |
| `CHANGELOG.md` | First user-visible behaviour change |

## Testing and Validation Plan

- **Contract**: the adapter parses every TASK-1.3 fixture; the audited traps stay asserted.
- **Adapter**: login success and all five failures; restore with `user: null`; renewal-token
  persistence; logout-always-clears including when the remote call throws.
- **Transport**: timeout, cancellation, 429 never retried, bounded retry on 5xx, offline,
  malformed 2xx.
- **Scope**: a request to any origin outside the allowlist is rejected by the plugin; the
  capability file contains exactly one allowed origin; the CSP still forbids remote scripts and
  external `connect-src`.
- **Security**: token absent from SQLite, Zustand, browser storage, URLs and logs, and not
  retained in any module-level or global JS variable beyond the request that uses it.
- **Component**: `LoginShell` in every failure state; keyboard, focus, accessible names, error
  association.
- **Parity**: a test greps source and fixtures for the Developer API host and `/v1`–`/v2` paths.
- **Integration**: local mock server only. **Never production.**

## Migration, Rollback, and Compatibility

- No database migration; the slice has no write path and no new local table.
- Rollback is `desktopAuth=false` (instant and total, because the gate needs both conditions),
  or reverting the slice's commits. Neither touches parent runtime or local data.
- **Forward-compatibility watch**: the parent's unimplemented `api-response-standardization`
  spec names `auth/login/route.ts` in its files-to-modify list. If it lands, login's shape
  changes. Per-endpoint schemas confine that to one adapter, and boundary validation fails
  visibly rather than corrupting state. **Do not design around it** — watch it.
