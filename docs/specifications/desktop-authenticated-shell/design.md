# Tenders-SA Desktop Authenticated Shell Design

## Implementation Strategy

- **Approach**: Enhance existing. Phase 0 built the transport seam, auth ports, gated service,
  keychain commands, protected routing, and shell; this slice fills them in.
- **Justification**: every inbound dependency already exists and is tested. No foundational
  module is created, which is what keeps this slice small enough to be a first vertical.
- **Primary risks**: the new native HTTP command becoming a general-purpose fetch primitive; a
  token leaking into webview state; the audited contract having drifted since the Phase 1
  baseline; and the parent's `api-response-standardization` spec landing mid-slice.
- **Mitigation**: origin-scoping enforced in Rust and asserted by test; keychain-only storage
  with a non-leakage test; a mandatory contract re-verification before implementation (INT-A4);
  per-endpoint schemas that bound the blast radius of a parent envelope change to one adapter.

## Architecture

```text
React feature UI  (LoginShell, Command Centre)
    │  no token ever reaches this layer
    ▼
Auth service        GatedAuthService → ParentAuthAdapter (new)
    │
    ▼
API transport       existing seam → TauriTransport (new)
    │
    ▼  Tauri IPC — narrow, origin-scoped
Rust  http::request (new)  ── HTTPS ──►  Main Tenders-SA application API
    │                                     /api/auth/*, /api/subscription/*
    ▼
Rust  security::secret_store  ──►  OS keychain  (token lives only here)
```

Two properties this topology exists to guarantee:

1. **The token never enters webview JavaScript.** It is written to and read from the keychain by
   Rust, and attached to outgoing requests by Rust. The webview asks for "a request to path X";
   it never holds the credential.
2. **Browser CORS does not apply.** Native HTTP from Rust is not subject to it, which is what
   makes the parent reachable at all (`auth-subscription-contract.md` §6).

## The native HTTP command — the highest-risk decision

```rust
// src-tauri/src/commands/http.rs   (shape, not final code)
#[tauri::command]
async fn api_request(
    method: HttpMethod,      // closed enum: Get | Post | Put | Patch | Delete
    path: String,            // path only — NOT a URL
    body: Option<String>,
    idempotent: bool,
) -> Result<ApiResponse, SecurityError>
```

**The webview supplies a path, never a URL.** The origin is read from validated runtime
configuration inside Rust and concatenated there. This is the single most important design
choice in the slice: if the command accepted a full URL, it would be a general-purpose native
fetch primitive callable from the webview, which would hand back exactly the capability SEC-1
exists to withhold and would make the CSP irrelevant.

Additional constraints, all enforced in Rust:

- `path` must begin with `/api/` and must not contain `..`, a scheme, or an authority.
- The `Authorization` header is attached by Rust from the keychain. The webview **cannot** set,
  read, or override it.
- `x-csrf-token` is attached by Rust from an in-memory value set at login.
- Errors return `SecurityError`, which never carries secret material — the existing Phase 0
  type and its redaction tests apply unchanged.
- Response bodies are returned as text plus status and headers; parsing and validation stay in
  TypeScript, where the Zod schemas live.

**Rejected**: exposing `tauri-plugin-http`. Its scoping is URL-pattern based and it would place
a general HTTP capability in the webview's reach. A hand-written command with a path-only
interface is narrower and auditable in one file.

## Transport adapter

`TauriTransport` implements the interface TASK-0.7 already defined, so the policy layer —
timeout, cancellation, bounded retry for safe idempotent operations, error normalisation,
correlation IDs — is reused rather than reimplemented. Only the byte-moving changes.

Cancellation crosses the IPC boundary by abandoning the pending promise on the TypeScript side
and letting the Rust request complete and be discarded. **This is a deliberate limitation**: it
frees the caller immediately, which is what cancellation is for in the UI, but it does not abort
the in-flight socket. Aborting natively would need a request registry and cancellation tokens in
Rust; that complexity is not justified for a slice whose only call is a small authenticated GET,
and it is recorded here so nobody assumes the socket is torn down.

CSP `connect-src` is **not** widened. Nothing in the webview makes network requests.

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
| `src-tauri/src/commands/http.rs` | Origin-scoped native HTTP command |
| `src/services/api/tauri-transport.ts` | Transport adapter over the native command |
| `src/services/auth/parent-auth-adapter.ts` | Audited `AuthPort` implementation |
| `src/services/api/endpoints/subscription.ts` | Endpoint adapter + Zod schema |
| `src/features/command-centre/SubscriptionPanel.tsx` | Real-data panel |
| `src/tests/parent-auth-adapter.test.ts` | Adapter contract tests |
| `src/tests/tauri-transport.test.ts` | Transport tests |
| `src/tests/endpoint-parity.test.ts` | Asserts no Developer API host or `/v1`–`/v2` path |

## Files to Modify

| Path | Change |
|---|---|
| `src/services/auth/ports.ts` | Extend `AuthFailureKind`; add optional retry metadata |
| `src/services/auth/gated-auth-service.ts` | Accept the adapter; map new failure kinds |
| `src/features/auth/LoginShell.tsx` | Activate; render all failure states |
| `src/features/command-centre/**` | Mount the subscription panel |
| `src-tauri/src/lib.rs`, `capabilities/default.json` | Register and permit one new command |
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
- **Rust**: path validation rejecting schemes, authorities and `..`; origin scoping; header
  injection blocked; `SecurityError` redaction.
- **Security**: token absent from SQLite, Zustand, browser storage, URLs and logs; token never
  present in any value reachable from the webview.
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
