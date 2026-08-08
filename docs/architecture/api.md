# ADR: Typed API Transport (TASK-0.7)

- **Status**: accepted, **partially superseded by Phase 1** — see §0
- **Refs**: REQ-5, INT-2, INT-6, PERF-3; design.md §API Client Design

## 0. Phase 1 resolution — the upstream question is answered

> **Added 2026-07-28, after Phase 1 (TASK-1.3, TASK-1.4) and on explicit user
> direction. This section supersedes §"Which API this is" wherever they conflict.**

This ADR was written while the parent repository was unreachable. It correctly flagged the
ambiguity and closed by saying: *"Whether the desktop client ultimately consumes one upstream
or two is itself a Phase 1 finding."*

**Phase 1 has answered it, and the answer is one upstream:**

> **The desktop consumes the main application's parent-internal API — the same endpoints the
> Tenders-SA web application uses. It does not consume the public Developer API at
> `api.tenders-sa.org`.**

| | Main application API — **the target** | Developer API — **not the target** |
|---|---|---|
| Host | `https://www.tenders-sa.org` — hard-wired, never configurable (`load-config.ts` exports `API_BASE_URL`) | `api.tenders-sa.org` |
| Routes | `/api/auth/*`, `/api/tenders`, `/api/v1/applications`, `/api/v1/company/profile`, `/api/subscription/*` | `/v1/*`, `/v2/*` |
| Auth | session JWT, `Authorization: Bearer` | API key |
| Pagination | `page`/`limit`, or `limit`/`offset` | `limit`/`cursor` |
| Coverage | auth, workspace, mutations | read-only public data |

Reasons, from the audit rather than preference:

1. **`requirements.md` always scoped the parent-internal API.** The Developer API has no
   auth-session, workspace, or mutation routes, so it cannot serve this product at all.
2. **`endpoint-inventory.md`** inventories 16 main-application endpoints; the Developer API
   appears only as the drift comparison INT-6 requires.
3. **`auth-subscription-contract.md`** establishes the session contract against
   `/api/auth/*` on the application host.

### What this changes in the sections below

| Statement below | Status |
|-----------------|--------|
| "This transport targets the **Tenders-SA Developer API**" | **Superseded.** It targets the main application API. |
| "the auth port it exposes is a bearer-key hook, **not** the audited native session contract" | **Superseded.** TASK-1.3 audited the session contract; the adapter is Phase 2 work. |
| "Whether the desktop client ultimately consumes one upstream or two is itself a Phase 1 finding" | **Resolved: one upstream.** |
| CSP `connect-src` "must be widened to `https://api.tenders-sa.org`" | **Superseded twice over.** Requests are issued from Rust, so `connect-src` never needs widening at all. |
| "The API host is configuration, not a constant" | **Superseded 2026-08-07.** Production pointing is unconditional: the host is the constant `API_BASE_URL` in `src/app/config/load-config.ts`, and `VITE_API_BASE_URL`/`VITE_ALLOWED_ORIGINS` are no longer read. |
| The verified envelope, retry, timeout, cancellation and error-normalisation design | **Still valid.** These are transport-policy decisions and survive the retarget. |

### Still-open consequences, tracked

- **PA-1**: `src/tests/api-transport.test.ts` still uses `baseUrl: "https://api.tenders-sa.org"`
  and asserts `cursor` pagination that no main-application route uses. The base URL is
  incidental to what those tests cover, but the shape is misleading. Phase 2 re-points it —
  `phase-2-plan.md` acceptance criterion **A16**.
- **C-1**: the `fetch` transport must be swapped for a Rust-backed adapter behind the existing
  injectable seam before any live call can succeed.
- The pinned `tenders-sa-developer-api-v2.1.0-openapi.json` is retained **only** as INT-6 drift
  evidence. It is not a source of desktop types.
- **2026-08-07 — dashboard routes**: the live deployment answers `{}` for
  `/api/v1/dashboard/summary` and `/api/v1/dashboard/activity` (verified with a live
  session). The Command Centre deadline/activity panels therefore consume
  `/api/v1/applications` + `/api/v1/documents/stats`, like the web dashboard does. The
  two broken routes are dead to the desktop; `docs/specifications/dashboard-live-data.md`
  records the retarget and the exact derivations.

Everything from §"Which API this is" onward is preserved as the original Phase 0 record.

## Which API this is

This transport targets the **Tenders-SA Developer API** at
`https://api.tenders-sa.org` (OpenAPI 3.0.0, `info.version` 2.1.0, 98
endpoints, all `GET`). A copy of the spec as retrieved on 2026-07-27 is
pinned at
`docs/audits/tenders-sa-developer-api-v2.1.0-openapi.json`.

**This is not the same API the specification's Phase 1 scope
describes.** requirements.md's integration points list the parent web
application's internal routes -- `/api/auth/login`, `/api/auth/me`,
`/api/v1/company/profile`, `/api/v1/applications/{id}/workspace`,
`/api/subscription/feature-access/{feature}` -- none of which exist on
this host. The Developer API is read-only public data (tenders, awards,
organizations, companies, directors, forensic/CIPC/intel datasets) with
no authentication-session endpoints and no mutations.

Consequences, recorded here so a later reader is not misled:

- TASK-0.7's stated pre-check ("compare the parent response envelope,
  `src/lib/api-client.ts`, audited OpenAPI metadata, and representative
  route responses") is **only partly satisfied**. The envelope and
  representative responses below are verified against a live API; the
  parent repository's `src/lib/api-client.ts` and internal routes were
  **not** inspected, because that repository is not reachable from this
  session.
