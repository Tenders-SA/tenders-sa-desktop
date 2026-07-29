# Native authentication and subscription contract — decision record

**Task**: TASK-1.3 — Audit authentication and subscription contracts
**Refs**: REQ-4, REQ-13, INT-1, INT-5
**Baseline**: `8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1` — see `parent-baseline.md`
**Recorded**: 2026-07-28
**Status**: **Contract CONFIRMED.** Production auth **remains gated** — see §12.

This is the REQ-13 decision record. It documents the supported native login/session/logout
contract, token transport, expiry/renewal, CSRF requirements, device revocation, secure-storage
lifecycle, entitlement checks, and the required parent changes — **without modifying parent
auth**, which is frozen (Tier 1/2, registry v2.0).

---

## 1. Pre-check coverage

TASK-1.3's pre-check requires inspecting login/me/logout, JWT request verification, CSRF,
middleware, feature-access, and subscription routes **and their tests** at the pinned SHA. All
were read from parent source:

| Surface | Parent path | Read |
|---------|-------------|:----:|
| Login | `src/app/api/auth/login/route.ts` | yes |
| Session / renewal | `src/app/api/auth/me/route.ts` | yes |
| Logout | `src/app/api/auth/logout/route.ts` | yes |
| Token extraction | `src/lib/jwt-auth.ts` | yes |
| Sign / verify | `src/lib/jwt-service.ts` | yes |
| Session helper | `src/lib/auth.ts` (`auth()`, `toAuthUser`) | yes |
| Constants | `src/lib/auth-constants.ts` | yes |
| CSRF | `src/lib/csrf.ts`, `src/lib/middleware/csrf.ts`, `src/app/api/csrf/token/route.ts` | yes |
| Middleware | `src/middleware.ts` (581 lines) | yes |
| Subscription status | `src/app/api/subscription/status/route.ts` | yes |
| Feature access | `src/app/api/subscription/feature-access/[feature]/route.ts` | yes |
| Entitlement shape | `src/lib/services/feature-gating-service.ts` (`checkFeatureAccess`) | yes |
| **Tests** | `src/lib/__tests__/jwt-auth.test.ts`, `src/lib/__tests__/auth-middleware.test.ts`, `src/lib/observability/__tests__/middleware-auth-failure.test.ts` | yes |

Supporting evidence for the three deferred Phase 0 pre-checks is in
`deferred-phase-0-precheck-resolutions.md`, whose claims were independently re-verified in this
session (its §0). This document is the decision; that one is part of the evidence base.

---

## 2. INT-1 resolved — Bearer token from the login response body

**The INT-1 ambiguity is settled by code and by a parent test, not by preference.**
`SPEC_CONTRACT.md` warns that "parent login currently exposes both response-token and cookie
behavior; do not assume the supported native contract before the auth audit." Both do exist.
The tie is broken by precedence:

`src/lib/jwt-auth.ts:25-52` — `extractToken(headers, cookies)` resolves in three ordered steps:

1. `Authorization: Bearer <token>` header — **first**, with `'null'`/`'undefined'` string guards
2. the cookie getter, `cookies.get(AUTH_COOKIE_NAME)`
3. the raw `cookie` request header, regex-matched and `decodeURIComponent`'d

`verifyJWTFromRequest` (`jwt-auth.ts:69`) routes through it for API routes, and `auth()`
(`src/lib/auth.ts:130-165`) implements the same Bearer-first order for server components and
`/api/auth/me`.

**This is a test-guarded contract, not incidental behaviour.**
`src/lib/__tests__/jwt-auth.test.ts:15-24`:

```ts
it('prefers Authorization header token when both header and cookie are present', () => {
  const request = new Request('http://example.com', {
    headers: { authorization: 'Bearer header-token', cookie: 'token=cookie-token' },
  })
  expect(getAuthTokenFromRequest(request)).toBe('header-token')
})
```

A parent test asserting the precedence is stronger evidence than the implementation alone: it
means Bearer-first is intended and protected against regression. Per the constraint that route
code and tests outrank documentation, this is the contract.

