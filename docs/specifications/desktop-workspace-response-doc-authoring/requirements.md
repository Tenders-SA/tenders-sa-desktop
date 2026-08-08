# Desktop Workspace — Response Document Authoring — Requirements (Slice 4)

## Problem

Slice 3 delivered the read-only Response Blueprint panel: it tells the user
*what* to produce but offers no way to produce it. The parent already has the
mutation routes (`PUT /assist/response-doc`, `POST /assist/generate-response-doc`),
the blueprint GET already returns the per-key generation status
(`responseDocStatus`) and saved content (`responseDocs`), and the panel already
renders "Saved / Generating… / Failed" chips. What is missing is the desktop
side of authoring: a Generate action per document, an editor to refine saved
content, and an honest presentation of the two new failure classes the
mutations introduce — **402 subscription required** and **409 generation
preconditions not met**.

Today a 402 is misdescribed. `ApiErrorKind` has no `payment-required` kind, so
`kindForStatus(402)` falls through to `"validation"`, and
`describeApiError` renders it as *"Add your company profile to see the
response blueprint."* — actively wrong for a user who must upgrade instead.
This slice fixes that cross-cutting misdescription as part of shipping the
mutations.

## Live-verified parent contract (2026-08-08, read from parent route source)

### PUT /api/v1/applications/[applicationId]/assist/response-doc

```jsonc
// Request body
{ "key": "cover_letter", "content": "<edited markdown>" }
// 200 response
{ "ok": true, "key": "cover_letter" }
```

- Saves an edited response document. Base docs (`cover_letter`, `capability`,
  `methodology`, `email`) also mirror to the legacy `generated_*` columns —
  transparent to the desktop, which only reads back `__responseDocs` via the
  blueprint GET.
- Errors: `401` | `400 {error:'Company profile required'}` | `400 {error:'key
  and content are required'}` | `403` | `404 {error:'Application not found'}`
  | `500`. **No subscription gate** — editing is free.
- Owner-scoped (`companyId` match); additive; synchronous (no 202).

### POST /api/v1/applications/[applicationId]/assist/generate-response-doc

```jsonc
// Request body
{ "key": "cover_letter", "prompt": "<optional extra instructions>" }
// 202 response (immediate; generation runs asynchronously server-side)
{ "key": "cover_letter", "title": "Cover Letter", "status": "generating" }
```

- Generation is **gated on an active subscription** (admin-exempt server-side):
  - `402 {error:'Subscription required', code:'SUBSCRIPTION_REQUIRED',
    message:'AI document generation requires an active subscription',
    upgradeUrl:'/pricing'}` — any active/trial subscription satisfies it.
- Gated on **precondition completeness** (only hard gate: required additional
  information answered; see `generation-preconditions.ts`):
  - `409 {error:'Generation preconditions not met',
    code:'PRECONDITIONS_NOT_MET', blockedReason:'Complete before generating:
    N required information field(s).', preconditions:{...}}`.
- `400 {error:'A response document key is required'}` (missing key) |
  `400 {error:'Unknown response document: <key>', code:'UNKNOWN_RESPONSE_DOC'}`.
- `401` | `400 {error:'Company profile required'}` | `403` | `404` | `500`.
- **Idempotent**: a second POST while a fresh generation is in flight returns
  the same `202 {status:'generating'}` without starting a second AI call.
- The result lands in `applicationExtraInfo.__responseDocStatus[key]`
  (`state: 'ready' | 'failed'`, plus `isFallback`, `error`,
  `unresolvedPlaceholders`) and `__responseDocs[key]` — **both already
  surfaced by the blueprint GET the desktop reads**. No new read contract.

### Explicitly NOT in this slice (parent routes exist, desktop takes no action)

- `POST /assist/enrich-blueprint` — "Deep-analyse for my application", Pro-tier
  (Professional/Enterprise) 402-gated, AI inference cost.
- `refine`, briefing pack/export, submission recording, board screen.

## Functional requirements

### R-A-1 — Generate a response document
For each response document with no saved content and no in-flight generation,
the panel offers a **Generate** action (`POST generate-response-doc`). The
202 → the row shows the existing "Generating…" chip and the panel starts a
**bounded follow-up refresh** (see R-A-3). The parent's 202-idempotency means a
re-press cannot double-bill an AI call.

### R-A-2 — Edit and save a response document
For each response document with saved content, the panel offers an **Edit**
action opening an inline editor (plain `<textarea>`). **Save** → `PUT
response-doc`; success → row shows "Saved" immediately (local overlay) and the
editor closes. **Cancel** discards the draft. Unsaved edits are never
auto-submitted (R-W-7: no mutation without an explicit human press).

### R-A-3 — Bounded follow-up refresh, not polling
After a successful 202 the panel re-fetches the blueprint on a short interval
(4 s) up to 15 ticks (≈60 s), stopping as soon as no response-document status
is `generating` (the fetch is a plain GET — the default retry policy applies).
The refresh is **local to the panel and invisible** (no loading flash: it
fetches directly and merges a status overlay, it does not `reload()` the
panel's `AsyncSection`). It tears down on unmount. Outside an in-flight
generation the panel never polls — Slice 3's "no timers" rule holds
(R-B-2 remains true for steady state).

### R-A-4 — Entitlement honesty (402)
New `payment-required` `ApiErrorKind` (the only 402 the desktop's current
routes can produce). `describeApiError` renders it with fixed copy that says
to upgrade, non-retryable. The Generate flow catches `SUBSCRIPTION_REQUIRED`
and shows the upgrade message inline on the row. No web navigation, no
server-string passthrough (docblock `describe-error.ts:10-14`).

### R-A-5 — Precondition honesty (409)
`PRECONDITIONS_NOT_MET` (the only generation blocker: unfilled required
additional information — `blockingIssues`/`missingMandatoryDocs` are advisory
and never gate) renders the fixed copy *"Complete the required additional
information before generating."* — keyed off `ApiError.code`, never off the
parent's `blockedReason` string. Retry is not offered (it would fail again);
the Additional information panel is the fix path.

### R-A-6 — Mutation transport rules
Both mutations use `policy: { retry: "never" }` (R-W-7, mirroring
`saveAdditionalInfo`): the transport must not auto-retry a body-carrying
mutation, and a 409/402 must surface, not silently retry.

## Non-functional

- Same transport/error/redaction rules as the rest of the desktop (REQ-5,
  REQ-8). Routes under `/api/v1/applications/[id]/assist/` — already in
  capability scope.
- No new parent routes, no schema changes, no parallel pipeline. The Generate
  action spends real AI inference — but only on an explicit human press, and
  never twice for one key (parent 202-idempotency + disabled button).
- Error copy is component-owned; `ApiError.message`/`blockedReason` are never
  shown verbatim (describe-error docblock).

## Out of scope (later slices)

Enrichment (`POST enrich-blueprint`, Pro-gated), refine, briefing pack/export,
submission recording, board screen, "regenerate with custom prompt".

## Success criteria

1. A DRAFT workspace shows a Generate action per unsaved response document;
   pressing it yields "Generating…" and, within the bounded window, the
   document flips to "Saved" with the generated content — without a panel
   loading flash.
2. Editing + Save persists content ("Saved" chip), and the saved text is
   served back by a later GET.
3. A forced 402 on Generate shows the upgrade copy; a forced 409 shows the
   preconditions copy; neither reads as "Add your company profile".
4. `vitest`, `tsc --noEmit`, `eslint`, `prettier --check` pass.
