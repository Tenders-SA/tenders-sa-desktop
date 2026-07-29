# Cross-domain desktop mappings

**Task**: TASK-1.5 — Produce cross-domain desktop mappings
**Refs**: REQ-12, INT-3, INT-4, INT-8
**Baseline**: `8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1` — see `parent-baseline.md`
**Recorded**: 2026-07-28

Maps each REQ-12 domain to its canonical parent source, the endpoint that serves it, the local
projection the desktop may hold, the provenance it must retain, and the access rule that governs
it.

**Pre-check complete**: `model-inventory.md` (TASK-1.2) and `endpoint-inventory.md` (TASK-1.4)
loaded, and the canonical parent tender-document architecture read before mapping document
flows (§9). The two buyer/organisation models left partial by TASK-1.2 were read field-by-field
for this task (§5).

---

## 1. Rules that apply to every mapping

Derived from the two inventories; stated once rather than repeated in nine tables.

| Rule | Source | Consequence |
|------|--------|-------------|
| **Server IDs are retained verbatim** | INT-3 | Every local row keys on the parent `cuid()`. The desktop mints no entity IDs; offline-created rows key on `sync_operations.idempotency_key` until the server returns one. |
| **No optimistic-concurrency token exists** | `model-inventory.md` §2.2 | `updatedAt` is the base-version token where present. `MatchingScore` has none — use `calculatedAt`/`isStale`. `Notification` read-state changes are undetectable; refetch rather than diff. |
| **Every response is validated at the boundary** | INT-2, REQ-5 | Nine envelope shapes exist; each adapter declares its own schema. Validation failure is a handled state, not a bug. |
| **Pagination is per-endpoint** | `endpoint-inventory.md` §4 | Four conventions. Always send an explicit `limit`. |
| **Entitlement is never computed locally** | INT-5, SEC-3 | Cache the server's answer for affordances only. |
| **Sensitive payloads are encrypted locally** | REQ-6, SEC-2 | The `sensitive` flag routes through TASK-0.4's `encrypt_value`. |
| **The API is reached from Rust, not webview `fetch`** | `auth-subscription-contract.md` §6 | No CORS headers on any mapped route. |

**Provenance (INT-8)** applies wherever a value is AI-derived, enriched, or fuzzy-joined. INT-8
requires source document, page where available, original excerpt, interpretation, confidence,
timestamp, and verification state. The parent supplies confidence and source fields on several
models; where it does not, the desktop must record **which endpoint and when**, and must not
present a derived value as a fact. Domains carrying this obligation are flagged **INT-8** below.

---

## 2. Company profile and vault

| Aspect | Mapping |
|--------|---------|
| **Canonical source** | `Company`, `CompanyProfile`, `Document` (vault), + `Director`, `KeyPersonnel`, `PreviousExperience` |
| **Endpoints** | `GET`/`PUT /api/v1/company/profile`; `GET`/`POST /api/v1/company/profile/extended` |
| **Local projection** | Full profile cache — it is small, single-row, and needed offline for proposal preparation |
| **Provenance** | Server `updatedAt`; `CompanyProfile.completenessScore`/`lastAssessedAt` are server-computed |
| **Access rule** | Owner-scoped. `Company.userId` is `@unique`, so the session user has exactly one company |

**A user has at most one company.** No company switcher may be built (`auth-subscription-contract.md` §9).

**List-encoded fields**: `industryCodes`, `provincesOperating`, `certifications` are `String` in
Prisma but **JSON-encoded**, and the API returns them **parsed as arrays**
(`endpoint-inventory.md` §9). The desktop schema follows the response — `string[]` — not the
model.

> **The desktop must always send arrays on write, never pre-serialised strings.** `PUT` stores a
> string verbatim and unvalidated, while `GET` calls `JSON.parse` unguarded, so one bad write
> makes every later read 500 (gap E-10). This is the single most dangerous write path in the
> mapping.

**`extended` uses `POST` for an update.** The offline queue must not infer "create" from `POST`,
and must not treat it as blindly retry-safe.

