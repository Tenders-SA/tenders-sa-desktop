# Desktop Workspace — Response Blueprint — Requirements (Slice 3)

## Problem

The parent's "Response Blueprint" — the tender-driven plan of which response
documents to generate, which documents the user must have, and which
steps/milestones to follow — is the natural next panel for the desktop
workspace. Slice 1 and 2 delivered the cockpit, compliance gaps, research and
the additional-info Q&A; without the blueprint the desktop still cannot tell
the user *what to produce* for the bid.

The blueprint route was already live-probed for Slice 1 (2026-08-08, app
`cmsed6wb71ct5knmuidlfu7fw`): **200, blueprint + 12 required user documents**
("slice 3 input"). The route code is the reference for the exact shapes.

## Live-verified parent contract (2026-08-08)

### GET /api/v1/applications/[id]/assist/response-blueprint

```jsonc
{ "blueprint": {
    "tenderId": "t1",
    "industry": { "id": "i1", "name": "Construction" } | null,
    "requiredUserDocuments": [
      { "name": "Tax Clearance Certificate", "canonicalType": "tax-clearance",
        "source": "analysis" | "industry" | "compliance",
        "mandatory": true, "note": "…" | undefined } ],
    "responseDocuments": [
      { "key": "cover_letter", "title": "Cover Letter",
        "kind": "cover_letter", "brief": "…",
        "requiredBy": "…" | undefined, "mandatory": true } ],
    "steps": [
      { "key": "gather-returnables", "title": "Gather required documents…",
        "detail": "…", "dueDate": "ISO" | null,
        "category": "briefing" | "clarification" | "documents" | "compliance"
                 | "submission" | "prepare",
        "mandatory": true, "source": "analysis" | "timeline" | "industry" | "derived" } ],
    "submission": { "method": "…" | undefined, "address": "…" | undefined,
      "portalUrl": "…" | undefined, "deadline": "ISO" | null,
      "contact": "…" | undefined, "notes": "…" | undefined },
    "risks": [ "…" ],
    "confidence": "high" | "medium" | "low",
    "generatedBy": "deterministic" | "ai" },
  "hasAnalysis": boolean,
  "enriched": boolean,
  "responseDocs": { "<docKey>": "<saved content>" },
  "responseDocStatus": { "<docKey>": {
      "state": "generating" | "ready" | "failed",
      "startedAt": number, "updatedAt": number,
      "isFallback": boolean | undefined, "error": "…" | undefined,
      "unresolvedPlaceholders": [ "…" ] | undefined } } }
```

- `ResponseDocKind`: `cover_letter | capability | methodology | technical |
  quality | sheq | pricing | declaration | undertaking | acknowledgement |
  email | other`.
- `requiredUserDocuments` is the "12 documents" seen in the live probe;
  counts of `responseDocuments`/`steps` are tender-dependent and were not
  recorded in the probe — the desktop must render any count (R-B-5).
- `responseDocs` holds already-generated/edited content per doc key.
- `responseDocStatus` tracks long-running async AI generation per key
  (generation runs server-side; the client reads, never polls forever).
- Errors: 401 | 400 `{error:'Company profile required'}` | 403 | 404 | 500.

### Explicitly NOT in this slice (parent routes exist, desktop reads nothing more)

- `POST /assist/enrich-blueprint` — AI inference (real cost), 402 pro-gated.
- `PUT /assist/response-doc` — document editing.
- Generation triggers — AI inference (real cost).

These are Slice 4+ (mutations, cost and paywall handling need their own spec).

## Functional requirements

### R-B-1 — Load the blueprint live
`getResponseBlueprint` reads the GET route; the panel renders every section
the parent returns: response documents, required user documents, steps,
submission, risks, confidence.

### R-B-2 — Read-only panel
This slice renders the plan. No mutation control exists on the panel; the
web's enrich/edit/generate actions are Slice 4+ (they spend AI inference).

### R-B-3 — Honest document state
For each response document the panel reflects: saved content
(`responseDocs` has the key), generation in flight (`generating`), a failed
generation (with its `error`), a fallback (`isFallback`), or nothing yet.

### R-B-4 — Panel independence (R-W-5)
The panel owns its `useAsync` + `AsyncSection`; a blueprint route failure
degrades this panel only, exactly like the other workspace panels.

### R-B-5 — Contract tolerance (R-W-6)
Permissive schemas: `blueprint` may be absent/null; every section optional;
unknown `kind`/`category`/`source` values render as plain text; numbers and
strings validated by type only. Never crash on a shape the parent adds.

### R-B-6 — Provenance honesty
`confidence` and `generatedBy`/`enriched` are shown as the parent reports
them ("Standard plan" vs "AI-tailored"), never inferred.

## Non-functional

- Same transport/error/redaction rules as the rest of the desktop (REQ-5,
  REQ-8). Route under `/api/v1/` — already in capability scope.
- GET only → the endpoint is retryable with the standard policy; no `retry:
  "never"` anywhere in this slice.
- No new parent routes, no schema changes, no parallel pipeline, no AI cost.

## Out of scope (later slices)

Response-document generation + editing (PUT response-doc), enrichment
(POST enrich-blueprint, 402-gated), briefing pack/export, submission
recording, board screen.

## Success criteria

1. Opening a workspace renders the blueprint with the live shapes (probe app
   shows ≥12 required user documents), confidence + provenance shown.
2. A doc with saved content shows "Saved", a `generating` status shows
   "Generating…", a `failed` status shows its error — per key.
3. A forced GET failure degrades this panel only; a null/absent `blueprint`
   renders an honest empty state.
4. `vitest`, `tsc --noEmit`, `eslint`, `prettier --check` pass.
