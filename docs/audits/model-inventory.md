# Canonical parent data model inventory

**Task**: TASK-1.2 — Inventory canonical parent data models
**Refs**: REQ-10, REQ-12, INT-3
**Baseline**: `8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1` — see `parent-baseline.md`
**Recorded**: 2026-07-28

Every model, field, and constraint below is read from parent source at the baseline SHA.
Assertions cite a parent path. Unknowns are labelled `UNCONFIRMED` rather than inferred.

**Format note (REQ-10)**: REQ-10 accepts "machine-readable **or** tabular". This inventory is
tabular only. A parallel JSON emission was considered and deliberately rejected: it would be a
second hand-maintained copy of the same facts with no generator keeping it honest, and the
first schema change would silently desynchronise them. `tasks.md` lists the JSON as optional.

---

## 1. Pre-check — domain schemas enumerated, canonical vs non-authoritative settled

TASK-1.2's pre-check requires enumerating the domain and generated schemas, treating domain
files as canonical and backups as non-authoritative.

| Artifact | Count | Status |
|----------|-------|--------|
| `prisma/*-domain.prisma` | **35 files**, 193 models, 49 enums | **Canonical** |
| `prisma/base.prisma` | 0 models, **20 shared enums**, generator + datasource | **Canonical** — see below |
| `prisma/schema.prisma` (generated) | 193 models, 69 enums | Faithful composition — verified below |
| `prisma/schema.prisma.backup` | 193 models, 585 bytes smaller | **Non-authoritative** |
| `prisma/schema.prisma.backups` | **47 models only** | **Non-authoritative** |
| `prisma/data-protection-schema.prisma.archived` | — | **Non-authoritative** (self-labelled) |

**`base.prisma` is part of the canonical set, and an enumeration of `*-domain.prisma` alone
misses it.** It holds no models, but it holds the `generator`/`datasource` blocks and 20 shared
enums — including `NotificationType`, which the desktop needs. This was caught by looking for
`NotificationType` in the domain files and not finding it. Recorded explicitly because
"canonical = the domain files" is the natural reading of the pre-check and is incomplete.

### The generated schema does not drift from the canonical sources

Rather than assume the composition is faithful, every model block was extracted from both
sides and compared with comments and blank lines normalised away:

| Check | Result |
|-------|--------|
| Models in domain files | 193 |
| Models in `schema.prisma` | 193 |
| Model names defined in two different domain files | **none** |
| Models in generated but in no domain file | **0** |
| Models in domain files but not generated | **0** |
| All 14 desktop-required entities, domain vs generated | **byte-identical** after normalisation |
| Enums: 49 (domain) + 20 (base) vs 69 (generated) | **exact** — 0 in generated from neither source |

So for the required entities the domain files and the generated schema are interchangeable as
evidence. Where this inventory cites a domain file, `schema.prisma` says the same thing.

### The backups are demonstrably stale, not merely "unofficial"

This matters because a reader who opens the wrong file gets a wrong answer, so the pre-check's
"non-authoritative" label is given evidence rather than asserted:

- `schema.prisma.backups` contains **47 of 193** models — 148 are missing.
- It still defines **`ScrapingJob`** and **`ScrapingSource`**, which exist in **no** canonical
  domain file. A desktop developer reading it would conclude the platform exposes scraping
  models that have since been removed — and INT-4 explicitly forbids the desktop from
  touching ingestion in the first place.
- `schema.prisma.backup` has the same 193 model names but differs in body; it is a same-day
  stale copy (both last committed 2026-07-26, `.backups` older at 2026-07-23).

**Neither is cited anywhere in this inventory or any other Phase 1 artifact.**

---

## 2. Required entity inventory

The 14 entities are those `requirements.md` §Existing data reality names as already owned by
the parent. Each is confirmed present in exactly one canonical domain file.

