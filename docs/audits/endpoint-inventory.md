# Parent endpoint inventory and OpenAPI drift

**Task**: TASK-1.4 — Inventory relevant parent endpoints and OpenAPI drift
**Refs**: REQ-11, INT-2, INT-6
**Baseline**: `8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1` — see `parent-baseline.md`
**Recorded**: 2026-07-28

Every route fact below is read from the handler source at the baseline SHA. Where a handler and
an OpenAPI document disagree, **the handler wins** and the disagreement is recorded as drift.
Unknowns are labelled `UNCONFIRMED` rather than inferred.

---

## 1. Scope and selection rule

The parent exposes **714** route handlers (`find src/app/api -name route.ts | wc -l`). REQ-11
scopes "every **relevant** endpoint" and "every **Phase 2 dependency**", not all 714. A thin
pass over 714 routes would be worth less than an explicit, bounded inventory — so the selection
rule is stated rather than left implicit:

**Included** — an endpoint is in scope if it is either
1. named in `requirements.md` §Existing integration points, **or**
2. required by one of REQ-12's nine domains for the Phase 2 slice.

**Excluded, with reason**:

| Excluded | Count (approx.) | Why |
|----------|-----------------|-----|
| `/api/admin/**` | ~120 | Admin console; desktop users are not admins (middleware requires `ADMIN`/`SUPER_ADMIN`) |
| `/api/ai-mirror/**` | ~40 | AI-crawler mirror surface for SEO, not an application API |
| `/api/cron/**` | ~25 | `CRON_SECRET`-gated schedulers; no client calls them |
| `/api/webhooks/**` | — | Inbound payment/WhatsApp webhooks |
| marketing, SEO, newsletter, publisher, embed, widgets, leaderboard | ~200 | Public web surface, outside REQ-12's domains |
| Remaining unrelated internal surface | balance | Not reachable from any Phase 2 screen |

**16 endpoints are inventoried in full**, covering all nine REQ-12 domains for the Phase 2
slice. Coverage is therefore 16/714 of the total surface and — by the rule above — **100% of the
Phase 2 dependency set**. The ratio is recorded so the coverage claim is visible rather than
implied.

Endpoints beyond the Phase 2 slice (JV workflow, pricing/returnables, company intelligence
deep-dives, tender radar) are deliberately **not** inventoried here: they belong to later
vertical slices whose specifications will need their own audit at their own baseline. Inventorying
them now would produce a document stale before it is used.

---

## 2. Endpoint inventory

Auth column: **MW** = enforced by `src/middleware.ts` (every `/api` route except a 45-entry
allowlist); **handler** = the handler additionally verifies. Both is normal and is defence in
depth.

### 2.1 Authentication and entitlement

Full contract detail is in `auth-subscription-contract.md`; summarised here for completeness.

| Route | Method | Auth | Request | Success shape | Pagination | Test |
|-------|--------|------|---------|---------------|------------|:----:|
| `/api/auth/login` | POST | public (allowlisted) | `{email, password}` Zod | `{success:true, data:{message, token, user, company, csrfToken}}` | — | no |
| `/api/auth/me` | GET | public (allowlisted) | — | `{user, company, token}` — **bare, always HTTP 200** | — | no |
| `/api/auth/logout` | POST | public (allowlisted) | — | `{success:true}` | — | no |
| `/api/subscription/status` | GET | MW + handler (`verifyJWTFromRequest`) | — | `{success:true, subscription}` | — | no |
| `/api/subscription/feature-access/[feature]` | GET | MW + handler | path `feature` | `{hasAccess, reason?, minimumTier?, upgradeUrl?, source}` — **bare** | — | no |

Login is additionally rate-limited (10 / 15 min, IP-keyed, `Retry-After`, not reset on success)
and wrapped in `withObservability`.

### 2.2 Tender discovery

| Route | Method | Auth | Query | Success shape | Test |
|-------|--------|------|-------|---------------|:----:|
| `/api/tenders` | GET | **MW only** | `page`, `limit` (aliases `pageNum`, `pageSize`), `search`, `industry`, `province`, `publicationType` | `{tenders[], pagination:{page,limit,total,pages}, debug{...}}` | **no** |
| `/api/tenders/[id]` | GET | **MW only** | — | domain object | **no** |

