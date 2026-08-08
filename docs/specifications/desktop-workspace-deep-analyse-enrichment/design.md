# Desktop Workspace — Deep-Analyse Enrichment — Design (Slice 5)

Extends the Slice 3/4 blueprint surface with one panel-level action.
Requirements R-E-1..R-E-5. No error-layer changes needed: the enrich 402 maps
to the existing `payment-required` kind (Slice 4), and the copy is keyed off
the action (R-E-3).

## Endpoint layer — extend `ApplicationsEndpoint` (no parallel client)

`src/services/api/endpoints/applications.ts`, after the
`saveResponseDocument` block:

- Schema (permissive, `.passthrough()`, reuses `blueprintSchema`):
  ```ts
  const enrichBlueprintResponseSchema = z
    .object({
      blueprint: blueprintSchema.nullable().optional(),
      enriched: z.boolean().optional(),
      reason: z.string().optional(),
      analysisStatus: z.unknown().optional(),
    })
    .passthrough();
  ```
- Type exported: `EnrichBlueprintResult`.
- Method:
  ```ts
  /** POST .../assist/enrich-blueprint — Pro-tier 402; retry:"never" (R-E-5). */
  async enrichBlueprint(id: string, signal?: AbortSignal): Promise<EnrichBlueprintResult>
  ```
  No body. `policy: { retry: "never" }`, mirroring the Slice 4 mutations.

## UI — ResponseBlueprintPanel gains the Deep-analyse action

No new files: the panel already carries the overlay/poll machinery; the action
lives in `BlueprintView`'s header `aside` (next to the provenance chip).

- **Button** (only inside the non-empty view — there is nothing to
  deep-analyse when the blueprint is null, R-E-1): "Deep-analyse" →
  working state "Analysing…" + disabled while in flight (no double press).
- **Success** (`enriched: true`): `state.reload()` — the AsyncSection's own
  reload. The blueprint GET re-merges the cache and reports `enriched: true`,
  so provenance flips to "AI-tailored" and the tender-specific sections appear
  from the single source of truth (R-E-2). A brief loading state is the honest
  cost of a mutation follow-up; there is no poll loop here.
- **402** (kind `payment-required`, no code on the route — keyed off the
  action): *"Deep-analyse needs the Professional plan."* (R-E-3).
- **`enriched: false`** (R-E-4): render the reason copy inline
  (`role="alert"`); the deterministic blueprint stays rendered:
  - `analysis_triggered` → "The tender is still being analysed — try
    deep-analyse again shortly."
  - `no_analysis` → "There's no tender analysis to deep-analyse yet."
  - `ai_unavailable` → "AI analysis is unavailable right now — the standard
    plan is shown."
  - unknown/absent reason → `describeApiError(error, "the deep-analyse")`
    copy.
- **Other errors**: `describeApiError` (server 5xx → "Could not deep-analyse
  right now.", retryable via the same button).

Implementation: a small `ActionState` (idle/working/error+message) exactly
like `ResponseBlueprintDocRow`'s; the alert renders under the header.

## Orchestrator wiring

`ApplicationWorkspace.tsx`: no structural change — the panel is already
mounted; the passed `endpoint` instance gains the method at T1.

## Tests

- `src/tests/module-endpoints.test.ts` — contract tests: parses
  `{blueprint, enriched:true}`; parses `enriched:false` with each reason and
  an absent `analysisStatus`; `blueprint` may be null; 402 → kind
  `payment-required`; 403/404 mapping; never retries (single call on a
  transient network failure).
- `src/tests/module-screens.test.tsx` — screen tests: button renders next to
  the provenance chip; press → POST once → "Analysing…" disabled → success
  reloads and shows "AI-tailored"; 402 shows the Professional-plan copy;
  `analysis_triggered` / `ai_unavailable` show their copy with the standard
  plan still rendered; a 500 shows the server copy.
- `src/tests/fixtures/api-clients.ts` — stub gains `enrichBlueprint`
  (`idle()`).
- `src/tests/endpoint-parity.test.ts` — route literal
  `` `.../assist/enrich-blueprint` `` pinned with the other workspace routes.
- `src/tests/capability-scope.test.ts` — no changes (route already under
  `/api/v1/applications/…/assist/`, in scope).

## Files touched

| File | Change |
|---|---|
| `src/services/api/endpoints/applications.ts` | +schema, +type, +`enrichBlueprint` |
| `src/features/applications/workspace/ResponseBlueprintPanel.tsx` | +Deep-analyse action + alert copy |
| `src/tests/module-endpoints.test.ts` | +contract tests |
| `src/tests/module-screens.test.tsx` | +screen tests |
| `src/tests/fixtures/api-clients.ts` | +stub method |
| `src/tests/endpoint-parity.test.ts` | +route literal |
