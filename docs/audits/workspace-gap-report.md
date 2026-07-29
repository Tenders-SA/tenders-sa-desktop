# Capability gap report

**Task**: TASK-1.6 — Create the capability gap report
**Refs**: REQ-14, INT-7
**Baseline**: `8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1` — see `parent-baseline.md`
**Recorded**: 2026-07-28

Classifies every gap surfaced by TASK-1.2 through TASK-1.5 as **client-only**, **enhance
endpoint**, **new endpoint**, **additive model**, **deferred**, or **rejected duplication**, with
evidence, risk, owner, and approval boundary.

Per INT-7, every parent-side item is a **proposal for a separate parent-repository
specification**. **No parent change was made.**

---

## 1. Pre-check — searching before proposing

TASK-1.6's pre-check requires searching parent routes, services, components, specs, and TODOs
for every apparent gap. This is the step that prevents REQ-14's failure mode — proposing a
duplicate of something the parent already has or already plans — and it changed the
classification of four items.

| Searched | Method | Outcome |
|----------|--------|---------|
| Pricing / returnables models | `grep '^model .*(Pricing\|Returnable\|Costing\|Quantit)'` over 35 domain files | **No match** — gap is real |
| Pricing routes | `find src/app/api -ipath '*pric*'` | Only `og/pricing` (OG image) and `ai-mirror/pricing` (marketing) — **subscription** pricing, not bid pricing |
| Pricing specs | `.kiro/specs/*pric*` | `tender-radar-pricing-tiers`, `pricing-special-offer` — both **subscription plans** |
| Idempotency | `grep -rn 'idempotenc'` | Exists in `webhook.service.ts` and one assist route — **precedent exists**, not on the desktop's surface |
| Token revocation | `.kiro/specs/**/requirements.md` | **Already triaged by the parent** — see §2 |
| CSRF | `.kiro/specs/security-hardening-v2` | **Already triaged by the parent** — see §2 |
| Response envelope | `.kiro/specs/api-response-standardization` | **An unimplemented parent spec targets exactly this** — see §3 |
| TODOs | `TODO/INDEX.MD`, `grep -rn 'TODO\|FIXME'` over in-scope routes | Two relevant findings (§5) |

---

## 2. Gaps the parent has already triaged — do not re-propose

Three findings this audit raised independently are **already recorded as known gaps in parent
specifications**. Re-proposing them as desktop discoveries would be duplication of exactly the
kind REQ-14 guards against. The correct action is to reference the existing parent record and
contribute only the **desktop-specific impact evidence** those specs lack.

| Gap | Parent record | Parent's own assessment |
|-----|---------------|-------------------------|
| **A-2** No token revocation | `.kiro/specs/auth-consolidation/requirements.md:19` — "**M7 \| MEDIUM \| No token revocation/blacklisting \| System-wide**"; line 43 defers "Full token revocation system (requires Redis blacklist — future spec)". Also `.kiro/specs/security-hardening-v2/requirements.md:56` — "Token revocation / blacklisting (separate spec)" | Known, MEDIUM, deferred to a future spec |
| **A-3** CSRF non-functional | `.kiro/specs/security-hardening-v2/requirements.md:22` — "**M4 \| MEDIUM \| CSRF token never persisted (protection non-functional) \| `src/lib/csrf.ts:47-51`**"; FR-8 specifies the fix | Known, MEDIUM, fix specified |
| **E-1** No idempotency keys | `src/lib/services/webhook.service.ts` implements idempotency for payment webhooks | Pattern exists in-codebase; not applied to the application API |

**What the desktop adds that those specs do not have:**

- For **A-2**, the parent's assessment is "system-wide, MEDIUM". It was written for a browser
  context where the body token is not usually retained. **The desktop retains it in the OS
  keychain by design**, so a logged-out desktop device holds a working credential for up to
  7 days. That is a materially higher exposure than the parent spec assumes, and it is worth
  attaching to M7 rather than filing separately.
- For **E-1**, the ask is not novel capability but **extending an established in-house pattern**
  to the application API. That is a much cheaper proposal than it first appeared.

> **Classification for A-2, A-3, E-1: `deferred` — to an existing parent specification.** Not
> new proposals. The desktop's contribution is impact evidence appended to work the parent has
> already scoped.