**Sensitivity**: `taxNumber` and `registrationNumber` are regulated identifiers — cache
encrypted. `profileText` and vault document metadata are moderate. `Document.expiryDate` drives
expiring-certificate warnings and is a genuine offline need.

**Not mapped**: vault file *contents*. `Document.fileUrl` points at uploaded company documents;
downloading and caching those is a later slice with its own storage and retention decisions.

---

## 3. Tender and matching

| Aspect | Mapping |
|--------|---------|
| **Canonical source** | `Tender` (114 field/relation lines), `MatchingScore` |
| **Endpoints** | `GET /api/tenders` (list), `GET /api/tenders/[id]` (detail) |
| **Local projection** | The bounded subset in `model-inventory.md` §3 — **not** the whole model |
| **Provenance (INT-8)** | `apiSource`, `sourceUrl`, `aiConfidence`, `classificationConfidence`, `classificationMethod`, `provinceSource`, `lastSyncAt` |
| **Access rule** | Middleware-gated only; handlers perform no auth check (gap E-4) |

**Ingestion internals are deliberately excluded** from the projection — `parsedData`,
`processingStatus`, `qualityScore`, `validationErrors`, `cacheHit`, `processingTime`,
`manualReview`, `isDuplicate`. Caching them would invite the desktop to reason about parent
pipeline state it cannot affect.

**The list and detail routes disagree on three fields.** `requirements`, `eligibilityCriteria`,
and `bbbeeRequirements` are passed through `parseJsonField` on **detail** but returned **raw** on
**list** (gap E-11). The desktop needs two schemas, or one tolerant schema, and must not assume
a shared type. Their inner shape stays `UNCONFIRMED`; model them as `unknown[]` and render
defensively.

**`AIEnrichmentStatus` and AI fields are provenance-bearing.** `aiTitleEnriched`, `aiSummary`,
and `aiKeyRequirements` are machine-generated. Per INT-8 the desktop must show them as derived,
carrying `aiConfidence` and `aiProcessedAt`, and must never present `aiSummary` as the tender's
own wording in a compliance context.

**`MatchingScore` is server-computed and must never be recalculated locally** — a local score
would disagree with the platform and with the emails users receive. Cache invalidation keys on
`calculatedAt` and `isStale`, **not** `updatedAt`, which the model does not have. Its
`factors`, `weights`, `improvementAreas`, and `failedRequirements` are `Json` with shapes
`UNCONFIRMED` at this baseline.

**Amendments matter for correctness**: `parentTenderId`, `amendmentNumber`, `publicationType`,
and `cancellationReason` mean a tender can be superseded or cancelled. A cached tender shown
without checking for related publications can present a withdrawn opportunity as live.

---

## 4. Supplier and company intelligence

| Aspect | Mapping |
|--------|---------|
| **Canonical source** | `SupplierEnrichmentProfile`, `TenderAwardSupplier` |
| **Endpoints** | Reached through award/tender detail; no dedicated Phase 2 endpoint inventoried |
| **Local projection** | Read-only cache, minimal retention |
| **Provenance (INT-8)** | `confidenceScore`, `sourceUrls[]`, `lastEnrichedAt`, `contactEmailSource`, `contactEmailSourceUrl`, `contactEmailConfidence`, `contactEmailVerifiedAt` |
| **Access rule** | Third-party personal data — encrypted at rest, minimal retention |

**Supplier identity is a fuzzy string join.** `SupplierEnrichmentProfile` has **no foreign key**
to any award or company; it is matched on `normalizedName`, which is indexed but **not unique**
(`model-inventory.md` §2.1).

> The desktop must present enrichment as *attributed, confidence-scored* data about a name, not
> as fact about a supplier. Two distinct companies with similar names can collide, and the
> product's users make commercial decisions — partner selection, competitive assessment — on
> this data.

The model is unusually well-equipped for INT-8: it carries `sourceUrls`, per-field confidence,
and verification timestamps. The desktop must surface these rather than discard them, and must
treat `contactEmailIsRoleBased` as a signal that an address is generic rather than personal.