**Neither handler performs its own auth check.** They are protected *solely* because they are
absent from middleware's allowlist. That is real protection today, but it is one allowlist edit
away from becoming a public data leak, and nothing in the handler would object. Recorded as
gap **E-4**.

`/api/tenders` returns a **`debug` block on every response** — `totalInDb`, `activeTenders`,
`futureTenders`, `filteredCount`, `cached`. It discloses corpus-level database statistics to
every caller and inflates a list payload the desktop will fetch repeatedly. Gap **E-5**.

Cache headers: `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`. Note
`public` on a middleware-gated, per-user-authenticated route — safe only because the response
does not vary by user. The desktop should not rely on it staying that way.

**There is no `/api/v1/tenders`.** The `/v1/tenders` paths in `docs/openapi/v1.yaml` belong to
the **public Developer API** on a different host (`api.tenders-sa.org`), not to this
application. Confirmed absent: `src/app/api/v1/tenders/route.ts` does not exist. A desktop
developer reading `v1.yaml` and calling `/api/v1/tenders` against the app host gets a 404.

### 2.3 Company profile and vault

| Route | Method | Auth | Success shape | Test |
|-------|--------|------|---------------|:----:|
| `/api/v1/company/profile` | GET | MW + handler | domain object | no |
| `/api/v1/company/profile` | **PUT** | MW + handler | domain object | no |
| `/api/v1/company/profile/extended` | GET | MW + handler | domain object | no |
| `/api/v1/company/profile/extended` | **POST** | MW + handler | domain object | no |

`PUT` returns `{error: 'Company name is required'}` (400) and `{error: 'Company not found'}`
(404). Note `extended` uses **POST** for what is semantically an update — the desktop's offline
queue must not assume POST means "create", and must not treat it as safe to retry blindly
(§4).

### 2.4 Application workspace

| Route | Method | Auth | Query / body | Success shape | Test |
|-------|--------|------|--------------|---------------|:----:|
| `/api/v1/applications` | GET | MW + `verifyJWTFromRequest` | `status`, `search`, `archived`, offset pagination | `{applications[], pagination:{total, limit, offset, hasMore}}` | no |
| `/api/v1/applications` | POST | MW + handler | `{tenderId, …}` | domain object | no |
| `/api/v1/applications` | PATCH | MW + handler | — | domain object | no |
| `/api/v1/applications/[applicationId]` | GET | MW + **`auth()`** | — | domain object | no |
| `/api/v1/applications/[applicationId]` | PUT | MW + **`auth()`** | — | domain object | no |
| `/api/v1/applications/[applicationId]/workspace` | **PATCH only** | MW + `verifyJWTFromRequest` | `{action, …}` | `{success:true, …action-specific}` | **yes** |
| `/api/v1/applications/workspace/summary` | GET | MW + handler | — | domain object | **yes** |
| `/api/v1/dashboard/summary` | GET | MW + **`auth()`** | — | domain object | **yes** |

Four observations that change desktop design:

1. **`/workspace` exposes `PATCH` only** — no `GET`. Reading workspace state comes from
   `/api/v1/applications/[applicationId]` or `/workspace/summary`; the workspace route is a
   command endpoint, dispatching on an `action` field in the body and returning
   `{success:true}` plus action-specific keys (`isArchived`, `persisted`, `stageOverride`).
   Unknown actions return `{error: 'Unknown action'}` (400).
2. **Two different auth helpers are used across sibling routes.** `verifyJWTFromRequest` on
   most, `auth()` on `[applicationId]` and `dashboard/summary`. Both resolve Bearer-first so
   the desktop is unaffected, but they return different payloads —
   `verifyJWTFromRequest` yields only `{userId, email}`, dropping `role` and `companyId` even
   when present in the token. Any future role check must not use it. Gap **E-6**.
3. **`POST /api/v1/applications` returns `{error: 'Company profile required'}` (400)** when the
   user has no company. The desktop must handle "authenticated but not onboarded" as a distinct
   state from an auth failure — a 400 here is not a validation bug the user can fix by retrying.
4. **An action-dispatch PATCH is not idempotent by construction** (§4).