| Entity | Canonical source | Table | Owner | Desktop responsibility |
|--------|-----------------|-------|-------|------------------------|
| `User` | `prisma/user-domain.prisma` | `users` | Parent | Auth projection only, via `toAuthUser` |
| `Company` | `prisma/user-domain.prisma` | `companies` | Parent | Read/cache; edit via API |
| `CompanyProfile` | `prisma/user-domain.prisma` | `company_profiles` | Parent | Read/cache; edit via API |
| `Tender` | `prisma/tender-domain.prisma` | `tenders` | Parent/Workers | Read/cache only — never re-ingest |
| `TenderDocument` | `prisma/tender-domain.prisma` | `tender_documents` | Parent/Workers + R2 | Metadata cache + local file ref |
| `TenderAward` | `prisma/tender-domain.prisma` | `tender_awards` | Parent/Workers | Read/cache only |
| `TenderAwardSupplier` | `prisma/tender-domain.prisma` | `tender_award_suppliers` | Parent/Workers | Read/cache only |
| `SupplierEnrichmentProfile` | `prisma/tender-domain.prisma` | `supplier_enrichment_profiles` | Parent | Read/cache — **PII, see §4** |
| `Application` | `prisma/matching-domain.prisma` | `applications` | Parent | Offline projection + conflict-safe mutation |
| `ApplicationEvent` | `prisma/matching-domain.prisma` | `application_events` | Parent | Read/cache; append via API |
| `ApplicationDocumentVersion` | `prisma/matching-domain.prisma` | `application_document_versions` | Parent | Read/cache; append via API |
| `MatchingScore` | `prisma/matching-domain.prisma` | `matching_scores` | Parent | Read/cache only — server-computed |
| `Notification` | `prisma/notification-domain.prisma` | `notifications` | Parent | Read/cache; `isRead` via API |
| `Subscription` | `prisma/subscription-domain.prisma` | `subscriptions` | Parent | **Never cache raw — see §4** |

One additional model is in scope for REQ-12's "company profile/**vault**" and was not in
`requirements.md`'s list:

| Entity | Canonical source | Table | Note |
|--------|-----------------|-------|------|
| `Document` | `prisma/document-domain.prisma` | `documents` | Company compliance-document vault (tax clearance, B-BBEE, CIPC…) — distinct from `TenderDocument` |

**The two document models are easy to confuse and must not be.** `TenderDocument` is a
government-published tender attachment owned by the ingestion pipeline; `Document` is a
company's own uploaded compliance certificate. They share no relation. Naming a local cache
table "documents" without qualifying which one is a latent defect.

### 2.1 Identity and relationships (INT-3)

INT-3 requires local records to retain server IDs and sync metadata.

| Entity | Primary key | Parent-side foreign keys | Uniqueness constraints |
|--------|------------|--------------------------|------------------------|
| `User` | `String @id @default(cuid())` | — | `email @unique` |
| `Company` | `String @id` | `userId` → `User` | **`userId @unique`** |
| `CompanyProfile` | `String @id` | `companyId` → `Company` | `companyId @unique` |
| `Tender` | `String @id` | `parentTenderId` → `Tender` (self), `sourceOrganizationId` | `tender_id @unique`, `ocid @unique` |
| `TenderDocument` | `String @id` | `tenderId` → `Tender` (cascade) | — |
| `TenderAward` | `String @id` | `tenderId` → `Tender` (cascade), `supplierPartyId` → `OCDSParty` | `etenders_award_id @unique` |
| `TenderAwardSupplier` | `String @id` | `awardId` → `TenderAward` (cascade) | `@@unique([awardId, sourceSupplierId])` |
| `SupplierEnrichmentProfile` | `String @id` | **none** — joined by `normalizedName` | — |
| `Application` | `String @id` | `companyId`, `userId`, `tenderId` (all cascade) | **`@@unique([companyId, tenderId])`** |
| `ApplicationEvent` | `String @id` | `applicationId` (cascade) | — |
| `ApplicationDocumentVersion` | `String @id` | `applicationId` (cascade) | `@@unique([applicationId, documentType, versionNumber])` |
| `MatchingScore` | `String @id` | `companyId`, `tenderId` (cascade) | `@@unique([companyId, tenderId])` |
| `Notification` | `String @id` | `userId` (cascade), `templateId` | — |
| `Subscription` | `String @id` | `userId`, `companyId` (cascade) | `paypal_…`/`paystack_subscription_id @unique` |
| `Document` | `String @id` | `companyId` (cascade) | — |

