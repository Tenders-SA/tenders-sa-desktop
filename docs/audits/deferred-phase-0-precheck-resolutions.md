# Deferred Phase 0 pre-checks — resolutions

**Resolves**: the three pre-checks deferred out of TASK-0.7, TASK-0.8 and TASK-0.9 because
the parent repository was unreachable from the Phase 0 session.
**Baseline**: `8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1` — see `parent-baseline.md`.
**Recorded**: 2026-07-28

Every finding below is read from parent source at the baseline SHA. Nothing here is
inferred from `design.md`, from the public Developer API, or from the Phase 0 record.

These are **inputs** to TASK-1.3 and TASK-1.4, not substitutes for them. They close the
pre-checks; they do not produce `auth-subscription-contract.md` or `endpoint-inventory.md`.

---

## 0. Provenance and independent re-verification

This document was **first drafted in a previous session against baseline `199e422`** and
staged in the parent repository at `docs/desktop-workspace-phase1/`, because that session
could read and write the parent but could not write this repository. It is carried into this
repository by TASK-1.1 and **re-based on baseline `8ff2e4c2`** (`parent-baseline.md` §4).

The re-basing is sound rather than assumed: every file cited below is **byte-identical**
between `199e422` and `8ff2e4c2`, verified by

```bash
git diff --name-only 199e422..origin/aws-production-app -- \
  src/lib/auth.ts src/lib/api-client.ts src/middleware.ts src/app/globals.css \
  src/lib/jwt-auth.ts src/lib/csrf.ts src/lib/auth-constants.ts \
  src/lib/jwt-service.ts src/app/api/auth src/app/api/subscription
# (no output)
```

The same surface is additionally identical back to `be09f9d51`, so no finding here depends on
which of the three candidate baselines is chosen.

**Carried-over findings were not adopted on trust.** Each material claim below was re-read
from parent source in this session before any Phase 1 task relied on it:

| Claim | Re-verified against | Result |
|-------|--------------------|--------|
| Bearer takes precedence over cookie | `src/lib/jwt-auth.ts:25-52` | confirmed |
| Login returns body token **and** sets `sameSite: 'strict'` cookie | `src/app/api/auth/login/route.ts:113-131` | confirmed |
| Three distinct 401 `error` strings; 429 with `Retry-After`; limiter not reset on success | `login/route.ts:30-79, 96-100` | confirmed |
| CSRF minted non-fatally at login | `login/route.ts:102-108` | confirmed |
| `/api/auth/me` returns **200** with `user: null`, and re-mints a token on every call | `src/app/api/auth/me/route.ts:14-52` | confirmed |
| `/me` overlays lower-cased effective subscription tier | `me/route.ts:31-37` | confirmed |
| Logout returns `{success:true}`, clears cookie, **no revocation** | `src/app/api/auth/logout/route.ts:10-27` | confirmed |
| Logout hard-codes `'token'` rather than `AUTH_COOKIE_NAME` | `logout/route.ts:14` vs `src/lib/auth-constants.ts:5` | confirmed |
| No denylist / `tokenVersion` / revocation in JWT service | `grep -Ei 'denylist\|revoke\|tokenVersion\|blacklist' src/lib/jwt-service.ts` → no match | confirmed |
| 7-day expiry | `src/lib/auth-constants.ts` — `JWT_EXPIRY_SECONDS = 604800` | confirmed |
| CSRF validated by exactly one route (the CSRF endpoint itself) | `grep -rn 'requireCSRFToken\|validateServerCsrfToken' src/app/api` → only `src/app/api/csrf/token/route.ts:3,25` | confirmed |
| No CSRF enforcement in middleware | `grep -ic csrf src/middleware.ts` → `0` | confirmed |
| Subscription 401 is bare `{error:'Unauthorized'}` | `src/app/api/subscription/status/route.ts:11-17` | confirmed |
| `status` synthesises a `'free'` plan for credit-holding users | `status/route.ts:22-46` | confirmed |
| Parent light + dark hue tables | `src/app/globals.css:254-289, 314-324` | confirmed |
| Desktop token values | `src/styles/tokens.css:39-83` | confirmed |