### 2.5 Documents (INT-4)

| Route | Method | Auth | Query | Success shape | Test |
|-------|--------|------|-------|---------------|:----:|
| `/api/v1/documents/[documentId]/download-url` | GET | MW + `verifyJWTFromRequest` | `redirect=1`, **`requireR2=1`** | `{downloadUrl, fileName, source}` | **yes** |

This is the INT-4 boundary and the most important single endpoint in the inventory. The handler
resolves a document URL through an ordered chain, tagging the winner in `source`:

```
'r2'          r2StorageUrl, structurally valid (docs domain, /docs/ path)
'constructed' r2StorageKey, structurally valid (docs/<tender_id>/…, ≥3 parts, not a CUID)
'worker-d1'   resolved via the Worker at etenders-api.tenders-sa.org/api/documents/resolve
'worker-api'  same Worker, API path
'original'    the government downloadUrl — emergency fallback only
```

> **`requireR2=1` causes the handler to return 404 rather than fall back to `'original'`
> (`route.ts:451-458`).**

That is precisely the guarantee INT-4 needs, expressed as a server-side switch rather than
desktop discipline. **The desktop must always send `requireR2=1`.** With it, the parent cannot
hand back a government URL, so the constraint holds even if desktop code is later changed
carelessly. `redirect=1` returns a 307 instead of JSON; the desktop should use the JSON form so
it can record `source` for provenance (INT-8).

**This endpoint is baseline-sensitive** — see §5.

### 2.6 Notifications

| Route | Method | Auth | Query | Success shape | Test |
|-------|--------|------|-------|---------------|:----:|
| `/api/v1/notifications` | GET | MW + handler | `limit` (default 20, **max 50**), `offset`, `types`, `unreadOnly` | `{notifications[], pagination:{total, limit, offset, hasMore}, unreadCount}` | no |
| `/api/v1/notifications` | PUT | MW + handler | body | `{success:true, …}` | no |

`limit` is clamped to 50 here, versus `MAX_LIMIT = 100` in the shared `parsePagination` helper —
the notifications route implements its own clamp inline rather than using the shared helper.

---

## 3. The envelope problem — there is no single parent-internal envelope

INT-2 requires the desktop to "preserve the parent response-envelope contract". **The audit's
central finding for TASK-1.4 is that no such single contract exists.** Across the 16 endpoints
above, **nine distinct top-level response shapes** appear:

| # | Shape | Example |
|---|-------|---------|
| 1 | `{success: true, data: {...}}` | `POST /api/auth/login` |
| 2 | `{success: false, error: string}` | login failures |
| 3 | `{success: true}` (+ ad-hoc keys) | logout; workspace PATCH `{success, isArchived}` |
| 4 | `{success: true, <domainKey>: {...}}` | `{success, subscription}` |
| 5 | `{error: string}` | route-level 401/404/500 |
| 6 | `{error: string, message: string}` | middleware 401/403 |
| 7 | bare domain object, no wrapper | `/api/auth/me` → `{user, company, token}`; `feature-access` → `{hasAccess, source}` |
| 8 | `{<collection>[], pagination:{page,limit,total,pages}, debug}` | `/api/tenders` |
| 9 | `{<collection>[], pagination:{total,limit,offset,hasMore}, …}` | `/api/v1/notifications`, `/api/v1/applications` |

Shapes 1, 3 and 4 all set `success: true` yet place the payload under `data`, nowhere, and a
domain-specific key respectively. Shapes 7, 8 and 9 have **no discriminator at all**. Shapes 5
and 6 are the same failure expressed two ways.

### Reconciliation with Phase 0's implemented schema

Phase 0 verified its envelope against the **live public Developer API** and implemented
`apiSuccessEnvelope(dataSchema)`, correcting design.md's sketch on two points. Both corrections
**hold** against parent-internal source, and one extends further:

| design.md sketch | Phase 0 finding (public API) | Parent-internal source | Verdict |
|------------------|------------------------------|------------------------|---------|
| `error?: string \| {code, message}` | plain string, `code` a *sibling* | plain string, and **no `code` sibling at all** on the internal routes read | design.md **wrong**; Phase 0 right; internal is even flatter |
| `meta?: Record<string, unknown>` | no `meta`; pagination via `?limit`/`?cursor` | no `meta`; pagination via `page`/`limit` **or** `limit`/`offset` | design.md **wrong**; Phase 0 right |
| `success: boolean` always present | present | **absent on 3 of 9 shapes** | both **incomplete** for internal |

> **`design.md`'s `ApiEnvelope` does not describe the parent-internal API, and neither does the
> public-API envelope Phase 0 verified.** The implemented schema is correct for the public API
> and should be kept for it.

### Decision for the desktop (INT-2)

> **Treat the envelope as per-endpoint, not global.** Each endpoint adapter declares its own
> Zod response schema; the shared transport layer handles only transport concerns — status,
> timeout, cancellation, retry policy, and auth-failure classification.

Phase 0 already built exactly this: `apiSuccessEnvelope(dataSchema)` "structurally forces every
call site to hand-author its expected shape", which the Phase 0 record framed as a *drawback*
forced by OpenAPI drift. Against the parent-internal API it turns out to be **the correct
design**, and it should now be retained deliberately rather than replaced with a uniform
envelope. A client-side layer assuming `{success, data}` would fail against the majority of
these routes.

Two shared helpers the transport does still need:
- **Failure parsing** must accept `{error}` with an optional `message`, and must **not** require
  `success: false` — shapes 5 and 6 omit it (already covered by the TASK-1.3 fixtures).
- **Pagination** must be per-endpoint, not global (§4).

### `src/lib/api-client.ts` is not the contract

The Phase 0 pre-check named this file as the place to learn the envelope. Having read it: it is
a 131-line **client-side fetch helper** — `safeJsonParse`, `handleApiError`, `apiRequest`,
`authenticatedApiRequest`, `authFetch`. It defines no response contract. Its `ApiError`
(`{error, status?, details?}`) is a local normalisation type, and `handleApiError` copes with
the inconsistency above by flattening it:
`errorData.error || errorData.message || 'Request failed'`.

Two details matter to the desktop:

- `authFetch` defaults `credentials: 'include'` — a browser, cookie-oriented assumption. **The
  desktop must not model its client on this function**, both because it uses Bearer (TASK-1.3
  §2) and because it transports via Rust (TASK-1.3 §6).
- `safeJsonParse` throws when `content-type` is not JSON *before* parsing — the behaviour Phase
  0's transport already implements for malformed 2xx responses.

**Pre-check outcome: read and closed as an input.** It confirms the envelope is inconsistent
enough to require per-call-site normalisation; it is not a contract to mirror.

---

## 4. Pagination, idempotency, and CSRF

### Four incompatible pagination conventions

| Convention | Where | Response |
|------------|-------|----------|
| `?page` / `?limit` (aliases `pageNum`, `pageSize`) | `/api/tenders`, via shared `parsePagination` | `{page, limit, total, pages}` |
| `?limit` / `?offset` | `/api/v1/notifications`, `/api/v1/applications` | `{total, limit, offset, hasMore}` |
| `?limit` / `?cursor` | public Developer API | cursor |
| `?page` / `?per_page` | `docs/06-api-documentation/openapi.json` | `{data, page, per_page, total, total_pages}` — **documents nothing that exists** (§5) |

Shared limits (`src/lib/pagination.ts`): `DEFAULT_PAGE = 1`, `DEFAULT_LIMIT = 20`,
`MAX_LIMIT = 100`, `MAX_OFFSET = 100_000`; `page` is clamped to `MAX_OFFSET / limit + 1`.
`/api/v1/notifications` ignores the shared helper and clamps `limit` to **50** inline.

> **PERF-3 consequence**: the desktop must implement pagination **per endpoint**, and must send
> an explicit `limit` on every list call. A shared "fetch all pages" utility that assumes one
> convention will silently return page 1 forever against the other.

### Idempotency — no server-side support anywhere

**No inventoried endpoint accepts an idempotency key.** No `Idempotency-Key` header is read, and
no route exposes a client-supplied dedupe token.

This constrains REQ-7's offline queue directly:

- **Safe to retry**: every `GET` above.
- **Not safe to retry blindly**: `POST /api/v1/applications`, `PUT`/`POST` on company profile,
  `PATCH /workspace`, `PUT /api/v1/notifications`.

Two mitigations already exist in the parent's data model and must be used rather than a
client-invented key:

1. **`Application` is `@@unique([companyId, tenderId])`** (`model-inventory.md` §2.1). A replayed
   `POST /api/v1/applications` collides at the database level instead of creating a duplicate.
   The desktop must treat that collision as "already exists, reconcile" rather than an error —
   this is the closest thing to idempotency the contract offers, and it is a real guarantee.
2. **`PATCH /workspace` dispatches on `action`.** Actions that *set* a value
   (`stageOverride`, `isArchived`) are naturally idempotent; any action that *increments* or
   appends is not. The full action list was not enumerated — `UNCONFIRMED`, and the Phase 2
   slice must enumerate it before queueing any workspace mutation offline.

Gap **E-1**: no idempotency-key support. Proposed parent enhancement, not a desktop workaround.

### CSRF

No inventoried endpoint validates CSRF; across all 714 handlers the only caller of
`validateServerCsrfToken`/`requireCSRFToken` is the CSRF endpoint itself, and middleware does
none. Per TASK-1.3 §7 the desktop sends `x-csrf-token` on mutations regardless, so parent-side
enablement cannot break every desktop mutation at once.

---

## 5. OpenAPI drift (INT-6)

TASK-1.4's pre-check requires comparing route handlers against **both** parent OpenAPI
documents. Both were found and analysed, and a third document — the one pinned in this
repository — is reconciled against them.

| Document | Version | Ops | Ops with a 200 content schema | Component responses referenced | Describes |
|----------|---------|-----|-------------------------------|-------------------------------|-----------|
| `docs/openapi/v1.yaml` (parent) | 1.0.0 | 19 | **19 / 19** | all 5 referenced (17, 17, 12, 10, 5) | **Public** Developer API @ `api.tenders-sa.org` |
| `docs/06-api-documentation/openapi.json` (parent) | *none* | 3 | 2 / 3 | n/a | 3 paths, **matching nothing that exists** |
| `docs/audits/tenders-sa-developer-api-v2.1.0-openapi.json` (this repo) | 2.1.0 | 98 | **1 / 98** | **0 / 2** | **Public** Developer API, live-fetched |

### Finding 1 — INT-6's drift is in the *published* document, not the parent's source

This reverses a reasonable assumption. The parent's own source-controlled `v1.yaml` is
**well-formed**: all 19 operations document a 200 content schema, and every component response
(`BadRequest`, `Unauthorized`, `NotFound`, `RateLimited`, `InternalError`) is referenced by real
operations.

The **v2.1.0 document published by the live API** — pinned in this repository during Phase 0 — is
severely degraded: exactly **1 of 98** operations (`GET /v2/meta/status`) documents a 200 content
schema, and both component responses it defines are referenced **zero** times.

Phase 0's INT-6 finding is therefore **confirmed and correctly attributed**: it describes the
published v2.1.0 artifact, not the parent repository's documentation. Between v1.0.0 (19 ops,
fully specified) and v2.1.0 (98 ops, 1 specified), the generator regressed badly. That is a
**parent-side documentation defect** (gap **E-2**), and it is why INT-6 forbids generating
desktop types from it.

### Finding 2 — neither OpenAPI document describes the parent-internal API

Both parent documents describe the **public** Developer API surface (`/v1/*`, `/v2/*` on
`api.tenders-sa.org`). **None of the 16 endpoints in §2 appears in either document.**

