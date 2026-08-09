# Desktop Workspace — Response Document Authoring — INTEGRATION_EVAL (Slice 4)

- **Status**: complete — T1–T4 verified

## Gates

| Gate | Task | Evidence | Date |
|---|---|---|---|
| Endpoint contract tests | T1 | `vitest module-endpoints` — new methods against live-verified shapes (71/71) | 2026-08-08 |
| Panel tests | T2 | `vitest module-screens` — generate/save/regenerate/402/409/poll-stop (59/59) | 2026-08-08 |
| Full suite + static gates | T3 | `vitest` (all) 599/599, `tsc --noEmit`, `eslint .`, `prettier --check .` — 0 errors | 2026-08-08 |
| Capability/parity | T3 | `vitest capability-scope endpoint-parity` — both literals pinned | 2026-08-08 |
| Live human verification | T4 | User confirmed Generate → Saved, Edit → Save persistence, no loading flash, and the 402/409 copy all work. | 2026-08-09 |

## Live contract evidence (2026-08-08)

Route contracts read from parent code:

- `src/app/api/v1/applications/[applicationId]/assist/response-doc/route.ts`
  — PUT `{key, content}` → `{ok, key}`; no subscription gate; base docs mirror
  to legacy `generated_*` columns; 400/401/403/404/500.
- `src/app/api/v1/applications/[applicationId]/assist/generate-response-doc/route.ts`
  — POST `{key, prompt?}` → 202 `{key, title, status:'generating'}`;
  idempotent via `isGenerating`; 402 `SUBSCRIPTION_REQUIRED` (any active/trial
  subscription); 409 `PRECONDITIONS_NOT_MET` (only hard gate: unfilled required
  additional info); 400 `UNKNOWN_RESPONSE_DOC`; result lands in
  `__responseDocs`/`__responseDocStatus` — already surfaced by the blueprint
  GET (Slice 3 contract).
- Precondition semantics from `src/lib/services/workspace/generation-preconditions.ts`
  (`ok = infoNeeded === 0`; documents/compliance advisory only).
- Enrichment (`enrich-blueprint/route.ts`) confirmed Pro-tier 402-gated —
  explicitly out of contract this slice.

## Deviations

- *(none)*