All primary keys are server-generated `cuid()` strings. The desktop stores them verbatim and
**must not** mint its own entity IDs — offline-created rows are keyed by the local
`sync_operations.idempotency_key` until the server returns a real `id`.

Three constraints change desktop behaviour and are easy to miss:

1. **`Company.userId @unique` — a user has at most one company.** There is no membership
   join table and no multi-tenant path. The desktop must not build a company switcher;
   "account switching" means a different user session entirely. This directly answers part of
   TASK-1.3's "device/account switching" question.
2. **`Application @@unique([companyId, tenderId])` — one application per company per
   tender.** An offline "create application" replayed twice, or created on two devices,
   violates this constraint server-side. The desktop's queue must treat application creation
   as an upsert on `(companyId, tenderId)` and handle the collision as an existing-record
   merge, not an error. REL-1 depends on this.
3. **`SupplierEnrichmentProfile` has no foreign key to any award or company.** It is joined
   only by `normalizedName` (indexed, not unique). Supplier intelligence is therefore a
   *fuzzy string join*, and the desktop must surface enrichment as attributed, confidence-
   scored data (it carries `confidenceScore` and `sourceUrls`) rather than as a hard fact
   about a named supplier. INT-8's provenance requirement applies here.

### 2.2 Change-tracking fields — the INT-3 / REQ-7 gap

design.md §Sync State Machine specifies every mutation records a "base server version", and
REQ-7 requires conflict detection. This is the inventory's most consequential finding.

| Entity | `createdAt` | `updatedAt` | version / etag / revision |
|--------|:-----------:|:-----------:|:-------------------------:|
| `User` | yes | yes | **none** |
| `Company` | yes | yes | **none** |
| `CompanyProfile` | yes | yes | **none** |
| `Tender` | yes | yes | **none** |
| `TenderDocument` | yes | yes | **none** |
| `TenderAward` | yes | yes | **none** |
| `TenderAwardSupplier` | yes | yes | **none** |
| `SupplierEnrichmentProfile` | yes | yes | **none** |
| `Application` | yes | yes | **none** |
| `ApplicationEvent` | yes | **NO** | **none** |
| `ApplicationDocumentVersion` | yes | **NO** | **none** |
| `MatchingScore` | **NO** | **NO** | **none** |
| `Notification` | yes | **NO** | **none** |
| `Subscription` | yes | yes | **none** |
| `Document` | **NO** (`uploadedAt`) | **NO** | **none** |

Verified by field-level scan of `prisma/schema.prisma` for
`version|revision|etag|rowVersion|lockVersion`: **no match on any of the 15 models.**

**No parent model carries an optimistic-concurrency token.** Consequences, in order of
severity:

1. **`Application` — the one entity the desktop mutates offline — has only `updatedAt`.**
   The desktop must use `updatedAt` as its base-version token. That is weaker than a counter:
   two edits within the same clock tick are indistinguishable, and it depends on the server
   clock rather than a monotonic sequence. It is nonetheless sufficient for the conflict
   *detection* REQ-7 requires, because design.md already mandates preserving both versions for
   proposal/pricing rather than auto-merging. Recorded as an accepted limitation, and as a
   candidate additive parent field for TASK-1.6 — `Application.version Int @default(0)` is
   additive and non-breaking, but it is a parent change and therefore out of Phase 1 scope.
2. **`MatchingScore` has neither timestamp.** It carries `calculatedAt` plus an `isStale`
   boolean and `lastCompanyUpdate`. Cache invalidation for match scores must key on
   `calculatedAt`/`isStale`, not on a generic `updatedAt` the desktop's cache layer might
   assume for every entity. A uniform "compare updatedAt" cache policy would never refresh
   match scores.
3. **`ApplicationEvent`, `ApplicationDocumentVersion`, `Document`, `Notification` have no
   `updatedAt`.** For the first three this is coherent — they are append-only by design
   (`ApplicationDocumentVersion` is literally a version log with a `versionNumber`). For
   `Notification` it is a real gap: `isRead`/`read` are mutable, so a read-state flip is
   **invisible** to any change-detection scheme. The desktop must re-fetch notification lists
   rather than diff them, and must treat local `isRead` as an optimistic write reconciled by
   refetch.

