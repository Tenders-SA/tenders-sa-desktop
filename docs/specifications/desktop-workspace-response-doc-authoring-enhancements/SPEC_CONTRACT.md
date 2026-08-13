# Desktop Workspace — Response Document Authoring Enhancements — SPEC_CONTRACT (Slice 9)

- **Status**: `PENDING APPROVAL`
- **Date**: 2026-08-13
- **Scope**: Slice 9 — authoring enhancements (RA-1..RA-3). Closes gap-analysis
  findings G7, G9, G12.
- **Approved by**: _(pending)_

## Contract checklist (mirrors tasks.md)

| # | Item | Contract |
|---|---|---|
| C1 | Draft list landing | no-key Draft renders `ResponseDocumentList` (server order, shared status labels); select opens editor; deep link unchanged (RA-3) |
| C2 | Batch generate | `generateMany` issues one `generateResponseDocument` per eligible key (no content, not generating), sets overlay + `pendingKeys`, returns per-key results; explicit "Generate all N remaining" press only (RA-1) |
| C3 | Batch failure honesty | per-key 402/409 surfaced via shared `describeGenerateError`; never silent (RA-1) |
| C4 | Optional instructions | editor instructions field passed as `prompt`; cleared after 202; never logged/persisted/shown back (RA-2) |
| C5 | Verification gates | `vitest` full suite, `tsc --noEmit`, `eslint`, `prettier --check` — zero errors (T4) |
| C6 | Human verification | user live-verifies list, Generate-all, instructions; recorded in `INTEGRATION_EVAL.md` (T5) |

## Explicitly out of contract

- Local draft persistence / offline save queue / version history (Slice 10).
- Parent repo changes: none. The `prompt` argument already exists on
  `generateResponseDocument`; no new endpoint or schema.
- No automatic generation; no batch save; no submission.

## Non-negotiable constraints

- Live deployment is the contract; schemas stay permissive.
- Every generate (single or batch) is an explicit human press; AI inference never
  runs on stage open and never twice for one key (202-idempotency + disabled
  buttons).
- No mutation auto-retry (`retry: "never"` unchanged).
- Component-owned copy; `ApiError.message`/`blockedReason`/`prompt` never shown
  back verbatim.
- No `npm run build` / `next build` / prisma migrations (repo rule).