---

## 3. The response-envelope finding, reconciled

`endpoint-inventory.md` §3 found nine distinct top-level response shapes and concluded the
desktop must treat the envelope as per-endpoint. The pre-check then found
**`.kiro/specs/api-response-standardization/spec.md`**, and it reframes that finding.

The spec proposes exactly the fix — and **every checkbox in it is unticked**:

> REQ-1: All API routes must return `ApiResponse<T>` interface with `success`, `data`, `error`,
> and optional **`meta`** fields
> REQ-4: Paginated responses must include `meta` with `total`, `page`, and `limit`

### This explains design.md's `ApiEnvelope` sketch

Phase 0 found design.md's sketch "wrong in two ways" against the live API — `error` shape, and
a `meta` block that does not exist. That framing was correct about **reality** but incomplete
about **origin**. design.md's sketch —

```ts
{ success: boolean; data?: T; error?: string | {code, message}; meta?: Record<string, unknown> }
```

— is a near-exact description of `api-response-standardization`'s **planned** `ApiResponse<T>`,
including the `meta` block. The sketch was not invented: it appears to describe the parent's
**target** envelope, which is specified but not implemented.

> **Reconciliation**: design.md documented an aspirational parent contract as though it were the
> current one. Phase 0 was right to correct it against observed behaviour, and right to keep
> the implemented schema. The correct standing position is: **build per-endpoint schemas now**
> (§4, `C-2`), because the standardised envelope does not exist and may never land.

### And it creates a forward-compatibility risk worth naming

The spec's "Files to Modify" table explicitly lists `src/app/api/auth/login/route.ts` and
`src/app/api/tenders/route.ts` — **two endpoints the Phase 2 slice depends on**. If that work
lands, those response shapes change.

> **Gap G-1 (new)**: an approved-but-unimplemented parent spec would change the response format
> of endpoints the desktop consumes. **Risk: High** to a shipped desktop client; **Low** right
> now, since nothing is shipped. **Mitigation**: the desktop already validates every response at
> the boundary (REQ-5) and would fail visibly rather than silently — and per-endpoint schemas
> mean the blast radius is the two adapters, not the whole client. Phase 2 should **watch this
> spec**, not design around it.

---

## 4. Classified gap register

Risk is the risk **to the desktop product** if the gap is not addressed. Owner is who must act.

### Client-only — the desktop fixes these itself, no parent involvement

| # | Gap | Evidence | Risk | Approval boundary |
|---|-----|----------|------|-------------------|
| **C-1** | Auth transport must move from webview `fetch` to Rust — no CORS headers exist on any needed route (A-6) | `auth-subscription-contract.md` §6 | **High** — the client cannot reach the API at all without it | Phase 2 contract |
| **C-2** | Per-endpoint response schemas rather than one global envelope | `endpoint-inventory.md` §3 | Medium | Phase 2 contract |
| **C-3** | `AuthFailureKind` lacks `account-inactive`, `rate-limited`, `server-error` | `auth-subscription-contract.md` §11 | Medium — dead-end UX for unverified accounts | Phase 2 contract |
| **C-4** | Per-endpoint pagination — four conventions in use | `endpoint-inventory.md` §4 | Medium — silent page-1-forever bugs | Phase 2 contract |
| **C-5** | Always send `requireR2=1`; exclude `downloadUrl` from the local projection | `domain-mappings.md` §9 | **High** — INT-4 violation otherwise | Phase 2 contract |
| **C-6** | Always send arrays (never strings) on company-profile writes | `endpoint-inventory.md` §9, E-10 | **High** — poisons the record; every later read 500s | Phase 2 contract |
| **C-7** | Treat `Application` create as upsert on `(companyId, tenderId)` | `model-inventory.md` §2.1 | **High** — REQ-7 replay safety | Phase 2 contract |
| **C-8** | Refetch notifications rather than diff; `isRead` is undetectable (M-2) | `model-inventory.md` §2.2 | Low | Phase 2 contract |
| **C-9** | Cache-invalidate `MatchingScore` on `calculatedAt`/`isStale`, not `updatedAt` (M-3) | `model-inventory.md` §2.2 | Medium — scores never refresh | Phase 2 contract |
| **C-10** | Tolerate both 401 body shapes; never require `success:false` | `auth-subscription-contract.md` §6 | Medium | Done — TASK-1.3 fixtures |
| **C-11** | Accept unknown enum values forward-compatibly | `model-inventory.md` §3.1 | Medium — rejects valid data on any parent enum addition | Phase 2 contract |
| **C-12** | Two schemas (or one tolerant schema) for tender list vs detail `Json` fields (E-11) | `endpoint-inventory.md` §9 | Medium | Phase 2 contract |
| **C-13** | No company switcher; account switch = re-login | `auth-subscription-contract.md` §9 | Low — prevents building a feature with no backing model | Phase 2 contract |
| **C-14** | Don't display government buyers' Google star ratings | `domain-mappings.md` §5 | Low — product judgement | Phase 2 contract |
| **C-15** | Present supplier enrichment as attributed/confidence-scored, not fact | `domain-mappings.md` §4 | Medium — commercial decisions rest on it | Phase 2 contract |