`Notification` additionally carries **both** `isRead` and a legacy `read` field, the latter
commented "Keep for backward compatibility". The desktop must decide which it writes.
`UNCONFIRMED` at this task: which field the notification routes actually read and write is a
route-level question, deferred to TASK-1.4.

---

## 3. Fields the desktop needs, by entity

Scoped to Phase 2's dependency surface. Fields not listed are deliberately out of the local
projection — REQ-6 limits SQLite to what the client actually renders.

### `Tender` — 114 field/relation lines; the desktop needs a fraction

The model is large (25+ AI-enrichment, quality, and pipeline-internal fields). Caching it
whole would duplicate ingestion state the desktop has no business holding.

| Purpose | Fields |
|---------|--------|
| Identity | `id`, `tender_id` (external), `ocid` (OCDS), `referenceNumber` |
| Display | `title`, `aiTitleEnriched`, `description`, `aiSummary`, `type` |
| Deadline / filtering | `closingDate`, `status`, `publicationType`, `province`, `locality`, `delivery` |
| Buyer | `sourceOrganization`, `sourceOrganizationId`, `sourceOrganizationNormalized` |
| Evaluation | `estimatedValue`, `requirements` (Json), `eligibilityCriteria` (Json), `bbbeeRequirements` (Json), `validityPeriod` |
| Briefing | `briefingSession`, `briefingCompulsory`, `briefingVenue` |
| Amendments | `parentTenderId`, `amendmentNumber`, `cancellationReason`, `publicationDate` |
| Provenance (INT-8) | `apiSource`, `sourceUrl`, `aiConfidence`, `classificationConfidence`, `classificationMethod`, `provinceSource` |
| Sync | `updatedAt`, `lastSyncAt` |

**Deliberately excluded**: `parsedData`, `processingStatus`, `aiProcessingError`,
`qualityScore`, `validationErrors`, `cacheHit`, `processingTime`, `manualReview`,
`reviewNotes`, `isDuplicate`/`duplicateOf`. These are ingestion-pipeline internals; surfacing
them would invite the desktop to reason about parent processing state it cannot affect.

`requirements`, `eligibilityCriteria`, and `bbbeeRequirements` are **`Json?` with no schema in
the model**. Their runtime shape is `UNCONFIRMED` at this task and must be pinned from route
code or tests in TASK-1.4 before any Zod schema is written against them. The desktop must not
guess a shape for a `Json` column.

### `TenderDocument` — three-tier storage, and the INT-4 boundary

| Purpose | Fields |
|---------|--------|
| Identity | `id`, `tenderId`, `fileName`, `documentCategory`, `priority` |
| File metadata | `fileSize`, `mimeType`, `r2FileSize` |
| **Storage resolution** | `r2StorageUrl`, `r2StorageKey`, `r2UploadedAt`, `fileUrl`, `downloadUrl` |
| State | `cacheStatus`, `processingStatus`, `processedAt`, `processingError` |
| Extracted content | `extractedText`, `extractedTextLength`, `extractionMethod`, `extractionConfidence` |
| AI | `aiSummary`, `aiKeyPoints`, `aiAnalysis` |
| Sync | `updatedAt`, `lastAccessedAt`, `downloadCount` |

The in-model comments document a deliberate fallback chain:

- `r2StorageUrl` — "Cloudflare R2 URL (**preferred - most reliable**)"
- `fileUrl` — "Alternative storage URL (fallback)"
- `downloadUrl` — "**Original government URL** (final fallback, **may expire**)"

**`downloadUrl` is a government source URL, and INT-4 forbids the desktop from using it.**
The desktop must never read `downloadUrl` and fetch it — that is exactly the
"reimplement government downloading" the constraint prohibits, and it would bypass the
Worker/R2/D1 architecture. Document access goes through the parent's download-url endpoint,
which resolves the chain server-side. The field is inventoried so that its presence in an API
response is not mistaken for permission to use it; the route-level contract is TASK-1.4's and
the flow mapping is TASK-1.5's.

