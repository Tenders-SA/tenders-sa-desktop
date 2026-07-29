# ADR: Native Authentication Architecture (TASK-1.3)

- **Status**: Accepted
- **Date**: 2026-07-28
- **Refs**: REQ-4, REQ-13, INT-1, INT-5, SEC-2, SEC-3, PRIV-1
- **Evidence**: `docs/audits/auth-subscription-contract.md`, read from parent source at
  `8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1`
- **Supersedes**: nothing. Complements `docs/architecture/security.md` (TASK-0.4), which owns
  the keychain and command boundary this ADR consumes.

## Context

Phase 0 shipped an authentication *interface* — ports, a gated service, and a non-functional
login shell — and deliberately stopped there. `SPEC_CONTRACT.md` warned that parent login
exposes both response-token and cookie behaviour and that the supported native contract must
not be assumed before an audit. No audited adapter could be written without guessing at a
security contract.

TASK-1.3 audited the parent auth and subscription surface at a pinned SHA. This ADR records the
architecture that follows from it. The audit document holds the evidence; this holds the
decisions.

## Decisions

### 1. Bearer token from the login response body; cookies are not used

The desktop sends `Authorization: Bearer <token>` using the token from the login response body,
stored in the OS keychain.

**Why.** `extractToken` (`src/lib/jwt-auth.ts:25-52`) gives the `Authorization` header
precedence over the cookie on every authenticated path, and a parent test
(`src/lib/__tests__/jwt-auth.test.ts:15-24`) asserts that precedence — so it is intended and
regression-guarded, not incidental. Middleware additionally rewrites the header from the cookie
when only a cookie is present, so handlers see Bearer in both transports. And the cookie is
`sameSite: 'strict'`, which a `tauri://` origin cannot reliably satisfy anyway.

**Consequence.** The token is treated as an **opaque string**. The desktop never parses,
verifies, or inspects the JWT — INT-1 forbids reimplementing parent signing/validation, and the
desktop has no access to the secret regardless. Expiry is learned from responses, not from
reading `exp`.

### 2. API requests are issued from Rust, not from webview `fetch`

**Why — two independent reasons, and the second is not a preference.**

- *Security*: the Bearer token never enters webview JavaScript, so it cannot leak via XSS,
  devtools, or an accidentally logged request object.
- *Functional*: the parent sets **no CORS headers** on any route the desktop needs. Only three
  route files in `src/app/api` set `Access-Control-Allow-Origin`, all public embed/widget/beacon
  surfaces; there is none in middleware or `next.config.ts`. A webview `fetch` from a
  `tauri://localhost` origin would be blocked on every auth, subscription, tender, application,
  and workspace route.

This resolves design.md §Authentication Design Gate question 6. Native HTTP from Rust is not
subject to browser CORS.

**Consequence for Phase 0's transport.** `src/services/api/**` remains correct and fully tested
as the *policy* layer — envelope handling, timeout, cancellation, bounded retry, error
normalisation — but its `fetch` transport must be swapped for a Rust-backed adapter before it
can reach the parent. TASK-0.7 built an injectable transport seam precisely so this is an
adapter swap rather than a rewrite. A pleasant side effect: CSP `connect-src` never needs
widening.

**Rejected**: adding a CORS allowance for the desktop origin. That widens the parent's
browser-facing attack surface to solve a problem the desktop can solve on its own side, and the
parent's auth module is frozen.

### 3. `/api/auth/me` is both session check and renewal

Session validity is `user !== null`, **never** the HTTP status: the endpoint is on middleware's
public allowlist and returns **200 with `{user: null, company: null, token: null}`** when
unauthenticated, and the same shape from its `catch`.

It re-mints a JWT on every call, and there is no `/api/auth/refresh` anywhere in the parent.
So `/me` *is* the renewal mechanism, giving a sliding 7-day window. **The desktop must overwrite
the stored token with the returned one on every successful call**, or the sliding window
silently degrades into a hard expiry that logs the user out mid-work.

`/me` is also authoritative for `subscriptionTier`, which it overlays from the effective
subscription; login's value may be stale and must not be cached as the entitlement signal.

### 4. Logout is local-first, because the parent does not revoke

`POST /api/auth/logout` clears the cookie and returns `{success: true}`. It does **not** revoke
the token — `src/lib/jwt-service.ts` has no denylist, no `tokenVersion`, and no revocation
check. A keychain-held body token therefore stays valid for up to 7 days after logout.

**Deleting the keychain token is the real logout.** Phase 0's `GatedAuthService.logout()`
already always permits logout, is not blocked by the feature flag, and clears locally even when
the remote call fails. That behaviour was written defensively before the contract was known and
turns out to be exactly right; it is now load-bearing and must be kept.

Server-side revocation is a parent-side gap (A-2), proposed separately, never worked around by
pretending the desktop can revoke.

### 5. CSRF headers are sent even though nothing validates them

The desktop captures `data.csrfToken` at login (in memory, never persisted — it is re-minted
each login) and sends `x-csrf-token` on every mutation.