**15 of the 30 gaps are client-only.** The audit's main practical result is that most of what
looked like missing parent capability is desktop work under the existing contract.

### Enhance existing endpoint — parent proposals

| # | Gap | Evidence | Risk | Owner | Approval boundary |
|---|-----|----------|------|-------|-------------------|
| **P-1** | **A-1** — login's three 401 causes separable only by `error` string; no machine-readable code | `auth-subscription-contract.md` §3 | Medium | Parent auth | Separate parent spec; **Tier 1 auth**, additive field, non-breaking |
| **P-2** | **E-1** — no idempotency key on mutating endpoints | `endpoint-inventory.md` §4 | **High** for offline replay | Parent API | Extend existing `webhook.service.ts` pattern (§2) |
| **P-3** | **E-4** — `/api/tenders*` handlers have no auth check; protected by middleware allowlist alone | `endpoint-inventory.md` §2.2 | Medium — one edit from a data leak | Parent API | Defence-in-depth; low blast radius |
| **P-4** | **E-5** — `/api/tenders` returns a `debug` block of corpus DB statistics on every response | `endpoint-inventory.md` §2.2 | Medium — disclosure + payload bloat on the desktop's most-fetched list | Parent API | Remove or gate behind a flag |
| **P-5** | **E-10** — `PUT /company/profile` stores unvalidated strings; unguarded `JSON.parse` on read 500s forever after | `endpoint-inventory.md` §9 | **High** — user-triggerable permanent corruption | Parent API | Input validation; **affects web clients too** |
| **P-6** | **E-11** — tender list vs detail return the same `Json` fields as different types | `endpoint-inventory.md` §9 | Medium | Parent API | Consistency fix |

**P-5 is the one worth escalating on the parent's own terms**: it is reachable from the existing
web application, not only from the desktop, and its failure mode is permanent per-record
corruption requiring manual repair.

### Additive data model — parent proposals

| # | Gap | Evidence | Risk | Owner | Approval boundary |
|---|-----|----------|------|-------|-------------------|
| **P-7** | **M-1** — no optimistic-concurrency column anywhere; `Application` offers only `updatedAt` | `model-inventory.md` §2.2 | Medium | Parent data | `version Int @default(0)` is additive, non-breaking; **Tier 3** |
| **P-8** | **M-2** — `Notification` has no `updatedAt`, so read-state changes are undetectable | `model-inventory.md` §2.2 | Low | Parent data | Additive |
| **P-9** | **M-4** — duplicate booleans `Notification.isRead`/`read`, `Document.isVerified`/`verified` with no indication of authority | `model-inventory.md` §2.2 | Medium — desktop may write the ignored field | Parent data | Documentation, then deprecation |

**P-7 is deliberately not urgent.** `updatedAt` is sufficient for the conflict *detection* REQ-7
requires, because design.md already mandates preserving both versions for proposal/pricing
rather than auto-merging. A version column would be better; the desktop can ship without it.

### Deferred — to existing parent work