### Decision

> **The desktop authenticates with `Authorization: Bearer <token>`, using the token returned in
> the login response body, held in the OS keychain. Cookies are not used.**

Three independent reasons, in order of force:

1. **Bearer has explicit, tested precedence** on every authenticated parent path (above).
2. **The cookie is `sameSite: 'strict'`** (`login/route.ts:125-131`). A desktop webview on a
   `tauri://` or `localhost` origin is cross-site relative to the API host, so a strict cookie
   is not reliably attached. The body token has no origin coupling.
3. **The whole stack already normalises to Bearer.** Middleware *rewrites* the header from the
   cookie when only a cookie is present (`src/middleware.ts:125-139`,
   `normalizeAuthorizationHeader`), overwriting any existing header and deleting the literal
   `Bearer null` / `Bearer undefined`. Downstream handlers see a Bearer header in **both**
   transports — Bearer is the contract the platform is built around, and the cookie is a
   browser-convenience input to it.

INT-1 also forbids importing or reimplementing parent JWT signing/validation. The desktop
satisfies this by treating the token as an **opaque string**: it never parses, verifies, or
inspects the JWT. Expiry is learned from server responses (§4), not from reading `exp`.

For the record, the algorithm is HS256 via `jose` with a server-side secret
(`src/lib/jwt-service.ts`) — noted only to confirm the desktop *cannot* validate tokens even if
it wanted to, since it has no access to the secret. That is the correct posture.

---

## 3. Login contract

`POST /api/auth/login` — `runtime = 'nodejs'`, wrapped in `withObservability`.
Public route (§6), so no prior session is required.

**Request**: `{ email, password }`, Zod-validated (`z.string().email()`, `z.string().min(1)`).

**Success — 200**:

```jsonc
{
  "success": true,
  "data": {
    "message": "Login successful",
    "token": "<JWT>",              // <- the desktop's credential
    "user": { /* toAuthUser */ },
    "company": { "id": "...", "name": "..." },  // or null
    "csrfToken": "<token>"          // or null
  }
}
```

`user` is the `toAuthUser` projection (`src/lib/auth.ts:73-92`) — exactly
`id, email, role, subscriptionTier, emailVerified, firstName, lastName, name, company{id,name}`.
`password`, `emailVerificationToken`, and `adminNotes` are **absent by construction**, so the
desktop never receives credential material other than the JWT. See `model-inventory.md` §4: the
desktop's `User` schema must follow this DTO, not the Prisma model.

**Failure cases** — all `{ success: false, error: <string> }`:

| Status | Condition | `error` string |
|--------|-----------|----------------|
| 401 | user not found | `Invalid credentials` |
| 401 | user has no password set | `Invalid credentials or account not set up for password login` |
| 401 | `accountStatus !== 'ACTIVE'` | `Account is not active. Please verify your email or contact support.` |
| 401 | bcrypt mismatch | `Invalid credentials` |
| 429 | rate limited | `Too many login attempts. Please try again later.` |
| 500 | unhandled | `Internal server error` |

**Rate limiting**: 10 attempts / 15 minutes, keyed `login:<ip>` from `x-forwarded-for` or
`x-real-ip` (`route.ts:26-39`). A `Retry-After` header carries the remaining seconds. The route
**deliberately does not reset the limiter on success**, with an in-code comment explaining that
resetting would let an attacker clear the counter with one valid login before brute-forcing.

> **Desktop rule**: 429 must **never** be auto-retried. TASK-0.7's transport already applies
> bounded retries with a rate-limit path; the login call must be declared `retry: 'never'` and
> surface `Retry-After` to the user. Auto-retrying would burn the user's own budget and, because
> the limiter is IP-keyed, could lock out an entire office NAT.

**Three 401s are indistinguishable by status code.** "Account not active" is a genuinely
different user state from "wrong password" — it needs a "verify your email" affordance, not a
"try again" one — but the only signal is the `error` string. The desktop must either
string-match (brittle, breaks on any copy edit) or the parent must add a machine-readable code.
Recorded as gap **A-1** (§13) and reflected in §11's error mapping.