**Sensitivity is high**: `contactEmail`, `ceo`, `founders`, `headquartersPhone`,
`headquartersAddress` are third-party personal data. PRIV-1's minimal-retention rule applies
more strictly here than to the user's own data — the user did not consent on these people's
behalf.

---

## 5. Buyer and organisation

| Aspect | Mapping |
|--------|---------|
| **Canonical source** | `SourceOrganization` (government buyers), `OCDSParty` (OCDS-registered parties) |
| **Endpoints** | Via `Tender.sourceOrganizationId` and `TenderAward.supplierPartyId` on tender/award detail |
| **Local projection** | Buyer name, type, province, slug, contact — display-only |
| **Provenance (INT-8)** | `confidenceScore`, `validationStatus`, `lastValidatedAt`, `apiSource`, `contactEmailConfidence`; `OCDSParty.dataSource`, `isProtected`, `lastSyncedAt` |
| **Access rule** | Public-record data; standard cache |

TASK-1.2 marked these partial; both were read field-by-field here.

**Two buyer models coexist and are not interchangeable.** `SourceOrganization` is the platform's
own buyer registry — enriched with Google Places and LinkedIn data, `slug`-addressable, carrying
`organizationType` (`government_department`, `municipality`, `state_enterprise`).
`OCDSParty` is the OCDS-standard party record, keyed by `ocdsPartyId`, carrying `roles[]`
(`buyer`, `supplier`, `tenderer`, `procuringEntity`) and a scheme-qualified `identifierId`
(CIPC, SARS). A single real organisation may appear as both.

> The desktop must not merge them into one local "organisation" table without a reconciliation
> rule, and none exists at this baseline. Recommended: project them separately and link by
> `normalizedName` **as a display hint only**, with the same fuzzy-join caveat as §4.

**`OCDSParty.isProtected` defaults to `true`** — "Prevents overwrite by secondary sources". This
is a data-quality signal worth surfacing: a protected record is OCDS-authoritative, an
unprotected one may be AI-extracted (`dataSource` ∈ `OCDS_API`, `AI_EXTRACTION`, `MANUAL`).

**`SourceOrganization` carries Google enrichment** (`googleRating`, `googleUserRatingsTotal`,
`googleTypes`, `googleAddress`). Displaying a **government buyer's Google star rating** inside a
procurement tool would be misleading — it rates a physical location, not procurement conduct.
Recommend excluding the Google rating fields from the projection; recorded as a product decision
for the Phase 2 slice rather than a technical gap.

---

## 6. Award

| Aspect | Mapping |
|--------|---------|
| **Canonical source** | `TenderAward`, `TenderAwardSupplier`, `TenderContract` |
| **Endpoints** | Tender detail; internal award query routes named in `requirements.md` |
| **Local projection** | Award amount, date, supplier name, B-BBEE level/points, status |
| **Provenance (INT-8)** | `sourceLastObservedAt`, `sourceRecordHash`, `sourcePipeline`, `ocdsAwardId`, `etendersAwardId` |
| **Access rule** | Public-record data |

`TenderAward` carries an unusually complete provenance triple — `sourcePipeline`,
`sourceLastObservedAt`, `sourceRecordHash` — which lets the desktop show *when* an award was last
observed and detect upstream changes by hash. This satisfies INT-8 well and should be projected,
not dropped.

**Award data drives competitive intelligence**, so its accuracy matters commercially:
`supplierNormalizedName` and `supplierCanonicalId` exist alongside the raw `supplierName`. The
desktop should display the raw name and use the normalised one only for grouping — showing a
normalised name as the supplier's identity misrepresents the record.

`TenderAwardSupplier` handles multi-supplier awards with `isPrimary` and
`@@unique([awardId, sourceSupplierId])`. A UI that assumes one supplier per award will silently
hide consortium members.

---

## 7. Application workspace