`requirements.md` anticipated this ("it is not assumed to describe all internal
application/workspace APIs"). It is now confirmed: the parent-internal application API is
**entirely undocumented by OpenAPI**.

Per INT-6, every endpoint in §2 is therefore a **hand-authored schema marked
`awaiting-contract`**. None may be generated from either document.

### Finding 3 — `docs/06-api-documentation/openapi.json` is actively misleading

This 3-path, 5.8 KB fragment has **no `openapi` version, no `info`, and no `servers`** — it is
not a valid OpenAPI document. Worse, every fact in it is wrong about the routes it appears to
describe:

| Documented | Actual handler | Drift |
|------------|----------------|-------|
| `GET /tenders` query `q` | `/api/tenders` reads `search` | **wrong name** |
| `GET /tenders` query `per_page` | reads `limit` (aliases `pageSize`) | **wrong name** |
| 200 `{data, page, per_page, total, total_pages}` | `{tenders, pagination:{page,limit,total,pages}, debug}` | **wrong at every key** |
| `GET /applications` — no parameters | `/api/v1/applications` accepts `status`, `search`, `archived`, offset pagination | **incomplete** |
| 200 `{data, total}` | `{applications, pagination:{total,limit,offset,hasMore}}` | **wrong** |
| `GET /tenders/{tenderId}` 200 with no properties | domain object | **empty** |
| *(absent)* | `POST` and `PATCH /api/v1/applications` exist | **undocumented mutations** |

> A developer following this file would write a client that fails on every call. Route code
> outranks it, and it should not be cited by any desktop artifact. Gap **E-3**.

---

## 6. Baseline sensitivity

`parent-baseline.md` §2 justified re-pinning off `be09f9d51` partly on this endpoint. The
justification is now concrete rather than precautionary.

Commit `9fd93b2` (`fix(download-url): remove cacheStatus gate from R2 resolution steps 2 and 3`)
landed **after** both `be09f9d51` and the interim `199e422` pin, and changed the resolution rule
inventoried in §2.5:

```diff
- * Step 2: Trust r2StorageUrl only if confirmed.
- * Rules: Starts with DOCS_DOMAIN, status is CACHED, path starts with /docs/.
+ * Step 2: Trust r2StorageUrl if present and structurally valid.
+ * Rules: Starts with DOCS_DOMAIN, path starts with /docs/.
-  if (!url || document.cacheStatus !== 'CACHED') return false;
+  if (!url) return false;
```

An inventory pinned at either earlier SHA would state that R2 resolution requires
`cacheStatus === 'CACHED'`. **At this baseline it does not.** A desktop client built on the older
reading would wrongly expect documents with a non-`CACHED` status to be unresolvable, and would
show users a failure the parent no longer produces.

Seven other Phase-2-relevant handlers also differ between `be09f9d51` and this baseline
(`parent-baseline.md` §2), including `workspace/summary` and `dashboard/summary`, both inventoried
above.

---

## 7. Confirmed gaps

Carried to `workspace-gap-report.md` (TASK-1.6) for classification. Recorded here with evidence.

| # | Gap | Evidence | Severity |
|---|-----|----------|----------|
| **E-1** | No idempotency-key support on any mutating endpoint | §4 | **High** — REQ-7 offline replay |
| **E-2** | Published v2.1.0 OpenAPI documents a 200 schema for 1 of 98 ops; 0/2 component responses referenced — a regression from v1.0.0's 19/19 | §5 | **High** — blocks type generation |
| **E-3** | `docs/06-api-documentation/openapi.json` is an invalid fragment, wrong at every field | §5 | Medium — actively misleading |
| **E-4** | `/api/tenders` and `/api/tenders/[id]` rely on middleware alone; handlers have no auth check | §2.2 | Medium — one allowlist edit from a data leak |
| **E-5** | `/api/tenders` returns a `debug` block with corpus DB statistics on every response | §2.2 | Medium — disclosure + payload bloat |
| **E-6** | Two auth helpers across sibling routes; `verifyJWTFromRequest` drops `role`/`companyId` | §2.4 | Low — latent for future role checks |
| **E-7** | Parent-internal API has **no** OpenAPI coverage; all 16 endpoints need hand-authored schemas | §5 | Medium — expected, now confirmed |
| **E-8** | Only 4 of 16 inventoried endpoints have a route test | §2 | Medium — contract stability |
| **E-9** | `/workspace` action vocabulary not enumerated | §4 | Medium — blocks offline queueing |
| **E-10** | `PUT /api/v1/company/profile` stores a raw string unvalidated; the `GET` path `JSON.parse`s it unguarded, so a bad write 500s every later read | §9 | Medium — data-poisoning foot-gun |
| **E-11** | `Tender.requirements`/`eligibilityCriteria`/`bbbeeRequirements` are parsed on the detail route but returned raw on the list route — same field, different type per endpoint | §9 | Medium — breaks a single shared schema |

### Stability assessment

"Stability" here means how confident the desktop can be that a contract will not move under it.

| Endpoint group | Stability | Basis |
|----------------|-----------|-------|
| `/api/auth/*` | **High** | Frozen Tier 1; behaviour test-guarded (`jwt-auth.test.ts`) |
| `/api/subscription/*` | **High** | Frozen; simple, stable shapes |
| `/api/v1/documents/.../download-url` | **Medium** | Test-covered, but **changed within the audit window** (§6) |
| `/api/v1/applications/workspace/summary`, `/api/v1/dashboard/summary` | **Medium** | Test-covered, but recently reworked by the bounded-reads workstream |
| `/api/v1/applications`, `/api/v1/applications/[id]` | **Low-Medium** | No tests; largest handlers (414 / 344 lines) |
| `/api/tenders`, `/api/tenders/[id]` | **Low-Medium** | No tests; `debug` block suggests in-flux code |
| `/api/v1/company/profile*` | **Low-Medium** | No tests |
| `/api/v1/notifications` | **Low-Medium** | No test; diverges from the shared pagination helper |

**No endpoint the Phase 2 slice depends on is rated High except auth and subscription.** Phase 2
must therefore validate every response at the boundary (REQ-5 already requires this) and treat
schema-validation failures as an expected, handled state rather than a bug.

---

## 8. Verification

TASK-1.4's verify condition: *every Phase 2 dependency records route, method, auth, schemas,
pagination, idempotency/CSRF, evidence path, stability, and missing capability; undocumented
assumptions are labelled.*

| Required | Result |
|----------|--------|
| Route handlers enumerated | **yes** — 714 counted; 16 in-scope inventoried under a stated selection rule (§1) |
| Compared with **both** parent OpenAPI documents | **yes** — `docs/openapi/v1.yaml` and `docs/06-api-documentation/openapi.json`, plus this repo's pinned v2.1.0 (§5) |
| Representative tests reviewed | **yes** — 4 of 16 endpoints have route tests; absence recorded as E-8 |
| Route, method, auth per endpoint | **yes** — §2 |
| Request/response schemas | **yes** — §2, §3; `UNCONFIRMED` where a domain object was not field-enumerated |
| Pagination | **yes** — §4, four conventions |
| Idempotency / CSRF | **yes** — §4; none supported, mitigations identified |
| Evidence path | **yes** — every claim cites a parent path, most with line ranges |
| Stability | **yes** — §7 |
| Missing capability | **yes** — E-1…E-9 |
| Route code outranks documentation | **yes** — §5 resolves every conflict in the handler's favour |
| Undocumented assumptions labelled | **yes** — `/workspace` action vocabulary (E-9), domain-object field sets, `Json` column shapes carried from `model-inventory.md` M-6 |

### Deliberately not done

- **A per-route inventory of all 714 handlers.** REQ-11 scopes relevant endpoints and Phase 2
  dependencies; §1 states the rule and the 16/714 ratio rather than implying full coverage.
- **Field-level enumeration of every domain-object response.** Several handlers (414 and 344
  lines) build large ad-hoc projections. Pinning those field-by-field is work the Phase 2 slice
  must do *for the endpoints it actually consumes*, against fixtures, at its own baseline —
  doing it here for endpoints Phase 2 may not touch would produce detail that rots before use.
- **Field-level enumeration of every domain-object response** (see above).

`model-inventory.md`'s M-5 and M-6 were deferred to this task, and §9 resolves both.

---

## 9. Resolution of the deferred model-layer gaps M-5 and M-6

`model-inventory.md` deferred two questions here on the expectation that route code would
answer them. It does — the encodings are visible in the handlers, and both gaps close.

### M-5 resolved — list-like `String` columns are **JSON-encoded**

`Company.industryCodes`, `provincesOperating`, and `certifications` are `String` in Prisma but
hold JSON arrays. `src/app/api/v1/company/profile/route.ts:36-40` reads them with
`JSON.parse(...)`, defaulting to `[]`, and lines 164-168 do the same on the `PUT` response.
The pattern repeats in `profile/extended/route.ts:110` and `src/app/tenders/workspace/[id]/page.tsx:323`.

> **The API returns these as parsed arrays, not strings.** As with `toAuthUser` (TASK-1.3 §3),
> the desktop schema must follow the **response**, not the Prisma model: `string[]`, not `string`.

**Write contract, and a robustness trap.** `PUT` accepts *either* form
(`route.ts:101-105`):

```ts
industryCodes: typeof industryCodes === 'string' ? industryCodes : JSON.stringify(industryCodes),
```

A string is stored **verbatim, unvalidated**. Since the `GET` path calls `JSON.parse` with no
`try`/`catch`, writing a non-JSON string poisons the record: every subsequent read of that
company profile throws and returns 500.

> **Desktop rule**: always send **arrays** on company-profile writes, never pre-serialised
> strings. This is a live foot-gun, not a theoretical one.

Recorded as gap **E-10** (parent-side input validation), severity Medium.

### M-6 resolved for `Application`, partially for `Tender`

**`Application.checklistState`** — an array of stable-id items
(`assist/route.ts` `generateDefaultChecklist`):

```ts
Array<{ id: string; label: string; completed: boolean;
        category: 'preparation' | 'documents' | 'submission' }>
```

Eleven default items, with `tech-specs` and `attend-briefing` spliced in conditionally, so the
array is **variable-length and order-sensitive** but every item carries a stable `id`.

**`Application.documentState`** — `generateDocumentState`:

```ts
Array<{ name: string; required: boolean; uploaded: boolean; uploadedAt: string | null }>
```

`progressPercentage` is derived server-side as
`round(completed / checklistState.length * 100)` (`calculateProgress`), so the desktop must
**not** compute or write it independently — it would disagree with the server.

> **This materially improves the conflict story.** `model-inventory.md` §3 concluded the desktop
> must "treat them as whole-value conflicts" because the shape was unknown. It is now known, and
> both blobs are **arrays keyed by a stable identifier** (`id`, `name`). Field-level merge is
> therefore possible: two users ticking different checklist items can be reconciled per item
> instead of forcing a whole-document conflict. That supersedes the interim conclusion, and it
> is a real usability difference in a collaborative workspace.
>
> The no-silent-overwrite rule still applies unchanged to the `generated*` proposal and pricing
> fields (REQ-7), which are opaque text and must not be merged.

**`Tender.requirements` / `eligibilityCriteria` / `bbbeeRequirements` — partially resolved, and
the two tender routes disagree.**

- `/api/tenders/[id]` passes each through `parseJsonField` (`route.ts:162-166`), which tries
  `JSON.parse`, falls back to comma-splitting, then to a single-element array, and returns `[]`
  for empty input — so **detail always yields an array**.
- `/api/tenders` (list) returns the same three fields **raw** (`route.ts:287-289`), unparsed.

> **The same field has a different type depending on which endpoint returned it.** A desktop
> schema written against the detail route will fail validation on the list route. This is
> in-parent inconsistency, not desktop error, and it is exactly what INT-2's
> validate-at-the-boundary rule is for.

The *inner* shape of the parsed value remains **`UNCONFIRMED`** — `parseJsonField` returns
`any`, and the tolerance of its fallback path implies the stored data is not uniformly JSON.
The desktop should model these as `unknown[]` and render defensively rather than assume a
record shape. Recorded as gap **E-11**.

---

## 10. Verification addendum

| Deferred item | Status |
|---------------|--------|
| M-5 list encoding | **Resolved** — JSON-in-string; API returns arrays (§9) |
| M-6 `Application` Json shapes | **Resolved** — both are stable-id arrays; field-level merge now possible (§9) |
| M-6 `Tender` Json shapes | **Partially resolved** — list/detail disagree (E-11); inner shape stays `UNCONFIRMED` |

An earlier draft of this document asserted that route code did not reveal these encodings and
carried M-5/M-6 forward as blockers. That was wrong, and checking rather than asserting is what
found it — the parsing is plainly visible in the company-profile and assist handlers. The
corrected finding is above; **M-5 and M-6 are closed** except for the labelled `Tender` inner
shape.

**TASK-1.4 is complete.**