---

## 4. Session validation and renewal

`GET /api/auth/me` — public route, no request body.

Two behaviours are surprising and both matter:

### It always returns 200

Unauthenticated requests get `{ user: null, company: null, token: null }` with **status 200**
(`me/route.ts:17-23`), and the `catch` block returns the identical shape, also 200
(`route.ts:44-51`).

This is genuinely reachable rather than theoretical: `/api/auth/me` **is** in middleware's
`PUBLIC_API_ROUTES` allowlist (§6), so middleware does not intercept it and the handler runs
for unauthenticated callers.

> **Desktop rule**: session validity is `user !== null`. **Never** infer it from the status
> code. A client treating "not 401" as "session valid" believes it is logged in forever — and
> would then render an authenticated shell around a null user.

### `/me` *is* the renewal mechanism

`route.ts:25-29` signs a **fresh JWT on every call** from the current user. There is no
`/api/auth/refresh` endpoint anywhere in the parent. Renewal is therefore a side effect of
session validation, giving a **sliding 7-day window** as long as the client persists the
returned `token`.

> **Desktop rule**: on every successful `/me`, replace the keychain token with the returned one.
> Skipping this turns the sliding window into a hard 7-day expiry and logs the user out
> mid-work.

It also overlays the effective subscription tier, lower-cased, from
`ApplicationEntitlementService.getEffectiveSubscriptionForUser` (`route.ts:31-37`). So
`user.subscriptionTier` from `/me` may differ from the value in the **login** response.

> **`/me` is authoritative for tier, login is not.** The desktop must not cache login's
> `subscriptionTier` as the entitlement signal.

### Expiry

`JWT_EXPIRY_SECONDS = 604800` (7 days), `JWT_EXPIRY_STRING = '7d'`
(`src/lib/auth-constants.ts`). The desktop treats the token as opaque (§2) and therefore learns
expiry only by calling `/me` and finding `user === null`, or by receiving a 401 from a gated
route. Both are handled in §11.

---

## 5. Logout — and the absence of server-side revocation

`POST /api/auth/logout` — public route. Returns `{ "success": true }` and clears the cookie by
setting it empty with `maxAge: 0`. A 500 returns bare `{ error: 'Internal server error' }`.

**It does not revoke the token.** Verified rather than assumed: a scan of
`src/lib/jwt-service.ts` for `denylist|blocklist|revoke|revocation|tokenVersion|blacklist`
returns **no match**. Verification is stateless signature + expiry only.

**The consequence is specific to native clients.** A token taken from the login response body
and stored in the keychain **remains valid for up to 7 days after the user logs out**. In a
browser this is largely invisible because the body token is not usually retained and the cookie
is cleared; the desktop retains it by design.

Two conclusions:

1. **Desktop logout must delete the keychain token locally and treat that as the real logout.**
   Phase 0's `GatedAuthService.logout()` already always permits logout, clears locally even when
   the remote call fails, and is deliberately not gated by the feature flag
   (`gated-auth-service.ts:79-82`). **That behaviour is correct and must be kept.** It is the
   only thing that actually ends the session.
2. **Server-side revocation is a parent-side gap** (**A-2**, §13). The desktop cannot fix it and
   must not pretend to. It is not a desktop workaround; it is a proposed parent change.

Minor upstream defect: logout hard-codes the cookie name `'token'` (`logout/route.ts:14`)
instead of importing `AUTH_COOKIE_NAME`, which login does use (`auth-constants.ts:5`). They
agree today, so nothing is broken — but the constant exists precisely so they cannot drift.
Gap **A-5**.

---

## 6. Middleware gate — and the two different 401 shapes

`src/middleware.ts:255-334` gates **every** `/api` route except a 45-entry
`PUBLIC_API_ROUTES` allowlist, verifying the JWT itself with `jwtVerify` and the same secret.

