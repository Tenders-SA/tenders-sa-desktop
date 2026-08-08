# Desktop Workspace — Additional-Info Q&A — Requirements (Slice 2)

- **Date**: 2026-08-08
- **Status**: proposal
- **Scope**: Slice 2 of the workspace mirror — the tender-specific additional
  information Q&A (`GET/PUT /api/v1/applications/[id]/assist/additional-info`).
  Slices 3–5 (blueprint + generation, submission/export, refine) remain future
  specs. Governing principle (from `desktop-workspace-cockpit/requirements.md`):
  **the live parent deployment is the only contract**.
- **Parent evidence**: routes verified live on 2026-08-08 (`GET /assist/additional-info`
  → `{values: {}, fields[6], unfilledRequired: 6}` for app `cmsed6wb71ct5knmuidlfu7fw`);
  parent route + service source at branch `aws-production-app`
  (`src/app/api/v1/applications/[applicationId]/assist/additional-info/route.ts`,
  `src/lib/services/workspace/additional-info.ts`).

## Problem

The desktop workspace (Slice 1) renders the parent's cockpit, but the parent's
"Additional Information" Q&A — the tender-specific details (bid contact, pricing
basis, delivery address, conditional commitments, declarations) the parent needs
before it can generate final documents — has no desktop equivalent. The stage bar
sits at `add_information` with no way to supply that information, so the desktop
cannot progress a real workspace.

## Live-verified parent contract (2026-08-08)

### GET /api/v1/applications/[id]/assist/additional-info
```jsonc
{ "values": {},                    // persisted answers, flat keys; `__`-prefixed state stripped
  "fields": [ { "id": "bidContactPerson", "label": "Bid contact person",
      "type": "text", "required": true, "placeholder": "…", "help": "…" }, … ],
  "unfilledRequired": 6 }
```
- `InfoField.type`: `"text" | "textarea" | "email" | "tel" | "checkbox"`.
- `InfoValues`: `Record<string, string | boolean | undefined>`.
- Field set is per-tender: 5 base fields (`bidContactPerson`, `bidContactEmail`,
  `bidContactPhone`, `pricingBasis`, `deliveryAddress`), conditional additions
  (`localContentCommitment` when analysis mentions "local content",
  `hdiCommitment` when it mentions HDI/sub-contracting), and the
  `declarationsAccepted` checkbox. `deliveryAddress` label embeds the province.
- `unfilledRequired` counts required fields whose value is missing, blank, or
  (checkbox) not exactly `true`.
- Errors: 401 | 400 `{error:'Company profile required'}` | 403 | 404 | 500.

### PUT /api/v1/applications/[id]/assist/additional-info
- Body: `{ values: InfoValues }` → 200 `{ persisted: boolean, unfilledRequired: number }`.
- Additive write: merges the answers over `__`-namespaced workspace state in a
  transaction; a pre-migration column answers `{persisted: false}` (client may
  keep its draft locally rather than erroring).
- 400 `{error:'Invalid values'}` for a non-object `values`. Errors: 401 | 400 | 403 | 404 | 500.

## Functional requirements

### R-A-1 — Load the Q&A live
`getAdditionalInfo` reads the GET route; the panel renders every returned field
by its `type` (text/textarea/email/tel/checkbox) with label, required marker,
placeholder and help text, pre-filled from `values`.

### R-A-2 — Answer + save, human-initiated
- Edits update local state and mark the panel dirty.
- Saving is an **explicit button press** ("Save answers", R-W-7 spirit — no
  background PUT on every keystroke, no auto-save timer). The parent's debounced
  auto-save is noted in design.md and deliberately not copied.
- The PUT sends `{ values }` exactly; `retry: "never"` (no idempotency key).

### R-A-3 — Completion feedback
- Required-fields progress ("n of m required") rendered from the server's
  `unfilledRequired` when present, else computed locally with the same rule
  (checkbox → `value === true`; else non-blank string).
- After a successful save, `{persisted, unfilledRequired}` is reflected: badge
  "Saved", or "Saved · n required left". `{persisted:false}` shows "Not saved —
  kept on this device" and the panel keeps its answers (they are not lost).
- A failed PUT shows the error (`describeApiError`) and the panel stays dirty.

### R-A-4 — Panel independence (R-W-5)
Own `useAsync` + `AsyncSection`; a failed GET degrades this panel only.

### R-A-5 — Contract tolerance (R-W-6)
Permissive schema: `values` as a passthrough record, fields as a permissive
object array defaulting `[]`; an unrecognised `type` renders as a text input
(rather than failing the panel).

### R-A-6 — No clobbering, no reserved keys
The desktop never writes `__`-prefixed keys and never re-sends keys the server
did not return in `values` beyond the user's edits — the additive-merge contract
is the server's, and the desktop respects it by sending exactly its form state.

## Non-functional

- Same transport/error/redaction rules as the rest of the desktop (REQ-5, REQ-8).
- No new parent routes, no schema changes, no parallel pipeline. Routes under
  `/api/v1/` — already in capability scope.
- All mutations require a human press (R-W-7).

## Out of scope (later slices)

Response blueprint, document generation, enrichment, refine, briefing pack/export,
submission recording, board screen.

## Success criteria

1. Opening a workspace renders the additional-info fields for that tender
   (live-verified: 6 fields for the probe app), pre-filled with saved answers.
2. Filling and pressing "Save answers" PUTs `{values}` and reflects
   `{persisted, unfilledRequired}`; a saved answer survives a reload.
3. A forced GET failure degrades this panel only; a forced PUT failure shows
   "Not saved" and keeps the answers.
4. `vitest`, `tsc --noEmit`, `eslint`, `prettier --check` pass.