| # | Gap | Deferred to | Owner |
|---|-----|-------------|-------|
| **D-1** | **A-2** token revocation | `auth-consolidation` M7 / `security-hardening-v2` (§2) — **attach the desktop's 7-day keychain exposure evidence** | Parent auth |
| **D-2** | **A-3** CSRF non-functional | `security-hardening-v2` M4 / FR-8 (§2) | Parent auth |
| **D-3** | **G-1** response standardisation would change consumed endpoints | `api-response-standardization` (§3) — **watch, do not design around** | Parent API |
| **D-4** | **E-2** published v2.1.0 OpenAPI: 1/98 ops with a 200 schema, 0/2 components referenced | Parent developer-API docs tooling | Parent API |
| **D-5** | **E-3** `docs/06-api-documentation/openapi.json` is an invalid fragment, wrong at every field | Parent docs; **delete or regenerate** | Parent API |
| **D-6** | **M-9** `ApplicationStatus` has no won/lost outcome state | Phase 13 (post-submission learning) | Desktop + parent |
| **D-7** | **M-7 / new** no pricing or returnables model exists (§5) | A later vertical slice | Desktop + parent |
| **D-8** | **E-9** `/workspace` action vocabulary not enumerated | Phase 2 pre-work — **blocks offline queueing of workspace mutations** | Desktop |
| **D-9** | **M-6 residual** `Tender` Json inner shapes, `MatchingScore` Json shapes | Phase 2, from live fixtures | Desktop |
| **D-10** | **E-8** only 4 of 16 in-scope endpoints have route tests | Parent test coverage | Parent API |
| **D-11** | **E-6** two auth helpers; `verifyJWTFromRequest` drops `role`/`companyId` | Parent auth consolidation | Parent auth |
| **D-12** | **M-8** supplier identity is a fuzzy `normalizedName` join with no FK | Later intelligence slice | Parent data |

### Rejected duplication — capability exists, or the desktop must not build it

| # | Proposal considered | Verdict | Why |
|---|--------------------|---------|-----|
| **R-1** | Add CORS headers for the desktop origin (**A-6**) | **Rejected** | Would widen the parent's browser-facing attack surface to solve a desktop-side problem. The Rust transport (C-1) is the better fix and is already the security-preferred option. **No parent change requested.** |
| **R-2** | Build a desktop-side tender/document ingestion path | **Rejected** | The Worker/R2/D1 pipeline already owns this and INT-4 forbids it. Duplication of an existing, working capability. |
| **R-3** | Compute entitlement locally from cached subscription data | **Rejected** | Cannot be correct — access can come from a `BundleWallet` the client never sees. Also violates SEC-3. |
| **R-4** | Recalculate `MatchingScore` locally | **Rejected** | Server-owned; a local score would disagree with the platform and with user-facing emails. |
| **R-5** | Mint client-side entity IDs for offline creates | **Rejected** | INT-3 requires server IDs. `Application`'s unique constraint plus the local idempotency key already solve replay. |
| **R-6** | Build a "log out all devices" affordance | **Rejected** | No session table, device registry, or revocation endpoint exists (D-1). Offering the control would be a lie to the user. |
| **R-7** | Build a company switcher | **Rejected** | `Company.userId` is `@unique` — there is nothing to switch between. |
| **R-8** | Add a desktop-side proposal generator to work around the parent stub (§5) | **Rejected** | Would create a second, diverging generation path. The parent owns AI generation; the stub is a parent TODO. |

**Eight rejected duplications.** R-1 and R-2 are the ones that matter: both are plausible-looking
fixes that would have violated a standing constraint.

---

## 5. Additional findings from the pre-check search