`extractedText` can hold an entire tender document. REQ-8 forbids logging document content,
and REQ-6 limits SQLite to bounded cache. Caching `extractedText` locally requires the
encrypted-payload path (`sensitive` flag, TASK-0.5) and an explicit size bound — it is not an
ordinary cache field.

### `Application` — the offline-mutation surface

| Purpose | Fields |
|---------|--------|
| Identity | `id`, `companyId`, `userId`, `tenderId` |
| Workflow | `status`, `currentStep`, `assistanceStage`, `progressPercentage`, `readinessScore` |
| Structured state | `checklistState` (Json), `documentState` (Json), `matchFactors` (Json), `applicationExtraInfo` (Json) |
| **AI-generated content** | `generatedCoverLetter`, `generatedCapability`, `generatedMethodology`, `generatedEmail`, `aiGeneratedContent` |
| Compliance | `complianceCheckResults`, `documentsUploaded` |
| Match | `matchScore`, `matchReasoning` |
| Submission | `submittedAt`, `submissionMethod`, `submissionReference`, `submissionNotes`, `proofOfSubmissionUrl` |
| Proposal | `finalProposalUrl`, `proposalGeneratedAt` |
| Sync | `updatedAt`, `isArchived`, `notes` |

The four `generated*` fields are `@db.Text` proposal content. design.md and REQ-7 require that
proposal conflicts **preserve both versions** and never silently overwrite — these are the
exact columns that rule protects, and `sync_conflicts` already flags `proposal`/`pricing` as
human-resolution-only (TASK-0.6). This inventory confirms the rule is pointed at real fields.

`checklistState` and `documentState` are unschematised `Json`. Field-level conflict policy for
a Json blob is not possible without knowing its shape: `UNCONFIRMED`, deferred to TASK-1.4.
Until then the desktop must treat them as whole-value conflicts.

**No pricing model appears in the required set.** `requirements.md` and design.md both
reference "pricing schedules" and proposal/pricing conflict rules, but no `Pricing`,
`PricingSchedule`, or returnables model is in the 14 entities. A scan of the canonical domain
files for pricing-owning models is deferred to TASK-1.6, which is the task that classifies
missing capability. Recorded here as an open gap rather than silently omitted.

### `Company`, `CompanyProfile`, `Document` — profile and vault

`Company`: `name`, `registrationNumber`, `taxNumber`, `bbbeeLevel`, `bbbeeCertificateUrl`,
`industryCodes`, `provincesOperating`, `companySize`, `annualTurnover`, `certifications`,
`capabilitiesDescription`, `contactEmail`, `contactPhone`, `website`, `openToJv`, `updatedAt`.

`CompanyProfile`: `companyType`, `profileDocument`, `profileText`, `equipmentAssets` (Json),
`operationalCapacity` (Json), `cidbGrading`, `professionalBodies` (Json), `completenessScore`,
`missingFields` (Json), `lastAssessedAt`, `updatedAt`.

`Document` (vault): `name`, `type`, `documentType`, `fileUrl`, `fileName`, `fileSize`,
`mimeType`, `expiryDate`, `isVerified`, `verified`, `status`, `uploadedAt`.

`Document` carries **both** `isVerified` and `verified`, mirroring `Notification`'s
`isRead`/`read` duplication. Which is authoritative is `UNCONFIRMED` — TASK-1.4. `expiryDate`
is indexed and drives the `DOCUMENT_EXPIRY` notification type, so it is a genuine desktop
need (expiring-certificate warnings).

`Company.industryCodes`, `provincesOperating`, and `certifications` are **`String`, not
`String[]` or `Json`** — required scalars holding what read like lists. Their encoding
(comma-separated? JSON-in-string?) is `UNCONFIRMED` from the schema alone and must be pinned in
TASK-1.4 before the desktop parses them. Guessing here would corrupt profile edits.

### `MatchingScore`, `Notification`, `Subscription` — read-mostly