| Aspect | Mapping |
|--------|---------|
| **Canonical source** | `Application`, `ApplicationEvent`, `ApplicationDocumentVersion` |
| **Endpoints** | `GET`/`POST`/`PATCH /api/v1/applications`; `GET`/`PUT /api/v1/applications/[applicationId]`; `PATCH .../workspace`; `GET .../workspace/summary`; `GET /api/v1/dashboard/summary` |
| **Local projection** | Full offline projection — this is the offline-first surface |
| **Provenance** | `updatedAt` as base version; `ApplicationDocumentVersion.createdBy` (`'ai'`/`'user'`) and `changeReason` |
| **Access rule** | Owner-scoped; server-enforced |

**This is the only domain the desktop mutates offline**, so REQ-7's rules land here.

**Creation is an upsert, not an insert.** `Application` is `@@unique([companyId, tenderId])`. A
replayed or two-device create collides server-side; the desktop treats the collision as
"already exists, reconcile" rather than an error. With no idempotency-key support anywhere
(gap E-1), this database constraint **is** the replay guarantee.

**`POST` returns 400 `{error: 'Company profile required'}`** when the user has no company —
"authenticated but not onboarded" is a distinct state, not a retryable validation error.

**Conflict policy, now field-level where it can be.** `endpoint-inventory.md` §9 resolved the two
`Json` blobs:

| Field | Shape | Conflict policy |
|-------|-------|-----------------|
| `checklistState` | `Array<{id, label, completed, category}>` | **Merge per item by `id`** — two users ticking different items reconcile cleanly |
| `documentState` | `Array<{name, required, uploaded, uploadedAt}>` | Merge per item by `name`; `uploaded` is server-derived |
| `generatedCoverLetter`, `generatedCapability`, `generatedMethodology`, `generatedEmail` | `@db.Text` | **Never merge. Preserve both versions for human resolution** (REQ-7) |
| `progressPercentage` | server-derived from `checklistState` | **Never write** — the server computes it; a local value would disagree |

This supersedes `model-inventory.md` §3's interim "whole-value conflicts" conclusion, which was
correct only while the shapes were unknown.

**`PATCH /workspace` is a command endpoint** dispatching on `action`, with no `GET`. Set-style
actions (`stageOverride`, `isArchived`) are naturally idempotent; the **full action vocabulary
is `UNCONFIRMED`** (gap E-9) and must be enumerated before any workspace mutation is queued
offline — an increment-style action replayed after a network retry would corrupt state.

**`ApplicationEvent` and `ApplicationDocumentVersion` are append-only** and have no `updatedAt`,
which is coherent. `ApplicationDocumentVersion` is a version log with
`@@unique([applicationId, documentType, versionNumber])` — the desktop must not invent version
numbers offline, since the server owns the sequence.

**Sensitivity is high**: the four `generated*` fields are competitive proposal content, and
`submissionNotes`/`proofOfSubmissionUrl` are submission evidence. All encrypted locally, never
logged (REQ-8).

---

## 8. Subscription

| Aspect | Mapping |
|--------|---------|
| **Canonical source** | `Subscription`, `BundleWallet` |
| **Endpoints** | `GET /api/subscription/status`; `GET /api/subscription/feature-access/[feature]` |
| **Local projection** | **The `/status` projection only** — never the model |
| **Provenance** | Server response timestamp; short cache TTL |
| **Access rule** | Server-authoritative (INT-5, SEC-3); cached only for UI affordances |

**Never cache the model.** Payment identifiers (`paystackSubscriptionId`, `paystackEmailToken`,
`paypalSubscriptionId`, `paddleSubscriptionId`, `externalSubscriptionId`) exist on `Subscription`
and are **absent from the `/status` projection** — which is exactly what makes that projection
safe to hold.

Two traps, both pinned by the TASK-1.3 fixtures:

- **A synthesised `'free'` plan with `id: null`** is returned for users with application credits
  but no subscription. Branching on `subscription === null` hides features they have paid for.
- **`feature-access` returns `hasAccess: false` inside its HTTP 500 body.** Fail-closed is
  right, but it must surface as an error, not as an upsell.

