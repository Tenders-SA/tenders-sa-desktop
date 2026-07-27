# ADR: Typed API Transport (TASK-0.7)

- **Status**: accepted
- **Refs**: REQ-5, INT-2, INT-6, PERF-3; design.md §API Client Design

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
