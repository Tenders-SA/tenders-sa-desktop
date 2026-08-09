# Desktop Workspace — Response Document Authoring — SPEC_CONTRACT (Slice 4)

- **Status**: `APPROVED — IMPLEMENTATION AND LIVE VERIFICATION COMPLETE`
- **Date**: 2026-08-08
- **Scope**: Slice 4 — response-document authoring (R-A-1..R-A-6).
- **Approved by**: user (live verification confirmation)
- **Approval date**: 2026-08-09

## Contract checklist (mirrors tasks.md)

| # | Item | Contract |
|---|---|---|
| C1 | Error kind | `payment-required` in `ApiErrorKind`; `kindForStatus(402)`; `describeApiError` fixed upgrade copy, non-retryable (R-A-4) |
| C2 | Endpoint methods on `ApplicationsEndpoint` | `generateResponseDocument` (POST, `{key, prompt?}` → 202) and `saveResponseDocument` (PUT, `{key, content}` → `{ok, key}`), both `retry: "never"` (R-A-6); permissive schemas |
| C3 | Generate action | per-row Generate on unsaved docs; 202 → "Generating…" + bounded follow-up refresh (4 s ticks, ≤15, stops when no key is generating, direct fetch — no loading flash, teardown on unmount) (R-A-1, R-A-3) |
| C4 | Edit + Save | inline `textarea` editor; Save → PUT → "Saved" chip via overlay; Cancel discards; no auto-save (R-A-2) |
| C5 | Honest failures | 402 → "Generating this document needs a paid plan."; 409 `PRECONDITIONS_NOT_MET` → "Complete the required additional information before generating."; other errors via `describeApiError`; all `role="alert"`, row-local; no server strings shown (R-A-4, R-A-5) |
| C6 | Wiring + coverage | panel already mounted; row extracted to `ResponseBlueprintDocRow.tsx`; fixtures gain both methods; parity pins both literals |
| C7 | Verification gates | `vitest` full suite, `tsc --noEmit`, `eslint .`, `prettier --check .` — zero errors |
| C8 | Human verification | user live-verifies Generate → Saved flow, Edit → Save persistence, no loading flash, and the 402/409 copy; recorded in `INTEGRATION_EVAL.md` |

## Explicitly out of contract

Enrichment (`POST enrich-blueprint`, Pro-gated), refine, briefing pack/export,
submission recording, board screen, "regenerate with custom prompt". Parent
repo changes: none. AI inference runs only on an explicit human Generate press
and never twice for one key (parent 202-idempotency + disabled button).

## Non-negotiable constraints

- Live deployment is the contract; schemas stay permissive.
- No mutation without an explicit human press (R-W-7); no auto-retry of either
  mutation.
- `ApiError.message` / `blockedReason` are never shown verbatim
  (describe-error docblock).
- No `npm run build` / `next build` / prisma migrations (repo rule).