Entitlement can come from a **bundle wallet the client cannot see**, so local computation is not
merely discouraged — it cannot be correct. `/api/auth/me` is authoritative for `subscriptionTier`,
overriding login's value.

---

## 9. Documents — the INT-4 flow

INT-4 is the constraint with the sharpest failure mode: the desktop must consume tender documents
through the existing application-facing flow and **never** reimplement government/OCDS
downloading.

### Canonical parent architecture (read before mapping, per the pre-check)

```
Government / OCDS sources
        │   (parent ingestion only — the desktop NEVER touches this edge)
        ▼
Cloudflare Worker  ── https://etenders-api.tenders-sa.org
   /api/documents/resolve?tender_id=&file_name=&source_url=
        │   consults D1, triggers R2 caching
        ▼
Cloudflare R2  ── https://docs.tenders-sa.org/docs/<tender_id>/<file>
        ▲
        │
Parent Next.js API
   GET /api/v1/documents/[documentId]/download-url?requireR2=1
        ▲
        │   the desktop's ONLY entry point
Desktop client
```

Configuration read from source: `DOCS_DOMAIN = 'https://docs.tenders-sa.org'`
(`download-url/route.ts:22`); Worker base `CLOUDFLARE_WORKER_URL`, defaulting to
`https://etenders-api.tenders-sa.org` (`route.ts:362`).

### Mapping

| Aspect | Mapping |
|--------|---------|
| **Canonical source** | `TenderDocument` (+ R2 objects, Worker/D1 index) |
| **Endpoint** | `GET /api/v1/documents/[documentId]/download-url?requireR2=1` |
| **Local projection** | Document **metadata** + a `local_file_references` row — never server truth |
| **Provenance (INT-8)** | The response's `source` field (`r2`/`constructed`/`worker-d1`/`worker-api`/`original`), plus `extractionMethod`, `extractionConfidence`, `r2UploadedAt` |
| **Access rule** | Authenticated, owner-scoped by the parent |

### The three rules that keep INT-4 satisfied

1. **Always send `requireR2=1`.** With it, the handler returns **404 rather than falling back to
   the government `downloadUrl`** (`route.ts:451-458`). The constraint becomes a server-side
   guarantee instead of desktop discipline — it survives careless future edits to desktop code.
2. **Never read `TenderDocument.downloadUrl` and fetch it.** That field is the original
   government URL ("may expire", per the model comment). It may legitimately appear in a cached
   metadata projection; using it as a fetch target is precisely the prohibited behaviour. The
   safest posture is to **exclude it from the local projection entirely**, so the mistake cannot
   be made.
3. **Prefer the JSON response over `redirect=1`.** The JSON form returns `source`, which the
   desktop records for provenance; a 307 discards it.

**A 404 under `requireR2=1` means "not yet cached", not "missing".** The desktop must render
that as a retryable pending state — the Worker may cache the document on a later attempt — not
as a permanent failure.

**The resolved URL points at `docs.tenders-sa.org`, a second host.** That fetch is also
CORS-subject and must therefore also be issued from Rust, and it is the download that writes to
the local filesystem under TASK-0.4's scoped capabilities.

**`extractedText` can hold an entire document.** If cached, it requires the encrypted
(`sensitive`) path and an explicit size bound; it is never logged (REQ-8).

---

## 10. Notification

| Aspect | Mapping |
|--------|---------|
| **Canonical source** | `Notification`, `NotificationPreferences` |
| **Endpoints** | `GET /api/v1/notifications` (`limit` ≤ 50, `offset`, `types`, `unreadOnly`); `PUT` to update read state |
| **Local projection** | Recent notifications + `unreadCount` |
| **Provenance** | `createdAt`; **no `updatedAt`** |
| **Access rule** | Owner-scoped |

**Read-state changes are undetectable.** `Notification` has no `updatedAt`, so a diff-based sync
cannot see `isRead` flip (gap M-2). The desktop **refetches** rather than diffs, and treats a
local `isRead` as an optimistic write reconciled by the next fetch.