Two corrections to the original draft, made here rather than left to be rediscovered:

1. **§1.1's `extractToken` excerpt shows two resolution paths; the function has three.** After
   the Authorization header and the cookie getter, `src/lib/jwt-auth.ts:42-49` also parses the
   raw `cookie` request header by regex and `decodeURIComponent`s the match. This strengthens
   rather than weakens the section's conclusion — Bearer still has precedence — but a reader
   reproducing the extraction order needs all three.
2. **The Prisma domain-file count is 35, not "40+"** (`ls prisma/*-domain.prisma | wc -l`).
   Re-measured in `parent-baseline.md` §5.

---

## 1. Parent auth contract — deferred from TASK-0.9, feeds TASK-1.3

### 1.1 INT-1 resolved: Bearer is the supported native transport

**The ambiguity is settled by the code, not by preference.** Login exposes both a
response-body token and a cookie, but the parent's token-extraction helper gives the
`Authorization` header **precedence over the cookie** on every authenticated path.

`src/lib/jwt-auth.ts:25-40` — `extractToken(headers, cookies)`:

```ts
// 1. Precedence: Authorization Header
const authHeader = headers.get('authorization');
if (authHeader && authHeader.startsWith('Bearer ')) {
  const token = authHeader.slice(7).trim();
  if (token && token !== 'null' && token !== 'undefined') return token;
}
// 2. Fallback: cookie
const tokenCookie = cookies?.get?.(AUTH_COOKIE_NAME);
if (tokenCookie?.value) return tokenCookie.value;
```

Its docstring states it is "Compatible with Edge and Node runtimes". The same
Bearer-first/cookie-fallback order is implemented independently in `src/lib/auth.ts:130-165`
(`auth()`, used by server components and `/api/auth/me`), and `verifyJWTFromRequest`
(`src/lib/jwt-auth.ts:69`) routes through `extractToken` for API routes.

**Determination for TASK-1.3**: the desktop client should authenticate by sending
`Authorization: Bearer <token>`, using the token returned in the **login response body**,
held in the OS keychain. This is a first-class, already-supported path — not a workaround.

Cookies are the wrong choice for the desktop regardless of support, because the cookie is
issued `sameSite: 'strict'` (`src/app/api/auth/login/route.ts:125-131`). A desktop webview
on a `tauri://` or `localhost` origin is cross-site relative to the API host, so a
strict-same-site cookie is not reliably attached. The body token has no such coupling.

Note that middleware **rewrites** the header from the cookie when only a cookie is present
(`src/middleware.ts:121-139`, `normalizeAuthorizationHeader`), and defensively strips the
literal strings `Bearer null` and `Bearer undefined`. Downstream handlers therefore see a
Bearer header in both transports — which is why Bearer is the contract the whole stack is
already built around.

### 1.2 Login

`src/app/api/auth/login/route.ts` — `POST /api/auth/login`, `runtime = 'nodejs'`.

Request: `{ email, password }`, validated by Zod (`email()`, `password.min(1)`).

Success — **200**, response body and cookie both set:

```jsonc
{
  "success": true,
  "data": {
    "message": "Login successful",
    "token":   "<JWT>",
    "user":    { /* toAuthUser(user) */ },
    "company": { /* authUser.company */ } ,   // or null
    "csrfToken": "<token>"                     // or null
  }
}
```

Cookie (`src/app/api/auth/login/route.ts:125-131`):

| Attribute | Value |
|-----------|-------|
| name | `token` (`AUTH_COOKIE_NAME`, `src/lib/auth-constants.ts`) |
| `httpOnly` | `true` |
| `secure` | `true` only when `NODE_ENV === 'production'` |
| `sameSite` | `strict` |
| `path` | `/` |
| `maxAge` | `JWT_EXPIRY_SECONDS` = 604800 (7 days) |

Failure cases — all `{ success: false, error: <string> }`:

| Status | Condition | `error` |
|--------|-----------|---------|
| 401 | user not found | `Invalid credentials` |
| 401 | user has no password set | `Invalid credentials or account not set up for password login` |
| 401 | `accountStatus !== 'ACTIVE'` | `Account is not active. Please verify your email or contact support.` |
| 401 | bcrypt mismatch | `Invalid credentials` |
| 429 | rate limited | `Too many login attempts. Please try again later.` |
| 500 | unhandled | `Internal server error` |

**Rate limiting**: 10 attempts per 15 minutes, keyed `login:<ip>` from
`x-forwarded-for` / `x-real-ip` (`route.ts:26-39`). A `Retry-After` header carries the
remaining seconds. The route deliberately does **not** reset the limiter on success, with
an in-code comment explaining that resetting would let an attacker clear the counter with
one valid login before brute-forcing. The desktop client must honour `Retry-After` and must
not retry 429 automatically.

**Note the third 401**: an inactive account is indistinguishable by status code from bad
credentials and is only separable by matching the `error` string. The desktop needs an
"account not active" state distinct from "wrong password", so it must either string-match
(brittle) or TASK-1.3 must propose a parent-side error code. Recorded for the gap report.

### 1.3 Session check / renewal

`src/app/api/auth/me/route.ts` — `GET /api/auth/me`.

Two behaviours matter and both are surprising:

**It always returns 200.** Unauthenticated requests get
`{ user: null, company: null, token: null }` with a 200 status, not a 401 — and the `catch`
block returns the same shape, also 200. The desktop **cannot** use the status code to
detect an expired session; it must test `user !== null`. A client that treats "not 401" as
"session valid" will believe it is logged in forever.

**It re-mints a token on every call** (`route.ts:25-29`), signing a fresh JWT from the
current user. There is no `/api/auth/refresh` endpoint; `/api/auth/me` *is* the renewal
mechanism, giving a sliding 7-day window as long as the client stores the returned token.

It also overlays the effective subscription tier from
`ApplicationEntitlementService.getEffectiveSubscriptionForUser`, lower-cased
(`route.ts:31-37`), so `user.subscriptionTier` from `/me` may differ from the value on the
`user` object returned by login. **`/me` is the authority** for tier.

### 1.4 Logout — no server-side revocation

`src/app/api/auth/logout/route.ts` — `POST /api/auth/logout`. Returns `{ "success": true }`
and clears the cookie by setting it empty with `maxAge: 0`.

**It does not revoke the token.** `src/lib/jwt-service.ts` has no denylist, no
`tokenVersion`, and no revocation check — verification is stateless signature + expiry
(`setExpirationTime(JWT_EXPIRY)`, 7 days). Logout is a cookie-clearing operation only.

The consequence is specific to native clients: a token taken from the **login response
body** and stored in the keychain **remains valid for up to 7 days after the user logs
out**. In a browser this is invisible because the body token is not usually retained; the
desktop retains it by design.

Two things follow, both for TASK-1.3:

1. Desktop logout must delete the token from the OS keychain locally and treat that as the
   real logout. Phase 0's `GatedAuthService` already always permits logout and clears
   locally even when remote logout fails — that behaviour is **correct** and should be kept.
2. Server-side revocation on logout is a **parent-side gap**. It is not something the
   desktop can fix, and it belongs in the gap report as a proposed parent change, not a
   desktop workaround.

Minor defect worth reporting upstream: logout hard-codes the cookie name `'token'`
(`route.ts:14`) instead of importing `AUTH_COOKIE_NAME`, which login does use. They agree
today, so nothing is broken; the constant exists precisely so they cannot drift apart.

### 1.5 CSRF — minted, effectively never verified

Login mints a CSRF token and returns it in the body, non-fatally
(`src/app/api/auth/login/route.ts:102-108` — a Redis outage skips it and login still
succeeds). `src/lib/csrf.ts` exports a full suite (`createServerCsrfToken`,
`validateServerCsrfToken`, `requireCSRFToken`, `CSRF_HEADER = 'x-csrf-token'`), and a
`src/lib/middleware/csrf.ts` module exists.