- Everything about the parent-internal contract therefore remains
  `UNCONFIRMED` and is Phase 1's job (TASK-1.3 for auth, TASK-1.4 for
  endpoints/drift). This transport is built for the Developer API, and
  the auth port it exposes is a bearer-key hook, **not** the audited
  native session contract REQ-4 gates on.
- Whether the desktop client ultimately consumes one upstream or two is
  itself a Phase 1 finding.

## Verified envelope (evidence, not assumption)

Confirmed with live non-mutating `GET` requests, not read off the
document (which, as noted below, barely documents responses at all):

```jsonc
// GET /v2/meta/status  ->  200
{ "success": true, "data": { "healthy": true, "version": "v2", ... } }

// GET /v2/tenders  ->  401 (no Authorization header)
{ "success": false,
  "error": "Missing Authorization header. Use: Bearer tsa_prod_<your_key>",
  "code": "MISSING_API_KEY",
  "requestId": "req_aef29439",
  "docs": "https://tenders-sa.org/developers/docs",
  "timestamp": "2026-07-27T18:46:26.492Z" }

// GET /v2/tenders  ->  401 (invalid key)  -- adds an "action" field
{ ..., "code": "INVALID_API_KEY", "action": "API_KEY_REQUIRED", ... }
```

### This contradicts design.md's sketch in two ways

design.md types the envelope as:

```ts
error?: string | { code?: string; message: string };
meta?: Record<string, unknown>;
```

Reality: **`error` is always a plain string**, with `code` as a
*sibling* field of the envelope, and **there is no `meta` block** --
pagination is cursor-based via `?limit`/`?cursor` query parameters. A
transport built on the sketch would mis-parse every error this API
returns. `src/services/api/envelope.ts` implements the verified shape
and documents the divergence at the point of definition. The sketch
predates verification; it is not wrong to have sketched it, but the
verified contract wins (design.md's own rule: route/live behaviour
outranks documentation).

`action` is present on some errors and absent from the published
schema; it is modelled as optional.

## OpenAPI drift (INT-6)

The published document describes a `200` **content schema for exactly 1
of its 98 endpoints** (`/v2/meta/status`, and even that is a bare
`{"type": "object"}`). The `Unauthorized` and `NotFound` component
responses are defined but referenced by **no** endpoint.

Per INT-6, generated types are therefore not usable here: response
schemas must be hand-authored and marked `awaiting-contract` until a
route-verified contract exists. `apiSuccessEnvelope(dataSchema)`
enforces this structurally -- every call site must supply its own
`data` schema, so there is no way to consume an endpoint without having
stated what you expect back. This drift is exactly what REQ-11/TASK-1.4
exist to measure, and is recorded as an input to that audit.

## Transport design

`src/services/api/transport.ts` provides `ApiTransport.get()` with:

- **Runtime validation** -- the response is parsed through
  `apiSuccessEnvelope(schema)`; a 2xx body that fails validation raises
  a `malformed` error rather than returning unvalidated data (INT-2).
- **Cancellation and timeout** -- one internal `AbortController` merges
  the caller's signal with a deadline, so the two are distinguishable:
  an aborted-by-deadline request yields `timeout`, an aborted-by-caller
  request yields `cancelled`. A signal that is already aborted rejects
  without issuing a request at all.
- **Bounded, safe-only retries** -- `retry: "safe-idempotent" | "never"`
  with capped exponential backoff (500ms, 1s, 2s… max 8s). Only
  `offline`, `timeout`, `rate-limited`, and `server` are retried;
  `cancelled` never is. Every v2 endpoint is a GET, but the policy stays
  explicit so a future mutation cannot inherit retries by accident.
- **Distinct error states** (REQ-5) -- `unauthorized`, `forbidden`,
  `not-found`, `rate-limited`, `validation`, `server`, `offline`,
  `timeout`, `cancelled`, `malformed` as a closed union, so a caller
  cannot mistake an auth failure for a retryable blip. `SyncOutcome`
  in TASK-0.6 maps onto these directly.
- **Correlation** -- the server's `requestId` is preserved on the error
  for support/debugging (OPS-1).
- **Injectable `fetch` and `sleep`** -- tests run without network or
  real timers.

## Redaction (REQ-8, PRIV-1)

`ApiError.message` is drawn from the server's own `error` string or a
fixed local string -- never from the request body, headers, or query
values, which can carry the API key or tender content. Two specific
guards:

- Zod validation issues are **not** attached to a `malformed` error;
  Zod quotes offending values, which would leak response content into
  logs.
- A non-2xx whose body is not a valid error envelope produces
  `Request failed with status N` **without** the body, which could be
  an HTML error page or proxy output.

`toLogFields()` returns only `kind`/`status`/`code`/`requestId`. A test
asserts the API key never appears in a rendered error or its log
fields.

## Not built yet

No endpoint adapters (typed functions per route) and no TanStack Query
integration -- those belong to the feature tasks that consume specific
endpoints, each supplying its own hand-authored `data` schema. Adding
98 speculative adapters now would be exactly the "empty architecture
theatre" design.md warns against. The `connect-src` CSP directive
(TASK-0.4) must be widened to `https://api.tenders-sa.org` when a
feature first issues a real request; it is deliberately not widened
yet, since nothing calls the API at runtime.