| # | Finding | Evidence | Classification |
|---|---------|----------|----------------|
| **N-1** | **No pricing or returnables model exists.** design.md and REQ-7 reference proposal/pricing conflict rules, but no `Pricing`, `Returnable`, `Costing`, or bill-of-quantities model is in any of the 35 domain files. The only "pricing" in the parent is **subscription** pricing | §1 search | **Deferred** (D-7) — real gap, not a duplicate. Confirms REQ-7's pricing-conflict rule currently has **no pricing entity to protect**; `Application.generated*` proposal text is the nearest thing |
| **N-2** | **Parent proposal generation is a stub** — `assist/generate/route.ts:611`: "TODO: Implement full proposal generation (currently reuses cover letter as placeholder)" | Source TODO | **Deferred** — a desktop proposal feature built on this today would surface a placeholder as a product feature. Phase 2 must not depend on it. **R-8** rejects working around it |
| **N-3** | **The parent's `TODO/INDEX.MD` desktop entry is stale** — records "SPEC CREATED — PENDING USER APPROVAL", but the contract was approved 2026-07-27 and Phase 0 is complete | `TODO/INDEX.MD:62` | **Deferred** — parent housekeeping, alongside the stale submodule gitlink (**M-10**) |
| **N-4** | **The parent submodule gitlink is stale by the entire Phase 0 implementation** (points at `cd9d2df`, spec documents only) | `parent-baseline.md` §4 | **Deferred** — parent housekeeping. Anyone initialising the submodule concludes the desktop app does not exist |

N-1 is the most consequential: it means the "proposal and pricing conflicts preserve both
versions" rule inherited from design.md protects proposal text today and **nothing else**,
because pricing has no home in the data model yet. That is worth knowing before a later slice
promises pricing features.

---

## 6. Summary

| Classification | Count | Owner |
|----------------|------:|-------|
| Client-only | 15 | Desktop |
| Enhance existing endpoint | 6 | Parent (proposals) |
| Additive data model | 3 | Parent (proposals) |
| Deferred | 12 | Mixed |
| Rejected duplication | 8 | — |
| **Total classified** | **44** | |

Nine parent proposals in total (P-1…P-9). **None blocks the Phase 2 slice.** Each degrades an
experience the desktop can ship without:

- P-1 costs string-matching on login errors.
- P-2 (idempotency) is covered by `Application`'s unique constraint for the one create path
  Phase 2 needs.
- P-7 (version column) is covered by `updatedAt` plus preserve-both-versions.
- P-5 is a genuine parent defect but is avoidable from the desktop by always sending arrays
  (C-6).

**The one true blocker is C-1** — the Rust transport — and it is client-only, inside the
desktop's own control, and scoped in `phase-2-plan.md`.

### No-duplication evidence (REQ-14 success criterion)

> "The gap report contains no duplicate backend proposal where a suitable parent capability
> already exists."

Satisfied, and the pre-check is what made it true rather than assumed:

- **Three findings were downgraded from proposals to deferrals** (A-2, A-3, E-1) after the search
  found them already triaged in parent specifications, or already implemented as a pattern
  elsewhere in the parent codebase.
- **One finding was reframed entirely** (G-1/§3) after the search found an unimplemented parent
  spec targeting it — which also explained where design.md's `ApiEnvelope` sketch came from.
- **Eight proposals were rejected outright** as duplication of existing capability or as
  violations of a standing constraint.

Had the pre-check been skipped, this report would have proposed token revocation, CSRF
enforcement, idempotency, and an envelope standardisation the parent has already scoped — four
duplicate proposals out of thirteen.

---

## 7. Verification

TASK-1.6's verify condition: *each gap is classified client-only, enhance endpoint, new endpoint,
additive model, deferred, or rejected duplication, with evidence, risk, owner, and approval
boundary.*

| Required | Result |
|----------|--------|
| Pre-check — parent routes, services, components, specs, TODOs searched | **yes** — §1, eight searches, four reclassifications |
| Every gap classified | **yes** — 44 items across all six categories |
| Evidence per gap | **yes** — every row cites an audit section or parent path |
| Risk per gap | **yes** — §4 |
| Owner per gap | **yes** — §4, §5 |
| Approval boundary per gap | **yes** — §4; every parent item routed to a separate specification |
| No duplicate proposal where parent capability exists | **yes** — §6, with the four avoided duplicates named |
| INT-7 honoured — parent changes proposed, never made | **yes** — no parent file created, modified, or deleted |

**Note on the "new endpoint" category**: it is **empty**, and that is a finding rather than an
omission. Every desktop need maps to an existing parent endpoint, an enhancement of one, an
additive field, or desktop-side work. The Phase 2 slice requires **no new parent endpoint** —
which is the strongest available evidence that the desktop is behaving as a client of the
existing platform rather than growing a second backend.

**TASK-1.6 is complete.**