**No mutating API route validates it.** Across all 714 route handlers, the only file that
calls `validateServerCsrfToken` or `requireCSRFToken` is `src/app/api/csrf/token/route.ts`
— the CSRF endpoint validating its own token:

```bash
grep -rn "requireCSRFToken\|validateServerCsrfToken" src/app/api
# src/app/api/csrf/token/route.ts:3  (import)
# src/app/api/csrf/token/route.ts:25 (validateServerCsrfToken)
```

`src/lib/middleware/csrf.ts` is imported by no route. The middleware performs no CSRF
enforcement either (no CSRF reference in `src/middleware.ts`).

For the desktop this is a convenience — mutations need no CSRF header today — but it must
be recorded as an **observed state, not a contract**. If parent-side CSRF enforcement is
switched on later, every desktop mutation breaks at once. TASK-1.3 should specify that the
client captures `data.csrfToken` at login and sends `x-csrf-token` on mutations regardless,
so enforcement can be enabled without a desktop release. The cost is one header.

A Bearer-authenticated native client is not exposed to classic CSRF in the first place —
the risk is a browser-side one — so this is about surviving a parent-side change, not about
desktop vulnerability.

### 1.6 Entitlements — feeds REQ-13

| Route | Auth | Success shape |
|-------|------|---------------|
| `GET /api/subscription/status` | `verifyJWTFromRequest` | `{ success: true, subscription: {...} \| null }` |
| `GET /api/subscription/feature-access/[feature]` | `verifyJWTFromRequest` | `{ hasAccess, source, reason? }` |

Both return **401 `{ error: 'Unauthorized' }`** when the token is missing or invalid — note
this is a bare `{ error }` with no `success: false`, unlike login.

`feature-access` resolves access from two independent sources (`route.ts` header comment
and body): a subscription check via `FeatureGatingService.checkFeatureAccess`, then a
bundle-wallet fallback where any `ACTIVE` `BundleWallet` with `remainingQuantity > 0` and
unexpired counts as paid access. `source` is `'subscription' | 'bundle' | 'none'`.

**The desktop must not compute entitlement locally.** Access depends on wallet state the
client does not hold, and `AGENTS.md` already states desktop UI permissions are not a
security boundary. Cache the answer for UI affordances; let the server decide.

`/api/subscription/status` returns a synthesised `planName: 'free'` / `tier: 'free'`
subscription when the user has no subscription but has remaining application credits, and
`subscription: null` with `message: 'No active subscription found'` otherwise. A client
that branches on `subscription === null` alone will misclassify credit-holding free users.

### 1.7 What this unblocks

The Phase 1 handoff recorded that no audited adapter exists for `GatedAuthService`, so
production auth cannot be enabled, and that supplying one "would mean guessing at a
security contract before TASK-1.3."

**That guess is no longer required.** The contract is now evidenced: Bearer token from the
login response body, keychain-stored, `Authorization: Bearer <token>` on every request,
`/api/auth/me` for validation and sliding renewal, local-clear logout, `x-csrf-token`
carried defensively.

Writing the adapter remains TASK-1.3's deliverable and still needs its ADR and fixtures —
this section is the evidence base for it, not the adapter. REQ-4 stays gated until TASK-1.3
lands.

---

## 2. Parent API contract — deferred from TASK-0.7, feeds TASK-1.4

### 2.1 There is no single parent-internal envelope

Phase 0 verified its envelope against the **public** Developer API
(`https://api.tenders-sa.org`, v2.1.0) and implemented `apiSuccessEnvelope(dataSchema)`
against that contract, flagging that the parent-internal API was unverified.

**The parent-internal API does not have one envelope.** Six distinct top-level shapes appear
across the seven routes read for this document alone:

| # | Shape | Example route |
|---|-------|---------------|
| 1 | `{ success: true, data: {...} }` | `POST /api/auth/login` |
| 2 | `{ success: false, error: string }` | `POST /api/auth/login` (all failures) |
| 3 | `{ success: true }` | `POST /api/auth/logout` |
| 4 | `{ success: true, subscription: {...} }` | `GET /api/subscription/status` |
| 5 | `{ error: string }` | `GET /api/subscription/status` (401), logout (500) |
| 6 | bare domain object, no wrapper | `GET /api/auth/me` → `{ user, company, token }`; `GET .../feature-access/[feature]` → `{ hasAccess, source }` |

Shapes 1, 3 and 4 all set `success: true` but place the payload differently — under `data`,
nowhere, and under a domain-specific key. Shape 6 has no discriminator at all.

**This is the headline finding for TASK-1.4.** A client-side envelope layer that assumes
`{ success, data }` will fail against most parent-internal routes. Phase 0's
`apiSuccessEnvelope(dataSchema)` is sound for the public API and should be kept for it, but
it cannot be the single parsing path for parent-internal calls.

The recommendation for TASK-1.4 is to treat the envelope as **per-endpoint** rather than
global: each adapter declares its own response schema, and the shared layer handles only
transport concerns (status, retry, timeout, cancellation, auth-failure classification). That
is close to what Phase 0 already built — `apiSuccessEnvelope` "structurally forces every
call site to hand-author its expected shape", which the Phase 0 record framed as a drawback
of OpenAPI drift. Against the parent-internal API it turns out to be the correct design; it
should be retained deliberately rather than replaced with a uniform envelope.

### 2.2 `design.md`'s sketch, and the Phase 0 correction, both re-confirmed

Phase 0 found against the public API that `error` is a plain string with `code` as a
sibling, not `string | {code, message}`, and that there is no `meta` block.

Parent-internal source agrees on the first point and goes further: `error` is a **plain
string** everywhere it appears (login, subscription 401, logout 500), and in the routes read
here there is **no `code` sibling at all** — the only machine-readable signal is the HTTP
status. There is no `meta` block. `design.md`'s `ApiEnvelope` sketch does not describe the
parent-internal API.

The consequence is §1.2's problem generalised: distinguishing failure causes that share a
status code requires string-matching `error`. Endpoints that need a stable machine-readable
reason should be listed by TASK-1.4 as candidates for a parent-side error-code proposal.

### 2.3 `src/lib/api-client.ts` is not the parent's API contract

The Phase 0 record treated this file as the thing to read to learn the envelope. Having read
it: it is a small **client-side fetch helper** (131 lines) — `safeJsonParse`,
`handleApiError`, `apiRequest`, `authenticatedApiRequest`, `authFetch`. It defines no
response contract. Its `ApiError` interface (`{ error, status?, details? }`) is a *local*
normalisation type, and `handleApiError` coerces whatever it finds with
`errorData.error || errorData.message || 'Request failed'` — i.e. it copes with the
inconsistency documented in §2.1 by flattening it.

Two details are relevant to the desktop:

- `authFetch` (`api-client.ts:115-130`) defaults `credentials: 'include'` — a browser,
  cookie-oriented assumption. The desktop should not model its client on this function.
- `safeJsonParse` throws when `content-type` is not JSON before attempting to parse, which
  is the behaviour Phase 0's client already implements for malformed 2xx responses.

**Pre-check outcome**: the file is read and closed as an input. It confirms the envelope is
inconsistent enough to need per-call-site normalisation; it is not itself a contract to
mirror.

### 2.4 Scope note for TASK-1.4

The pinned `tenders-sa-developer-api-v2.1.0-openapi.json` documents the **public** API.
TASK-1.4 requires comparing route handlers against **both** parent OpenAPI documents. That
comparison is against **714 route handlers** (`parent-baseline.md` §7) and was not attempted
here. INT-6's drift finding (1 of 98 endpoints documenting a `200` content schema;
`Unauthorized`/`NotFound` component responses referenced by no endpoint) stands unmodified
for the public document.

---

## 3. Parent brand hues — deferred from TASK-0.8

Read from `src/app/globals.css` at the baseline. The parent defines two sets: a light theme
(`:root`, lines 254-289) and a dark override (lines 314-324).

### 3.1 Parent light theme vs desktop tokens

