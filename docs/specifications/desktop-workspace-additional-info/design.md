# Desktop Workspace — Additional-Info Q&A — Design (Slice 2)

Refs: requirements.md R-A-1..R-A-6.

## Endpoint layer — extend `ApplicationsEndpoint` (no parallel client)

Two methods on the existing class in `src/services/api/endpoints/applications.ts`,
next to the Slice 1 cockpit methods:

| Method | Route | Notes |
|---|---|---|
| `getAdditionalInfo(id, signal)` | GET `assist/additional-info` | permissive schema, live-verified shape |
| `saveAdditionalInfo(id, values, signal)` | PUT `assist/additional-info` | `{values}` body; `retry: "never"`; 400 `Invalid values` surfaces as validation error |

```ts
const additionalInfoFieldSchema = z
  .object({
    id: z.string().optional(),
    label: z.string().optional(),
    type: z.string().optional(),          // "text" | "textarea" | "email" | "tel" | "checkbox"
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
    help: z.string().optional(),
  })
  .passthrough();

const additionalInfoSchema = z
  .object({
    values: z.record(z.string(), z.unknown()).default({}),
    fields: z.array(additionalInfoFieldSchema).optional(),
    unfilledRequired: z.number().optional(),
  })
  .passthrough();

const additionalInfoSaveSchema = z
  .object({
    persisted: z.boolean().optional(),
    unfilledRequired: z.number().optional(),
  })
  .passthrough();
```

`InfoValues` is `Record<string, string | boolean>` on the desktop side (server
tolerates `undefined`; we never send it).

## UI — `AdditionalInfoPanel.tsx`

New file `src/features/applications/workspace/AdditionalInfoPanel.tsx`, mounted by
`ApplicationWorkspace.tsx` into the cockpit grid (after the Slice 1 panels).

- Own `useAsync(getAdditionalInfo)` + `AsyncSection` (R-A-4) with subject
  "the additional information".
- Local state: `draft` values (seeded from `values` once), `dirty`, `saving`,
  `lastSave: {persisted, unfilledRequired} | undefined`, `saveError`.
- Field rendering by `type`:
  - `textarea` → full-width `<textarea>`; `checkbox` → full-width labelled
    checkbox row;
  - `text | email | tel` (and any unknown type, R-A-5) → single-line input with
    `type` mapped 1:1 (`email`, `tel`, else `text`).
  - Label + required `*` + `placeholder` + `help` under the field, mirroring the
    parent's copy but in the desktop's existing light theme / `Panel` shell
    (no shadcn import — desktop components are plain Tailwind, see
    `tenders-sa-ui-landing-pages` conventions).
- Progress row above the fields: "n of m required" (R-A-3) — `m` = required
  fields present, `n` = those filled by the local rule (checkbox → `=== true`,
  else trimmed non-empty). The server's `unfilledRequired` is displayed after a
  save (server truth) and the local count before any edit is persisted.
- Save flow (R-A-2): "Save answers" button, disabled while `saving` or when
  `!dirty`; `saveAdditionalInfo(id, draft)`; on `persisted` → "Saved" /
  "Saved · n required left" badge, `dirty=false`; on `persisted:false` → "Not
  saved — kept on this device" (answers retained); on throw →
  `describeApiError` text, stays dirty.
- Explicitly **no** debounce timer, no localStorage mirror (R-A-2). The parent's
  700 ms auto-save was rejected: a background PUT is a mutation the user did not
  press, and the desktop loses nothing — one deliberate click saves.

## Orchestrator wiring

`ApplicationWorkspace.tsx` mounts `<AdditionalInfoPanel endpoint={endpoint}
applicationId={applicationId} />` in the cockpit grid. `StageBar` is untouched
(this slice does not auto-advance `add_information`; generation gating is a
later slice).

## Tests

- `module-endpoints.test.ts` (contract, live-verified shapes):
  - GET parses `{values, fields[6 incl. declarationsAccepted checkbox],
    unfilledRequired: 6}`; `values` defaults `{}` when absent.
  - PUT sends `{values}` with `method: "PUT"` to the `additional-info` path.
  - PUT is never retried (same pattern as the lifecycle mutation).
  - PUT 400 `{error:'Invalid values'}` surfaces `kind: "validation"`.
- `module-screens.test.tsx`: panel renders the 6 fields from a stub, typing +
  "Save answers" issues the exact `{values}` body, badge flips to "Saved",
  forced PUT failure shows "Not saved" and keeps answers, forced GET failure
  degrades only this panel (other panels still render).
- `fixtures/api-clients.ts`: applications fixture gains `getAdditionalInfo` +
  `saveAdditionalInfo` (`idle()`).
- `endpoint-parity.test.ts` + `capability-scope.test.ts`: route literals
  `additional-info` (GET+PUT) added to the explicit coverage.

## Files touched

- `src/services/api/endpoints/applications.ts` (2 methods + 3 schemas)
- `src/features/applications/workspace/AdditionalInfoPanel.tsx` (new)
- `src/features/applications/ApplicationWorkspace.tsx` (mount)
- `src/tests/module-endpoints.test.ts`, `module-screens.test.tsx`,
  `fixtures/api-clients.ts`, `endpoint-parity.test.ts`, `capability-scope.test.ts`