No mutating parent route validates CSRF today: across all 714 handlers the only caller of
`validateServerCsrfToken`/`requireCSRFToken` is the CSRF endpoint validating its own token, and
middleware does no CSRF enforcement. But the machinery is fully built and one import away from
being switched on, at which point every desktop mutation would break simultaneously, in the
field, on a release the desktop team did not ship.

One header per mutation makes parent-side enablement a non-event. The token must be treated as
**optional** — it is `null` whenever Redis is unavailable, and login must not fail on that.

A Bearer-authenticated native client is not exposed to classic CSRF in the first place; this is
about surviving a parent-side change, not closing a desktop vulnerability.

### 6. Entitlement is never computed locally

The desktop calls `/api/subscription/status` and
`/api/subscription/feature-access/[feature]` and caches the answers for UI affordances only.

Access can be granted by a **bundle wallet** the client has no visibility into, so local
computation cannot be correct even in principle. Two response traps are handled explicitly:
`/status` synthesises a `'free'` plan with `id: null` for credit-holding users (so
`subscription === null` is not the test for "no entitlement"), and `feature-access` returns
`hasAccess: false` inside its **500** body (so an outage must be reported as an error, not
rendered as an upsell).

Per SEC-3 and `AGENTS.md`, hidden or disabled controls are never access control; the parent
endpoint performing the paid operation is the enforcement point.

### 7. No company switcher, and no device revocation

`Company.userId` is `@unique`, so a user has at most one company and there is no membership
join table. Building a company switcher would imply a data model the parent does not have.
Account switching is whole-session replacement: clear the keychain, log in again.

"Log out all devices" cannot be implemented against this contract — there is no session table,
device registry, or revocation endpoint. The desktop must not offer the affordance.

### 8. Production auth stays gated until Phase 2

The contract is **confirmed**; the adapter is **not built here**. `GatedAuthService.isEnabled()`
requires both the `desktopAuth` flag and an audited adapter, so no config change can enable
authentication on its own, and nothing needs to change to stay safe while the adapter is
written.

Writing it needs the Rust transport (§2), an extended `AuthFailureKind` (below), keychain
lifecycle wiring, and contract tests — that is Phase 2 implementation, which
`SPEC_CONTRACT.md` places outside this contract's scope.

## Consequences

### Credential lifecycle

| Stage | Action |
|-------|--------|
| Login success | Store `data.token` via `session_store` (OS keychain); hold `csrfToken` in memory only |
| Every request | Rust attaches `Authorization: Bearer` — token never enters webview JS |
| `/me` success | **Overwrite** stored token with the returned one |
| `/me` → `user: null`, or any 401 | `session_clear`, drop to unauthenticated |
| Logout | Call remote, then clear locally regardless of outcome |
| Device reset (PRIV-1) | `session_clear` + local data purge after human confirmation |

Unchanged Phase 0 invariants: the JWT never enters SQLite, Zustand, browser storage, or a URL;
it never enters logs (redaction drops credential-shaped keys and scrubs bearer/JWT value shapes
on both the TS and Rust sides). No refresh token exists in this contract, so
`SessionCredentialStore.save`'s optional `refreshToken` stays unused — Phase 2 should not
invent one.

### `AuthFailureKind` is insufficient and must be extended in Phase 2

The current union is `'disabled' | 'invalid-credentials' | 'network' | 'contract-unconfirmed'`.
The audited contract produces at least three states it cannot express: **account inactive**
(needs a "verify your email" action, not "try again"), **rate limited** (429 with `Retry-After`;
must never be auto-retried, since the limiter is IP-keyed and is deliberately not reset on
success), and **server error**.

Not changed here: editing the union touches `gated-auth-service.ts`, `LoginShell.tsx`, and
their tests, which is adapter work. `'account-inactive'` additionally depends on gap A-1 —
login's three 401 causes are separable only by matching the `error` string, because there is no
machine-readable code.

### Contract fixtures

`src/tests/fixtures/parent-auth-contract.ts` and `src/tests/parent-auth-contract.test.ts`
(26 tests) hold every verified shape with its parent path and line range, validated against Zod
schemas. They exist so the audited contract is executable rather than only narrated: Phase 2's
adapter is written against schemas already proven to parse the real shapes, and each trap above
fails a test if a future contributor assumes otherwise.

They test the desktop's understanding, not the parent — Phase 1 is read-only and the desktop
cannot reach the parent API.

## Proposed parent changes — not made

Per INT-7, all are proposals for a separate parent specification: **A-1** error codes on login
failures, **A-2** server-side revocation, **A-3** resolve the dead CSRF machinery, **A-4**
document or change `/me`'s 200-with-null, **A-5** logout's hard-coded cookie name. **A-6**
(no CORS) is deliberately *not* a change request — §2 explains why the Rust transport is the
better fix.

None blocks the Phase 2 auth slice. Details, risk, and owners are in
`docs/audits/auth-subscription-contract.md` §13 and the gap report.