| Route | In allowlist? | Consequence for the desktop |
|-------|:-------------:|-----------------------------|
| `/api/auth/login` | **yes** | reachable unauthenticated (as required) |
| `/api/auth/logout` | **yes** | reachable unauthenticated |
| `/api/auth/me` | **yes** | reachable unauthenticated → returns 200 + `user: null` (§4) |
| `/api/subscription/status` | **no** | middleware-gated |
| `/api/subscription/feature-access/*` | **no** | middleware-gated |

**This produces two distinct 401 bodies for the same logical failure**, depending on which layer
rejected:

| Rejecting layer | Body | When |
|-----------------|------|------|
| Middleware, no token | `{ error: 'Unauthorized', message: 'Authentication required' }` | no token on a gated route |
| Middleware, bad token | `{ error: 'Unauthorized', message: 'Invalid or expired token' }` | signature/expiry failure |
| Middleware, admin route | `{ error: 'Forbidden', message: 'Admin access required' }` (403) | non-admin role |
| Route handler | `{ error: 'Unauthorized' }` (no `message`) | `verifyJWTFromRequest` returns null |

**In practice the desktop sees the middleware shape, and the route-level 401 is effectively
unreachable** on gated routes: middleware verifies the token with the same secret before the
handler runs, so any token that satisfies the route also satisfies middleware. The bare
`{ error }` form is reachable only if middleware is bypassed (direct internal call, or a route
moved onto the allowlist).

> **Desktop rule**: the 401 parser must accept **both** shapes — `{error}` with and without
> `message` — and must not require `success: false`, which neither emits. Distinguishing
> "expired" from "absent" is possible only via the middleware `message` string, which is not a
> stable contract. Treat all 401s as "session invalid → clear and re-authenticate".

### CORS — the desktop cannot use webview `fetch`

**The parent sets no CORS headers on any route the desktop needs.** Verified: no
`Access-Control-Allow-Origin` in `src/middleware.ts` or `next.config.ts`, and only **three**
route files in all of `src/app/api` set it — `intelligence/embed/[token]/data`,
`publishers/analytics/beacon`, and `leaderboard/[slug]/export`, all public embed/widget/beacon
surfaces. No auth, subscription, tender, application, or workspace route sets CORS headers or
exposes an `OPTIONS` handler.

A Tauri webview runs on a `tauri://localhost` (or `http://localhost`) origin, which is
cross-origin to the API host. A browser-style `fetch` from the webview would therefore be
blocked by the webview's own CORS enforcement on every one of these routes.

> **Decision: desktop API requests are issued from Rust, not from webview `fetch`.**

