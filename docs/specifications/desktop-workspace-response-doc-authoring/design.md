# Desktop Workspace — Response Document Authoring — Design (Slice 4)

Extends the Slice 3 blueprint surface: same panel, same endpoint file, two new
mutation methods, one cross-cutting error-kind addition. Requirements
R-A-1..R-A-6.

## Error layer — the 402 fix (cross-cutting, small)

`src/services/api/errors.ts`:

- `ApiErrorKind` union gains `| "payment-required" // 402 -- authenticated but not entitled to a paid feature`.
- `kindForStatus`: `if (status === 402) return "payment-required";` before the
  `>= 500` check.

`src/services/api/describe-error.ts`:

- New case:
  ```ts
  case "payment-required":
    return {
      message: `Generating ${subject} needs a paid plan.`,
      kind: error.kind,
      retryable: false,
    };
  ```
  (R-A-4 — fixed copy, non-retryable; `ApiError.message` never shown.)
- Top docblock gains one line noting 402 → `payment-required`.

No `describe-error.test.ts` exists; the new copy is covered by screen tests.

## Endpoint layer — extend `ApplicationsEndpoint` (no parallel client)

`src/services/api/endpoints/applications.ts`, after the `getResponseBlueprint`
block:

- Schemas (permissive, `.passthrough()`, R-A-6):
  ```ts
  const generateResponseDocSchema = z.object({
    key: z.string().optional(), title: z.string().optional(),
    status: z.string().optional(),
  }).passthrough();
  const responseDocSaveSchema = z.object({
    ok: z.boolean().optional(), key: z.string().optional(),
  }).passthrough();
  ```
- Types exported: `GenerateResponseDocResult`, `ResponseDocSaveResult`.
- Methods:
  ```ts
  /** POST .../assist/generate-response-doc — 202 async; retry:"never" (R-A-6). */
  async generateResponseDocument(id, key, prompt?, signal?): Promise<GenerateResponseDocResult>
  /** PUT .../assist/response-doc — saves edited content; retry:"never" (R-A-6). */
  async saveResponseDocument(id, key, content, signal?): Promise<ResponseDocSaveResult>
  ```
  Body: `{ key, prompt }` with `prompt` omitted when undefined (generate);
  `{ key, content }` (save). Both `policy: { retry: "never" }`, mirroring
  `saveAdditionalInfo` (applications.ts:958).

## UI — ResponseBlueprintPanel gains actions + inline editor

Panel file keeps its `useAsync` + `AsyncSection` shell. The existing
`ResponseDocRow` moves to a new file
`src/features/applications/workspace/ResponseBlueprintDocRow.tsx` and gains the
mutation surface; the panel passes an `endpoint` slice + a status/content
**overlay** down.

### Overlay state (panel-owned)

```ts
const [overlay, setOverlay] = useState<{
  docs?: Record<string, string>;        // locally saved content (R-A-2)
  status?: Record<string, { state: string; error?: string }>; // poll results (R-A-3)
}>({});
```

- Chips derive from `overlay` merged over the fetched payload
  (`overlay.docs?.[key] ?? payload.responseDocs?.[key]`, same for status) —
  unchanged `docStatusChip` semantics.
- The overlay is dropped for a key the latest fetch reports a status/content
  for (server wins on the next natural read).

### ResponseBlueprintDocRow — per-row actions

- No content, not generating → **Generate** button.
  - Press → `endpoint.generateResponseDocument(id, key)` → `202` → local
    status overlay `{state:'generating'}` + start bounded refresh (below).
  - `402` → row alert, `role="alert"`: *"Generating this document needs a paid
    plan."* (kind `payment-required`).
  - `409` (code `PRECONDITIONS_NOT_MET`) → *"Complete the required additional
    information before generating."*
  - Other errors → `describeApiError(error, "this document")` copy.
- Content exists → **Edit** (primary) + **Regenerate** (secondary, same
  generate handler — parent 202-idempotency protects a double press).
- Generating → button disabled ("Generating…"), spinner chip as today.
- Failed → existing "Failed" chip + `error` line + **Retry** (same handler).

### Inline editor

- `Edit` expands a `textarea` (plain, `min-h-32`, monospace-free) pre-filled
  with `overlay.docs[key] ?? payload.responseDocs[key]`; **Cancel** collapses
  without sending; **Save** → `endpoint.saveResponseDocument(id, key, draft)`
  → success: overlay doc updated, editor closes, "Saved" chip shows; failure:
  inline `role="alert"` with `describeApiError(error, "this document")` copy.
- No dirty-tracking beyond local state; the editor never auto-saves (R-A-2).

### Bounded follow-up refresh (R-A-3)

- On 202: a `useEffect` starts an interval (4 s, max 15 ticks ≈ 60 s). Each
  tick calls `endpoint.getResponseBlueprint(id)` **directly** (not
  `state.reload()` — no loading flash) and merges the fresh
  `responseDocStatus`/`responseDocs` into `overlay.status`/`overlay.docs`.
- The loop stops early when no merged status is `generating`; cleanup clears
  the interval on unmount. Steady state stays timer-free (R-B-2).

## Orchestrator wiring

`ApplicationWorkspace.tsx`: no structural change — the panel is already
mounted; its props gain the two endpoint methods (the `endpoint` object passed
already flows from the same `ApplicationsEndpoint` instance).

## Tests

- `src/tests/module-endpoints.test.ts` — contract tests: generate 202 shape
  (key/title/status), missing-key 400, `UNKNOWN_RESPONSE_DOC` 400, 409
  `PRECONDITIONS_NOT_MET` (code preserved), 402 `SUBSCRIPTION_REQUIRED`
  (kind `payment-required`), save `{ok:true,key}` shape, missing-content 400,
  403/404 mapping; both mutations assert `retry:"never"` behaviour (no retry on
  a transient-500).
- `src/tests/module-screens.test.tsx` — screen tests: Generate press → 202 →
  "Generating…" + poll ticks merge status → "Saved"; 402 shows upgrade copy
  (`role="alert"`), 409 shows preconditions copy; Edit → type → Save → "Saved"
  chip, editor closes; Cancel discards; save-failure alert; Regenerate path;
  poll stops when no key is generating; no loading flash during poll.
- `src/tests/fixtures/api-clients.ts` — stub gains `generateResponseDocument`,
  `saveResponseDocument` (`idle()`).
- `src/tests/endpoint-parity.test.ts` — route literals
  `` `.../assist/generate-response-doc` `` and `` `.../assist/response-doc` ``
  pinned with the other workspace routes.
- `src/tests/capability-scope.test.ts` — no changes (routes already under
  `/api/v1/applications/…/assist/`, in scope).

## Files touched

| File | Change |
|---|---|
| `src/services/api/errors.ts` | `ApiErrorKind` + `payment-required`; `kindForStatus` 402 |
| `src/services/api/describe-error.ts` | `payment-required` case + docblock line |
| `src/services/api/endpoints/applications.ts` | +2 schemas, +2 types, +2 mutation methods |
| `src/features/applications/workspace/ResponseBlueprintPanel.tsx` | overlay state + bounded refresh + wiring |
| `src/features/applications/workspace/ResponseBlueprintDocRow.tsx` | new — row + Generate/Edit/Regenerate + inline editor |
| `src/tests/module-endpoints.test.ts` | +contract tests |
| `src/tests/module-screens.test.tsx` | +screen tests |
| `src/tests/fixtures/api-clients.ts` | +stub methods |
| `src/tests/endpoint-parity.test.ts` | +route literals |