`MatchingScore`: `score`, `baseScore`, `aiAdjustment`, `reasoning`, `factors` (Json),
`weights` (Json), `matchCategory`, `improvementAreas` (Json), `eligibilityStatus`,
`eligibilityReason`, `failedRequirements` (Json), `competitivePosition`, `successProbability`,
`isStale`, `calculatedAt`. Server-computed — the desktop **never** recalculates a score
locally, or it will disagree with the platform.

`Notification`: `type`, `title`, `message`, `actionUrl`, `isRead`, `priority`, `channel`,
`status`, `expiresAt`, `createdAt`.

`Subscription` — desktop projection is **`/api/subscription/status`'s response, not the
model**: `planName`, `tier`, `status`, `currentPeriodEnd`, `isTrial`, `trialEndsAt`,
`cancelAtPeriodEnd`, `applicationSlots`, `applicationCredits`. See §4.

### 3.1 Enum values the desktop must not invent

| Enum | Values |
|------|--------|
| `ApplicationStatus` | `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `ACCEPTED`, `REJECTED` |
| `TenderStatus` | `ACTIVE`, `CLOSED`, `CANCELLED`, `AWARDED` |
| `DocumentCacheStatus` | `NOT_CACHED`, `CACHED`, `CACHE_EXPIRED`, `CACHE_ERROR`, `PROCESSING` |
| `DocumentProcessingStatus` | `PENDING`, `DOWNLOADING`, `PROCESSING`, `COMPLETED`, `FAILED` |
| `CompanyType` | `SOLE_PROPRIETOR`, `CLOSE_CORPORATION`, `PTY_LTD`, `PUBLIC_COMPANY`, `NPO`, `COOPERATIVE`, `JOINT_VENTURE`, `OTHER` |
| `NotificationType` (18, from `prisma/base.prisma`) | `TENDER_MATCH`, `APPLICATION_STATUS`, `SUBSCRIPTION_RENEWAL`, `SYSTEM_ANNOUNCEMENT`, `SYSTEM_ALERT`, `TENDER_CLOSING_SOON`, `DOCUMENT_EXPIRY`, `MATCH_FOUND`, `NEAR_MISS`, `IMPROVEMENT_TIP`, `DIGEST_SENT`, `PAYMENT_PROCESSED`, `API_ERROR`, `TRANSACTIONAL`, `MARKETING`, `DIGEST`, `ALERT`, `SYSTEM` |

`ApplicationStatus` has **five** values, and none of them is a "won"/"lost" outcome —
`ACCEPTED`/`REJECTED` are the closest. The product brief's post-submission outcome-learning
phase will need richer states; that is a Phase-13 concern and a TASK-1.6 gap candidate, not a
Phase 2 blocker.

`NotificationType`'s 18 values are complete as listed, read from `prisma/base.prisma`. Note the
last four (`MARKETING`, `DIGEST`, `ALERT`, `SYSTEM`) overlap semantically with earlier values
(`DIGEST_SENT`, `SYSTEM_ALERT`, `SYSTEM_ANNOUNCEMENT`) — the desktop should not assume the set
is orthogonal, and should map several values onto one UI treatment rather than one icon each.

Even with a complete list, the desktop should treat unknown enum values as forward-compatible
(render generically) rather than failing validation — a closed Zod enum on a parent enum that
grows will reject valid server data on the day the parent adds a value.

---

## 4. Access sensitivity and local-storage rules

Sensitivity drives what may enter SQLite (REQ-6), what may be logged (REQ-8), and what
retention applies (PRIV-1).

| Field(s) | Entity | Sensitivity | Local storage rule |
|----------|--------|-------------|--------------------|
| `password` | `User` | **Critical** — bcrypt hash | **Never** received; see below |
| `emailVerificationToken`, `emailVerificationExpires` | `User` | **Critical** | Never received, never stored |
| `adminNotes` | `User` | High — internal | Never stored |
| `paystackEmailToken`, `paystackSubscriptionId`, `paypalSubscriptionId`, `paddleSubscriptionId`, `externalSubscriptionId` | `Subscription` | **Critical** — payment identifiers | **Never cache.** Use the `/status` projection |
| `taxNumber`, `registrationNumber` | `Company` | High — regulated identifiers | Cache encrypted only |
| `contactEmail`, `contactPhone` | `Company` | Moderate — business PII | Cache permitted |
| `contactEmail`, `ceo`, `founders`, `headquartersPhone`, `headquartersAddress` | `SupplierEnrichmentProfile` | **High — third-party personal data** | Cache encrypted, minimal retention |
| `generatedCoverLetter`, `generatedCapability`, `generatedMethodology`, `generatedEmail` | `Application` | **High — competitive content** | Encrypted (`sensitive`), never logged |
| `extractedText`, `aiAnalysis` | `TenderDocument` | High — document content | Encrypted + size-bounded, never logged |
| `profileText`, `profileDocument` | `CompanyProfile` | Moderate | Cache permitted |
| `submissionNotes`, `proofOfSubmissionUrl`, `submissionReference` | `Application` | High — submission evidence | Encrypted |

### `User.password` is on the model but never reaches the desktop

`prisma/user-domain.prisma` declares `password String` as a **required** field. The desktop
never receives it, because every auth surface returns the `toAuthUser` DTO
(`src/lib/auth.ts:73-92`), which projects exactly:

```
id, email, role, subscriptionTier, emailVerified,
firstName, lastName, name, company: { id, name }
```

`password`, `emailVerificationToken`, `adminNotes`, `suspensionReason`, and `deletedAt` are all
absent from it. Login (`login/route.ts:110`) and `/api/auth/me` (via `auth()`,
`src/lib/auth.ts:203`) both return this projection.

**Recorded as a positive finding, and as a constraint**: the desktop's `User` Zod schema must
be modelled on `toAuthUser`'s nine fields, **not** on the Prisma model. A schema generated
from the Prisma model would declare `password` required and either fail validation on every
real response or, worse, create a field the desktop believes it should populate.

This also satisfies the requirement that local SQLite never holds persistent auth tokens: the
only credential material in play is the JWT, which TASK-0.4's OS-keychain path owns and which
SQLite never sees.

---

## 5. Coverage against REQ-12's domains

REQ-12 requires mapping nine domains. This task establishes the model layer; endpoint and
flow mapping are TASK-1.4 and TASK-1.5.

| REQ-12 domain | Canonical model(s) | Model-layer status |
|---------------|--------------------|--------------------|
| Company profile / vault | `Company`, `CompanyProfile`, `Document`, `Director`, `KeyPersonnel`, `PreviousExperience` | **Covered** |
| Tender / matching | `Tender`, `MatchingScore` | **Covered** |
| Supplier / company intelligence | `SupplierEnrichmentProfile`, `TenderAwardSupplier` | **Covered**, fuzzy-joined (§2.1) |
| Buyer / organisation | `SourceOrganization`, `OCDSParty` | **Covered by name only** — not inventoried in detail here |
| Award | `TenderAward`, `TenderAwardSupplier`, `TenderContract` | **Covered** |
| Application workspace | `Application`, `ApplicationEvent`, `ApplicationDocumentVersion` | **Covered** |
| Document | `TenderDocument` (tender), `Document` (vault) | **Covered** — two distinct models |
| Subscription | `Subscription`, `BundleWallet` | **Covered** |
| Notification | `Notification`, `NotificationPreferences` | **Covered** |

Every supporting model named above was confirmed to exist as a `model` declaration in a
canonical domain file, not merely inferred from a relation field:

| Model | Canonical file |
|-------|----------------|
| `Director`, `KeyPersonnel`, `PreviousExperience` | `prisma/user-domain.prisma` |
| `SourceOrganization`, `OCDSParty` | `prisma/tender-domain.prisma` |
| `BundleWallet` | `prisma/bundle-domain.prisma` |
| `NotificationPreferences` | `prisma/notification-domain.prisma` |

Two honest limits on this coverage claim:

- **Buyer/organisation** models are confirmed present (`SourceOrganization` and `OCDSParty`,
  both in `tender-domain.prisma`, reached via `Tender.sourceOrganizationId` and
  `TenderAward.supplierPartyId`) but were **not read field-by-field**. Marked partial rather
  than claimed complete; TASK-1.5 needs their field detail to map buyer intelligence.
- **Pricing / returnables has no identified model** (§3). Open gap for TASK-1.6.

Likewise `Director`, `KeyPersonnel`, `PreviousExperience`, `BundleWallet` and
`NotificationPreferences` are confirmed to exist but their field sets were not inventoried —
they are supporting models for domains whose primary entities are covered above.

---

## 6. Confirmed gaps at the model layer

Carried to TASK-1.6 for classification (client-only / enhance / new endpoint / additive model
/ deferred / rejected duplication). Recorded here with evidence, not classified here.

| # | Gap | Evidence | Severity |
|---|-----|----------|----------|
| M-1 | No optimistic-concurrency column on any model; `Application` offers only `updatedAt` | §2.2 field scan | **High** — REQ-7 conflict detection |
| M-2 | `Notification.isRead` is mutable but the model has no `updatedAt`, so read-state changes are undetectable | §2.2 | Medium |
| M-3 | `MatchingScore` has neither `createdAt` nor `updatedAt`; cache policy must special-case `calculatedAt`/`isStale` | §2.2 | Medium |
| M-4 | Duplicate boolean pairs — `Notification.isRead`/`read`, `Document.isVerified`/`verified` — with no schema-level indication of which is authoritative | §2.2, §3 | Medium |
| M-5 | `Company.industryCodes` / `provincesOperating` / `certifications` are `String` holding list-like data with unspecified encoding | §3 | Medium — corrupts profile writes if guessed |
| M-6 | Unschematised `Json` columns on the desktop's critical path (`Tender.requirements`, `eligibilityCriteria`, `bbbeeRequirements`; `Application.checklistState`, `documentState`) | §3 | Medium — blocks Zod schemas |
| M-7 | No pricing / returnables model identified despite proposal-and-pricing conflict rules in design.md | §3 | Medium — Phase 2+ scope question |
| M-8 | `SupplierEnrichmentProfile` joins by non-unique `normalizedName` with no FK; supplier identity is fuzzy | §2.1 | Medium — INT-8 provenance |
| M-9 | `ApplicationStatus` has no won/lost outcome state for post-submission learning | §3.1 | Low — later phase |
| M-10 | Parent submodule gitlink for the desktop is stale by the whole Phase 0 implementation | `parent-baseline.md` §4 | Low — parent hygiene |

None of M-1…M-10 is a desktop implementation defect. M-1, M-2, M-4, M-5, M-6 and M-7 are
questions the desktop cannot answer alone; M-5 and M-6 are answerable from route code in
TASK-1.4 without any parent change.

---

## 7. Verification

TASK-1.2's verify condition: *all required desktop entities map to a canonical model, local
projection, confirmed gap, or explicit deferred status with path evidence.*

| Requirement | Result |
|-------------|--------|
| All 14 `requirements.md` entities located in a canonical domain file | **yes** — §2, one file each, no duplicates |
| Path evidence for every entity | **yes** — `prisma/*-domain.prisma` cited per row |
| Domain files treated as canonical, backups as non-authoritative | **yes** — §1, with staleness evidenced, and no backup cited anywhere |
| Domain-vs-generated drift checked rather than assumed | **yes** — §1, 193/193, zero drift on required entities |
| Relationships and ownership recorded | **yes** — §2, §2.1 |
| Provenance fields identified (INT-8) | **yes** — §3 `Tender` provenance row, `SupplierEnrichmentProfile.sourceUrls`/`confidenceScore` |
| Access sensitivity recorded | **yes** — §4 |
| Local-projection boundary stated | **yes** — §3 exclusions, §4 storage rules |
| Confirmed gaps recorded with evidence | **yes** — §6, M-1…M-10 |
| Unknowns labelled rather than inferred | **yes** — `UNCONFIRMED` on Json shapes (M-6), list encodings (M-5), duplicate-boolean authority (M-4); buyer/supporting-model field detail marked partial in §5 |
| Canonical source set enumerated completely | **yes** — and corrected: `base.prisma` belongs to it (§1), caught by an enum the domain files did not define |
| No parent file modified | **yes** — reads only |

**TASK-1.2 is complete**, with the deferrals above named rather than glossed: they are
route-level questions that TASK-1.4 is the correct task to answer, not gaps in this inventory.