This resolves design.md §Authentication Design Gate question 6 ("whether requests must be issued
by Rust to avoid persistent secrets in the webview") with **two** independent reasons rather than
one:

- **Security** (the reason design.md anticipated): the Bearer token never enters webview JS, so
  it cannot leak via XSS, devtools, or a logged request object.
- **Functional** (the reason this audit found): without CORS headers, webview `fetch` to the
  parent API does not work at all.

The second reason is the stronger one, because it is not a preference. Native HTTP requests from
Rust are not subject to browser CORS.

**This has a direct consequence for Phase 0's transport.** `src/services/api/**` (TASK-0.7) is a
`fetch`-based client. It remains correct and fully tested as the *policy* layer — envelope
parsing, timeout, cancellation, bounded retry, error normalisation — but its **transport must be
swapped for a Rust-backed adapter** before it can reach the parent API. TASK-0.7 deliberately
built an injectable transport seam, so this is an adapter swap and not a rewrite. It is Phase 2
work, scoped in `phase-2-plan.md`, and it also means the CSP `connect-src` never needs widening.

---

## 7. CSRF — minted, and verified by nothing

Login mints a CSRF token and returns it in the body, **non-fatally**: a Redis outage is caught
and login still succeeds with `csrfToken: null` (`login/route.ts:102-108`).

`src/lib/csrf.ts` exports a complete suite — `createServerCsrfToken`, `validateServerCsrfToken`,
`requireCSRFToken`, `CSRF_HEADER = 'x-csrf-token'` — and a `src/lib/middleware/csrf.ts` module
exists.

**No mutating API route validates it.** Across all 714 route handlers:

```bash
grep -rn "requireCSRFToken\|validateServerCsrfToken" src/app/api
# src/app/api/csrf/token/route.ts:3   (import)
# src/app/api/csrf/token/route.ts:25  (validateServerCsrfToken)
```

The only caller is the CSRF endpoint validating its own token. `src/lib/middleware/csrf.ts` is
imported by no route, and middleware performs no CSRF enforcement (`grep -ic csrf
src/middleware.ts` → `0`).

> **Decision: the desktop captures `data.csrfToken` at login and sends `x-csrf-token` on every
> mutation anyway.**

The reasoning is about blast radius, not present need. Today mutations need no CSRF header. But
this is an **observed state, not a contract** — the enforcement machinery is fully built and
one import away from being switched on. If that happens, every desktop mutation breaks
simultaneously, in the field, on a release the desktop team did not ship. Sending the header
pre-emptively costs one header per mutation and makes parent-side enablement a non-event.

Note that a Bearer-authenticated native client is not exposed to classic CSRF in the first place
— the attack requires a browser silently attaching ambient credentials. So this is purely about
surviving a parent-side change, not about closing a desktop vulnerability.

The token must be treated as **optional**: it is `null` whenever Redis is unavailable, and the
desktop must not fail login or block mutations on its absence. Gap **A-3**.

---

## 8. Entitlements (INT-5)

Both routes are middleware-gated (§6) and require `Authorization: Bearer`.

### `GET /api/subscription/status`

```jsonc
{ "success": true, "subscription": { /* … */ } }        // active or synthesised free
{ "success": true, "subscription": null,
  "message": "No active subscription found" }            // genuinely none
```

Projection fields: `id`, `planName`, `tier`, `status`, `currentPeriodStart` (always `null`),
`currentPeriodEnd`, `isTrial`, `trialEndsAt`, `cancelAtPeriodEnd`, `applicationSlots`
`{total, used, remaining, preserved, resetsAt}`, `applicationCredits`.

**The payment identifiers on the `Subscription` model are absent from this projection** — no
`paystackSubscriptionId`, `paystackEmailToken`, `paypalSubscriptionId`, `paddleSubscriptionId`.
This is what makes the endpoint safe for the desktop to consume and cache, and it is why the
desktop must consume **this projection rather than the model** (`model-inventory.md` §4).

**Trap**: when a user has no subscription but has remaining application credits, the route
**synthesises** a subscription with `planName: 'free'`, `tier: 'free'`, `status: 'ACTIVE'`,
`id: null` (`status/route.ts:22-46`).

> A desktop branching on `subscription === null` alone will misclassify credit-holding free
> users as having no entitlement, and hide features they have paid for. Branch on `tier` and
> `applicationCredits`, and tolerate `id: null`.

`currentPeriodStart` is hard-coded `null` in **both** the synthesised and the real branch —
the desktop must not render a billing-period start from this endpoint.

### `GET /api/subscription/feature-access/[feature]`

Response is `checkFeatureAccess`'s result spread with a `source` field added:

```
{ hasAccess: boolean, reason?: string, minimumTier?: string,
  upgradeUrl?: string, source: 'subscription' | 'bundle' | 'none' }
```

Access resolves from two independent sources (`route.ts:47-82`): a subscription check via
`FeatureGatingService.checkFeatureAccess`, then a **bundle-wallet fallback** where any `ACTIVE`
`BundleWallet` with `remainingQuantity > 0` and unexpired counts as paid access
(`source: 'bundle'`). Trial users get everything except enterprise-only features.

| Status | Body | Meaning |
|--------|------|---------|
| 200 | `{hasAccess: true, source: 'subscription'\|'bundle', …}` | allowed |
| 200 | `{hasAccess: false, source: 'none', reason, minimumTier, upgradeUrl}` | denied |
| 400 | `{error: 'Feature name is required'}` | empty feature segment |
| 401 | middleware shape (§6) | no/invalid token |
| 500 | `{hasAccess: false, source: 'none', error, details}` | server error |

**The 500 body contains `hasAccess: false`.** A client reading `hasAccess` without checking the
status code will silently treat a server error as a definitive denial. That is fail-closed and
therefore safe, but it must be *reported* as an error state, not as "you need to upgrade" — the
user would otherwise be pushed to a pricing page by a transient outage.

### Decision (INT-5, SEC-3)

> **The desktop never computes entitlement locally.** Access depends on bundle-wallet state the
> client does not hold and cannot derive. The desktop caches the server's answer for UI
> affordances only; the server remains the authority, and hidden or disabled controls are never
> treated as access control.

This matches `AGENTS.md` ("desktop UI permissions are not a security boundary") and SEC-3. A
cached `hasAccess: true` may be shown optimistically, but the paid operation itself is gated by
the parent endpoint that performs it.

---

## 9. Device and account switching

Answering design.md §Authentication Design Gate item 4.

- **Device revocation: not supported.** There is no session table, no device registry, no
  `tokenVersion`, and no revocation endpoint (§5). "Log out all devices" cannot be implemented
  against this contract — a token stays valid until it expires. Gap **A-2**.
- **Account switching is whole-session replacement.** There is no multi-session concept. The
  desktop switches accounts by clearing the keychain token and logging in again.
- **Company switching does not exist.** `Company.userId` is `@unique`
  (`model-inventory.md` §2.1), so a user has at most one company and there is no membership
  join table. **The desktop must not build a company switcher** — there is nothing to switch
  between, and building one would imply a data model the parent does not have.

---

## 10. Secure-storage lifecycle (REQ-4, SEC-2, PRIV-1)

| Stage | Action | Mechanism |
|-------|--------|-----------|
| Login success | Store `data.token` | TASK-0.4 `session_store` → OS keychain |
| Login success | Hold `csrfToken` **in memory only** | Not persisted — it is re-minted every login |
| Every request | Read token, attach `Authorization: Bearer` | Rust transport (§6) — token never enters webview JS |
| `/me` success | **Overwrite** stored token with the returned one | `session_store` (sliding window, §4) |
| `/me` → `user: null` | Clear token, drop to unauthenticated | `session_clear` |
| Any 401 | Clear token, drop to unauthenticated | `session_clear` |
| Logout | Call remote, then clear locally **regardless of outcome** | `session_clear` (§5) |
| Device reset (PRIV-1) | Clear token + local account data after human confirmation | `session_clear` + SQLite purge |

Invariants, all already enforced by Phase 0 and unchanged by this audit:

- **The JWT never enters SQLite, Zustand, browser storage, or a URL.** TASK-0.5's local schema
  has no token column and `local-data.md` records the table-by-table check.
- **The JWT never enters logs.** TASK-0.11's redaction drops credential-shaped keys in both
  modes and scrubs bearer/JWT value shapes, re-applied independently on the Rust side.
- **No refresh token exists** in this contract, so `SessionCredentialStore.save`'s optional
  `refreshToken` parameter stays unused. It is harmless, but Phase 2 should not invent one.

---

## 11. Error-case mapping

Phase 0's `AuthFailureKind` union (`src/services/auth/ports.ts:33-37`) is
`'disabled' | 'invalid-credentials' | 'network' | 'contract-unconfirmed'`. The audited contract
produces states it cannot express:

| Parent response | Required desktop state | In current union? |
|-----------------|------------------------|:-----------------:|
| 401 `Invalid credentials` | invalid credentials | yes |
| 401 `Invalid credentials or account not set up for password login` | invalid credentials | yes |
| 401 `Account is not active. …` | **account inactive** — needs a "verify email" action | **no** |
| 429 + `Retry-After` | **rate limited** — show wait, do not retry | **no** |
| 500 / malformed | **server error** — retryable, not the user's fault | **no** |
| `/me` → `user: null` | session expired | partially — not distinct from a fresh start |
| Transport failure | network | yes |
| Gate closed | disabled / contract-unconfirmed | yes |

> **Finding**: `AuthFailureKind` needs at least `'account-inactive'`, `'rate-limited'`, and
> `'server-error'` added. Distinguishing them matters for user experience — telling someone with
> an unverified email to "check your password" is a dead end.

**This change is deliberately not made in TASK-1.3.** Editing the union means editing
`gated-auth-service.ts`, `LoginShell.tsx`, and their 18 tests — that is adapter implementation,
which is Phase 2's scope under a new approved contract. It is recorded here as a required
input to that work and carried into `phase-2-plan.md`. The `'account-inactive'` case
additionally depends on gap **A-1** (no machine-readable error code) and would have to
string-match until the parent provides one.

---

## 12. Production enable / blocked decision (REQ-4)

TASK-1.3 must record a production enable-or-blocked decision. It has two parts, and conflating
them would be the error.

### The contract is CONFIRMED — the audit blocker is closed

Everything `GatedAuthService` was waiting on is now evidenced from parent source at a pinned
SHA: transport (§2), login (§3), session and renewal (§4), logout and its revocation limit (§5),
the middleware gate and 401 shapes (§6), CSRF posture (§7), entitlements (§8), switching (§9),
and storage lifecycle (§10). Phase 0 recorded that supplying an adapter "would mean guessing at
a security contract before TASK-1.3." **That guess is no longer required.**

### Production auth REMAINS GATED

`desktopAuth` stays `false` and no audited adapter is supplied by this task. This is a scope
boundary, not an unresolved risk:

1. **Writing the adapter is Phase 2 implementation.** It needs a Rust HTTP transport (§6), the
   `AuthFailureKind` extension (§11), keychain lifecycle wiring (§10), and adapter tests.
   `SPEC_CONTRACT.md` scopes this contract to "Phase 0 foundation and Phase 1 parent
   integration audit only", and TASK-1.7 produces a *plan*, not code. Building it here would
   start Phase 2 without an approved contract.
2. **The gate is correctly shaped for this.** `GatedAuthService.isEnabled()` requires both the
   flag **and** an audited adapter (`gated-auth-service.ts:42-44`), so the flag alone cannot
   enable auth. Nothing needs to change to keep production safe while the adapter is written.
3. **Two prerequisites are outside desktop control**: the CORS finding (§6) makes the current
   `fetch` transport non-functional against the parent, and A-1/A-2 are parent-side proposals.

> **Decision: contract CONFIRMED and accepted as the basis for implementation; production auth
> BLOCKED pending (a) a Rust-backed transport, (b) an audited adapter with contract tests, and
> (c) a new approved Phase 2 contract. REQ-4 remains satisfied in the gated state.**

REQ-13 — which asks for the decision record, not the implementation — is **met by this
document**.

---

## 13. Required parent changes — proposals only (INT-7)

Per INT-7 and the frozen-module constraint, each is a proposal for a separate
parent-repository specification. **No parent change was made.** These are carried to
`workspace-gap-report.md` for classification with risk and owner.

| # | Finding | Impact on desktop | Proposed change | Frozen tier |
|---|---------|-------------------|-----------------|-------------|
| **A-1** | Login's three 401 causes are separable only by `error` string; no error codes | Cannot reliably distinguish "account inactive" from "wrong password" (§11) | Add a stable `code` sibling (e.g. `ACCOUNT_INACTIVE`, `INVALID_CREDENTIALS`) | Tier 1 auth — additive field, non-breaking |
| **A-2** | No server-side revocation on logout; body tokens valid up to 7 days after logout | "Log out all devices" impossible; stolen keychain token usable for up to 7 days | Add `tokenVersion` on `User` or a revocation denylist | Tier 1 auth — **behavioural**, needs impact assessment |
| **A-3** | CSRF minted but validated by no mutating route | Enabling enforcement would break all desktop mutations at once | Decide and document: enforce consistently, or remove the dead machinery | Tier 1/2 |
| **A-4** | `/api/auth/me` returns 200 with `user: null` instead of 401 | Status codes cannot signal session expiry (§4) | Document as intentional, or return 401 | Tier 1 — **breaking** for existing browser clients |
| **A-5** | Logout hard-codes `'token'` instead of `AUTH_COOKIE_NAME` | None today; latent drift | One-line import | Trivial |
| **A-6** | No CORS headers on desktop-relevant routes | Webview `fetch` unusable; desktop must transport via Rust (§6) | **None requested.** The Rust transport is the better design anyway | N/A |

**A-6 is deliberately not a change request.** Adding CORS headers to allow a `tauri://` origin
would widen the parent's browser-facing attack surface to solve a problem the desktop should
solve on its own side. The Rust transport is the correct fix and is already the security-preferred
option.

None of A-1…A-5 blocks the Phase 2 auth slice. Each degrades an experience the desktop can ship
without: A-1 costs string-matching, A-2 costs a documented 7-day residual-token risk that local
clearing mitigates on the device itself, A-3 is pre-empted by §7's send-anyway rule, A-4 is
handled by §4's `user !== null` rule.

---

## 14. Contract fixtures

`src/tests/fixtures/parent-auth-contract.ts` records every response shape verified above as
typed fixtures, each annotated with the parent path and line range it was read from.
`src/tests/parent-auth-contract.test.ts` validates the fixtures against Zod schemas expressing
the audited contract.

The point is not to test the parent — the desktop cannot. It is to make the audited contract
**executable**, so that:

- Phase 2's adapter is written against schemas that already parse real verified shapes;
- the traps in §4, §6, and §8 are pinned by assertions rather than by prose a future
  contributor may not read — specifically the 200-with-`user: null` case, both 401 shapes, the
  synthesised free subscription, and the 500-with-`hasAccess: false` case;
- a future audit that finds the parent has changed has something concrete to update.

These are **fixtures and schemas only**. No network call, no adapter, no keychain wiring — none
of which may be built before Phase 2 is approved.

---

## 15. Verification

TASK-1.3's verify condition requires documenting token/cookie transport, expiry/renewal, CSRF,
logout/revocation, device/account switching, entitlement checks, error cases, and a production
enable/blocked decision.

| Required | Section | Result |
|----------|---------|--------|
| Token/cookie transport | §2 | **Bearer, body token** — code + parent test evidence; INT-1 resolved |
| Expiry / renewal | §4 | 7 days; `/me` re-mints, sliding window; no refresh endpoint |
| CSRF | §7 | Minted non-fatally, enforced nowhere; send-anyway decision |
| Logout / revocation | §5 | Cookie-clear only; **no revocation**; local clear is the real logout |
| Device / account switching | §9 | No device revocation; account switch = re-login; **no company switching** |
| Entitlement checks | §8 | `/status` + `/feature-access`; server-authoritative; two traps recorded |
| Error cases | §3, §6, §11 | Full tables; `AuthFailureKind` gaps identified |
| Production enable/blocked decision | §12 | **Contract CONFIRMED; production BLOCKED** pending Phase 2 |
| Pre-check incl. tests | §1 | 13 source files + 3 test files read |
| Auth ADR updated | `docs/architecture/auth.md` | Created and accepted |
| Contract fixtures | §14 | Fixtures + schema tests |
| Parent changes proposed, not made | §13 | 6 findings, A-1…A-6; **no parent file modified** |
| INT-1 honoured | §2 | Token treated as opaque; no JWT parsing/signing in desktop |

Two determinations in this document go beyond what the task list anticipated, and both are
recorded rather than folded in silently:

- **The CORS finding (§6)** means Phase 0's `fetch`-based transport cannot reach the parent API.
  It changes the Phase 2 plan materially and is the strongest reason for the Rust-transport
  decision.
- **`AuthFailureKind` is insufficient (§11)** for the contract as audited. The fix is Phase 2
  code and is deliberately not applied here.

**TASK-1.3 is complete.**