Desktop values from `src/styles/tokens.css` at desktop `origin/main` (`105d5e4`).

| Token | Parent light | Desktop | Hue |
|-------|--------------|---------|-----|
| `--primary` | `160 84% 30%` | `160 70% 42%` | **160 — identical** |
| `--accent` | `48 96% 53%` | `45 90% 58%` | 48 → 45 (−3°) |
| `--destructive` | `0 84.2% 60.2%` | `0 72% 59%` | **0 — identical** |
| `--success` | `160 84% 39%` | `160 65% 48%` | **160 — identical** |
| `--warning` | `48 96% 53%` | `45 85% 58%` | 48 → 45 (−3°) |
| `--error` | `0 84.2% 60.2%` | `0 72% 59%` | **0 — identical** |
| `--info` | `221 83% 53%` | `221 75% 62%` | **221 — identical** |

**Brand identity is preserved.** Five of seven hues match the parent exactly; the other two
shift by 3°. The systematic difference is in the other two channels: saturation is reduced
(≈10-20 points) and lightness raised (≈6-12 points) across every token — exactly the
adjustment needed to carry these hues on the desktop's dark surface at AA contrast.

This is the divergence the handoff said to expect and preserve. It is a **surface
adaptation of the parent palette, not a different palette**, and the fidelity check passes
on that reading.

### 3.2 The parent's own dark theme is the thing not to copy

| Token | Parent **dark** | Desktop |
|-------|-----------------|---------|
| `--success` | `120 100% 25%` | `160 65% 48%` |
| `--warning` | `60 100% 50%` | `45 85% 58%` |
| `--error` | `0 100% 50%` | `0 72% 59%` |
| `--info` | `240 100% 50%` | `221 75% 62%` |

The parent's dark-mode status colours are fully-saturated primaries at extreme lightness —
`120 100% 25%` is a very dark pure green, `240 100% 50%` pure blue. They also **abandon the
brand hues** the light theme establishes: success moves 160 → 120, info 221 → 240.

Re-aligning desktop tokens to *these* is what would reintroduce the contrast failures the
handoff warns about, and it would additionally break brand consistency. The desktop is
correct to derive from the light-theme brand hues and adapt them, rather than adopt the
parent's dark overrides.

`src/tests/design-tokens.test.ts` enforces the corrected values and will fail on any such
re-alignment. That guard should stay.

### 3.3 Outcome

Not blocking, as the handoff stated. The fidelity check **passes**: desktop tokens are
hue-faithful to the parent brand, and the deviations are the deliberate, test-guarded
contrast corrections. No desktop change is required.

Recorded for TASK-1.6: the parent's dark-theme status tokens are a plausible accessibility
defect **in the parent**, on the same six-failure basis that drove the desktop corrections.
Verifying and proposing a fix is a parent-side change outside Phase 1's read-only scope.

---

## 4. Summary

| Pre-check | Origin | Status |
|-----------|--------|--------|
| Parent auth contract | TASK-0.9 | **Resolved.** INT-1 settled — Bearer, body token. Contract evidenced for TASK-1.3. |
| Parent API contract | TASK-0.7 | **Resolved as pre-check.** No single envelope exists; six shapes found. Feeds TASK-1.4, which is not started. |
| Parent brand hues | TASK-0.8 | **Resolved. Passes.** Hue-faithful; divergence deliberate and correct. |

New findings raised for TASK-1.6 (capability gap report):

1. No server-side JWT revocation on logout — body tokens stay valid up to 7 days. Parent-side.
2. CSRF minted but validated by no mutating route; enforcement would break all desktop mutations at once.
3. `/api/auth/me` returns 200 with `user: null` instead of 401 — status codes cannot signal session expiry.
4. Failure causes sharing a status code are separable only by `error` string; no error codes.
5. Logout hard-codes `'token'` instead of `AUTH_COOKIE_NAME`.
6. Parent submodule gitlink for the desktop app is stale by the entire Phase 0 implementation.
7. Parent dark-theme status tokens abandon brand hues and are likely contrast-failing.
