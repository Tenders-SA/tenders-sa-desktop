# Desktop Workspace — Response Blueprint — Design (Slice 3)

Mirrors the Slice 2 (additional-info) structure: one GET endpoint method, one
panel, orchestrator wiring, fixtures + parity coverage. Read-only (R-B-2).

## Endpoint layer — extend `ApplicationsEndpoint` (no parallel client)

`src/services/api/endpoints/applications.ts`:

- `getResponseBlueprint(id: string, signal?: AbortSignal): Promise<BlueprintPayload>`
  — GET `` `/api/v1/applications/${encodeURIComponent(id)}/assist/response-blueprint` ``.
  Read-only → default retry policy (the transport retries transient network
  failures; no `retry: "never"` — that is reserved for mutations, R-W-7).
- `blueprintFieldSchema`/`blueprintSchema` (permissive, R-B-5):
  - `responseDocsSchema` → `Record<string, string>` (default `{}`).
  - `responseDocStatusSchema` → `Record<string, { state: "generating"|"ready"|"failed"|string, startedAt?: number, updatedAt?: number, isFallback?: boolean, error?: string, unresolvedPlaceholders?: string[] }>` (default `{}`).
  - `blueprintSchema` → object with optional sections, validated by type:
    `requiredUserDocuments` (array of `{name, canonicalType?, source?, mandatory?, note?}`),
    `responseDocuments` (array of `{key, title?, kind?, brief?, requiredBy?, mandatory?}`),
    `steps` (array of `{key, title?, detail?, dueDate?, category?, mandatory?, source?}`),
    `submission` (object with optional `method/address/portalUrl/deadline/contact/notes`),
    `risks` (array of strings), `confidence` ("high"|"medium"|"low"|string),
    `generatedBy` ("deterministic"|"ai"|string), `industry` (`{id,name}` | null),
    `tenderId` string.
  - `blueprintPayloadSchema` → `{ blueprint: blueprintSchema | null, hasAnalysis?: boolean, enriched?: boolean, responseDocs?: responseDocsSchema, responseDocStatus?: responseDocStatusSchema }`.
- Types exported: `BlueprintPayload`, `ResponseBlueprint`, `RequiredUserDocument`,
  `ResponseBlueprintDoc`, `BlueprintStep`, `BlueprintSubmission`, `ResponseDocStatusMap`.
- Parsing leaves unknown enum values as the raw string (R-B-5); the panel
  renders them as plain text.

## UI — `ResponseBlueprintPanel.tsx`

New `src/features/applications/workspace/ResponseBlueprintPanel.tsx`, following
the Slice 2 panel conventions (own `useAsync` + `AsyncSection`, `Panel` from
`AsyncSection`, plain Tailwind, no shadcn).

Structure inside one `Panel` titled "Response blueprint":

- **Header row**: confidence badge (`high`=success / `medium`=warning /
  `low`=muted, unknown=plain) + provenance chip (`generatedBy === "ai"` or
  `enriched` → "AI-tailored", else "Standard plan").
- **Response documents** (`responseDocuments`): title (+ `*` when
  `mandatory`), `brief`, `requiredBy` as a small line, and a per-key status
  chip derived from `responseDocs` + `responseDocStatus`:
  - key present in `responseDocs` → "Saved"
  - status `generating` → "Generating…" (pulsing)
  - status `failed` → "Failed" + tooltip/label of `error`
  - `isFallback` with `ready` → "Saved · template"
  - nothing → "—" (no chip)
- **Required documents** (`requiredUserDocuments`): name, `source` tag
  (analysis/industry/compliance → muted label), `*` when mandatory, `note`
  when present.
- **Steps** (`steps`): ordered list with category label, title, `detail`,
  `dueDate` formatted via the existing date formatter (unknown → no date).
- **Submission box**: `method`, `deadline`, `portalUrl` (plain text, not a
  link — desktop never opens web links silently), `contact`, `notes`;
  missing fields omitted.
- **Risks** (`risks`): warning-styled list, hidden when empty.
- **Empty state**: when `blueprint` is null/absent → "No response blueprint
  for this tender yet." (R-B-5).

No mutations, no timers, no polling (R-B-2). Generation status is whatever
the last GET returned; the panel reloads only when the workspace does.

## Orchestrator wiring

`src/features/applications/ApplicationWorkspace.tsx`: mount
`<ResponseBlueprintPanel endpoint={endpoint} applicationId={applicationId} />`
in the cockpit grid after `AdditionalInfoPanel`.

## Tests

- `src/tests/module-endpoints.test.ts` — contract tests: parses the live
  route shape (blueprint + sections + `responseDocs` + `responseDocStatus`);
  `blueprint: null` and absent sections tolerated; `responseDocs`/status
  default `{}`; unknown kind/category values pass through; GET retried once
  on a transient failure; 401/400→`unauthorized`/`validation`; 404→
  `not-found`.
- `src/tests/module-screens.test.tsx` — screen tests: renders the sections
  from a live-shaped payload (incl. 12 required docs), status chips per key
  (Saved / Generating… / Failed+error / none), provenance chip, risks;
  per-panel failure isolation; null blueprint → empty state.
- `src/tests/fixtures/api-clients.ts` — stub gains `getResponseBlueprint`
  (`idle()`).
- `src/tests/endpoint-parity.test.ts` — route literal
  `` `.../assist/response-blueprint` `` pinned with the other workspace routes.
- `src/tests/capability-scope.test.ts` — no changes needed (route already
  under `/api/v1/applications/…`, in scope).

## Files touched

| File | Change |
|---|---|
| `src/services/api/endpoints/applications.ts` | +schemas, +type exports, +`getResponseBlueprint` |
| `src/features/applications/workspace/ResponseBlueprintPanel.tsx` | new panel |
| `src/features/applications/ApplicationWorkspace.tsx` | mount panel |
| `src/tests/module-endpoints.test.ts` | +contract tests |
| `src/tests/module-screens.test.tsx` | +screen tests |
| `src/tests/fixtures/api-clients.ts` | +stub method |
| `src/tests/endpoint-parity.test.ts` | +route literal |
