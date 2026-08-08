# Desktop Workspace — Deep-Analyse Enrichment — Requirements (Slice 5)

## Problem

Slice 3 showed the provenance ("Standard plan" vs "AI-tailored") and Slice 4
added document authoring, but the desktop still cannot *earn* the AI-tailored
plan: the parent's "Deep-analyse for my application" action
(`POST /assist/enrich-blueprint`) has no desktop surface. The panel can tell
the user the plan is standard but offers no way to upgrade it.

The route was read from parent source (2026-08-08): it runs an
application-focused AI pass over the tender analysis + extracted document
text, merges the tender-specific extras over the deterministic blueprint,
caches the enrichment in `applicationExtraInfo.__blueprintEnrichment`, and
returns the merged blueprint. The blueprint GET already re-merges that cache
and reports `enriched: true` — so after a successful POST, the desktop's
existing read path reflects the enrichment with no new read contract.

## Live-verified parent contract (2026-08-08, read from parent route source)

### POST /api/v1/applications/[applicationId]/assist/enrich-blueprint

```jsonc
// No request body.
// 200 — enrichment ran and was cached:
{ "blueprint": { /* same blueprint shape as the GET */ },
  "enriched": true }
// 200 — AI pass did not run; deterministic blueprint returned unchanged:
{ "blueprint": { /* deterministic */ },
  "enriched": false,
  "reason": "ai_unavailable" | "no_analysis" | "analysis_triggered",
  "analysisStatus": { ... } | undefined }   // analysisStatus only on analysis_triggered
// 402 — Professional/Enterprise tier required (admins exempt):
{ "error": "Pro plan required",
  "message": "On-demand tender analysis for your application is a Professional feature.",
  "upgradeUrl": "/pricing" }                // NO machine-readable code
// Errors: 401 | 400 {error:'Company profile required'} | 403 | 404 | 500.
```

- **No 409**: enrichment has no precondition gate (unlike generation). No
  request body; the only human input is the press itself.
- The AI call runs **synchronously** in the request; a slow pass can 500, and
  the route never blocks — on failure it returns `enriched: false` with
  `reason: "ai_unavailable"` (or triggers the document-analysis pipeline when
  there is no analysis yet: `analysis_triggered`, with `analysisStatus`).
- The blueprint GET merges the cached enrichment on every read
  (`response-blueprint/route.ts:51` `mergeCachedBlueprintEnrichment`,
  `enriched: !!extra?.__blueprintEnrichment?.data`), so a reload after a
  successful POST shows the enriched sections and flips provenance to
  "AI-tailored" automatically.
- Caching the enrichment is best-effort (a pre-migration column write can
  fail); the POST still returns the merged blueprint.

### Explicitly NOT in this slice

- `POST /assist/refine` — prompt-based single-document rewriting; synchronous
  AI; writes only the legacy `generated_*` columns; base doc keys only.
- `POST /assist/briefing-pack?format=pdf|docx` — returns a binary attachment;
  needs desktop download/save handling.
- `POST /assist/workspace-generate` — delegates to the classic synchronous
  multi-document generation flow.
- Submission recording, board screen, agent/chat.

## Functional requirements

### R-E-1 — Deep-analyse action
`enrichBlueprint` reads the POST route; the Response Blueprint panel offers a
**Deep-analyse** button (panel header, beside the provenance chip) whenever a
blueprint is rendered. Pressing it is the only human input (R-W-7); the
button shows a working state ("Analysing…") and is disabled while in flight —
no double AI pass.

### R-E-2 — Adopt the enriched plan
On `enriched: true` the panel reloads via its own `AsyncSection` reload (the
blueprint GET re-merges the cache and reports `enriched: true`), so the
sections update and provenance flips to "AI-tailored" from the single source
of truth — no parallel rendering path.

### R-E-3 — Pro entitlement honesty (402)
The enrich 402 carries **no machine code**, so the copy is keyed off the
action, never off the server string: *"Deep-analyse needs the Professional
plan."* — non-retryable, `role="alert"`, component-owned (describe-error
docblock). No web navigation.

### R-E-4 — Non-fatal outcomes
`enriched: false` is not an error — the deterministic plan still renders.
The `reason` is shown as honest, actionable copy:
- `analysis_triggered` → *"The tender is still being analysed — try
  deep-analyse again shortly."*
- `no_analysis` → *"There's no tender analysis to deep-analyse yet."*
- `ai_unavailable` → *"AI analysis is unavailable right now — the standard
  plan is shown."*
- absent/unknown → the generic failure copy via `describeApiError`.
`analysisStatus` is never rendered (server-internal shape).

### R-E-5 — Mutation transport rules
`policy: { retry: "never" }` (R-W-7): the transport must not auto-retry a
body-free POST that starts an AI pass. A 5xx surfaces as the standard server
copy ("Could not deep-analyse right now."), retryable by the user's own press.

## Non-functional

- Same transport/error/redaction rules as the rest of the desktop (REQ-5,
  REQ-8). Route under `/api/v1/applications/[id]/assist/` — already in
  capability scope.
- No new parent routes, no schema changes, no parallel pipeline. AI inference
  runs only on an explicit human press.
- Error copy is component-owned; `ApiError.message` and the parent's
  `error`/`message` strings are never shown verbatim (describe-error docblock).

## Out of scope (later slices)

Refine (prompt rewriting), briefing pack/export (binary download), submission
recording, board screen, agent/chat, workspace-generate.

## Success criteria

1. A DRAFT workspace with an analysis shows "Deep-analyse" on the blueprint
   panel; pressing it POSTs once, shows "Analysing…", and on success reloads
   to an "AI-tailored" plan with the tender-specific sections merged.
2. A forced 402 shows the Professional-plan copy; `analysis_triggered` and
   `ai_unavailable` show their honest messages with the standard plan intact.
3. `vitest`, `tsc --noEmit`, `eslint`, `prettier --check` pass.
