# Desktop Workspace — Response Document Editor Hardening — SPEC_CONTRACT (Slice 8)

- **Status**: `APPROVED`
- **Date**: 2026-08-13
- **Scope**: Slice 8 — response-document editor hardening (RH-1..RH-7). Closes
  gap-analysis findings G1, G2, G3, G5, G6, G10, G11.
- **Approved by**: user (2026-08-13)

## Contract checklist (mirrors tasks.md)

| # | Item | Contract |
|---|---|---|
| C1 | Shared status/error owner | `response-doc-status.ts` exports `describeGenerateError` + `describeResponseDocStatus`; row + editor both import it; no duplicated logic (RH-4) |
| C2 | Generate failure honesty | full-screen editor catches rejected Generate; 409 `PRECONDITIONS_NOT_MET` and 402 `payment-required` render fixed copy inline via `role="alert"`; no server strings (RH-1) |
| C3 | Generation outcome | editor surfaces `failed` (notice + Retry), `isFallback` ("Saved · template"), `unresolvedPlaceholders` (count warning); navigator distinguishes template (RH-2) |
| C4 | Stuck-generation recovery | `recheck()` single direct read; `staleGenerating` flag; "Check again" action; `readOnly` only while `state === "generating"`; no new timers (RH-3) |
| C5 | No raw strings | `status.error` / `blockedReason` / `ApiError.message` never rendered verbatim in authoring UI (RH-5) |
| C6 | Reference pane conformance | keyword table `REFERENCE_TERMS` removed; related files from server fields only; honest "No related tender files identified"; drawer below `lg` (RH-6, RH-7) |
| C7 | Verification gates | `vitest` full suite, `tsc --noEmit`, `eslint`, `prettier --check` — zero errors (T5) |
| C8 | Human verification | user live-verifies 402/409, failed/template/placeholder, Check-again, drawer; recorded in `INTEGRATION_EVAL.md` (T6) |

## Explicitly out of contract

- Local draft persistence / offline save queue / version history (Slice 10).
- Custom prompt, batch generate, draft-list landing view (Slice 9).
- Parent repo changes: none. No new endpoint, schema, migration, prompt or
  analysis path. AI inference still runs only on an explicit human Generate
  press and never twice for one key (parent 202-idempotency + disabled button).

## Non-negotiable constraints

- Live deployment is the contract; schemas stay permissive; no parent mutation.
- No mutation auto-retry (`retry: "never"` unchanged).
- Component-owned copy everywhere; `ApiError.message` / `blockedReason` / stored
  `error` never shown verbatim (describe-error docblock, REQ-8).
- Steady state timer-free; only the existing bounded generation refresh polls,
  after an explicit Generate.
- No `npm run build` / `next build` / prisma migrations (repo rule).