`isRead` and a legacy `read` field both exist; which the routes honour is **`UNCONFIRMED`**
(gap M-4). Until resolved the desktop reads `isRead` and lets the server own the write via `PUT`.

`NotificationType` has 18 values with overlapping semantics (`DIGEST`/`DIGEST_SENT`,
`SYSTEM`/`SYSTEM_ALERT`/`SYSTEM_ANNOUNCEMENT`). Map several onto one UI treatment, and **accept
unknown values forward-compatibly** — a closed enum rejects valid server data the day the parent
adds a case.

---

## 11. Coverage

| REQ-12 domain | Source | Endpoint | Local projection | Provenance | Access rule |
|---------------|:------:|:--------:|:----------------:|:----------:|:-----------:|
| Company profile / vault | ✅ §2 | ✅ | ✅ | ✅ | ✅ |
| Tender / matching | ✅ §3 | ✅ | ✅ | ✅ INT-8 | ✅ |
| Supplier intelligence | ✅ §4 | ⚠️ no dedicated endpoint | ✅ | ✅ INT-8 | ✅ |
| Buyer / organisation | ✅ §5 | ⚠️ via tender/award detail | ✅ | ✅ INT-8 | ✅ |
| Award | ✅ §6 | ✅ | ✅ | ✅ INT-8 | ✅ |
| Application workspace | ✅ §7 | ✅ | ✅ | ✅ | ✅ |
| Document | ✅ §9 | ✅ | ✅ | ✅ INT-8 | ✅ |
| Subscription | ✅ §8 | ✅ | ✅ | ✅ | ✅ |
| Notification | ✅ §10 | ✅ | ✅ | ⚠️ no `updatedAt` | ✅ |

Two ⚠️ endpoint entries are honest limits, not omissions: supplier intelligence and
buyer/organisation have **no dedicated Phase 2 endpoint** in the inventory — they are reached as
nested data on tender and award detail. Standalone company-intelligence routes exist in the
parent (`requirements.md` names them) but belong to a later slice and were excluded by
TASK-1.4's selection rule. Mapping them now would document endpoints Phase 2 does not call.

### Server ownership preserved (INT-3)

No mapping above makes the desktop a source of truth for any parent-owned record. The desktop is
canonical only for what `design.md`'s Canonical Ownership table already grants it: local
preferences, recent records, the offline queue and conflicts until accepted, and local file
references. Every parent entity is cached with its server ID and a base-version token, and every
mutation goes back through a parent endpoint.

---

## 12. Verification

TASK-1.5's verify condition: *company/vault, tender/matching, supplier, buyer, award, workspace,
document, subscription, and notification needs each map to source, endpoint, local projection,
provenance, and access rule.*

| Required | Result |
|----------|--------|
| Pre-check — inventories loaded | **yes** — TASK-1.2 and TASK-1.4 outputs consumed throughout |
| Pre-check — tender-document architecture read before mapping | **yes** — §9, Worker/R2/D1 topology read from `download-url/route.ts` |
| All nine domains mapped on all five axes | **yes** — §11, with two endpoint limits labelled |
| Server ownership preserved | **yes** — §11 |
| Data provenance retained (INT-8) | **yes** — per-domain provenance fields; five domains flagged INT-8 |
| Tender document flow follows Worker/R2/D1 | **yes** — §9, with `requireR2=1` as a server-side guarantee |
| Government sources never fetched directly | **yes** — §9, three rules, including excluding `downloadUrl` from the projection |
| Buyer models resolved from TASK-1.2's partial status | **yes** — §5, both read field-by-field |
| Conflict policy per field | **yes** — §7, field-level merge where stable ids allow it |
| Unknowns labelled | **yes** — `/workspace` action vocabulary (E-9), `Tender` Json inner shapes (E-11), `MatchingScore` Json shapes, `isRead`/`read` authority (M-4) |
| No parent file modified | **yes** — reads only |

**TASK-1.5 is complete.**
