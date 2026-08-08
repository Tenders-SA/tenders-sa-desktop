# Desktop Workspace — Additional-Info Q&A — SPEC_CONTRACT (Slice 2)

- **Status**: `APPROVED`
- **Date**: 2026-08-08
- **Scope**: Slice 2 — additional-info Q&A (R-A-1..R-A-6).
- **Approved by**: user
- **Approval date**: 2026-08-08

## Contract checklist (mirrors tasks.md)

| # | Item | Contract |
|---|---|---|
| C1 | Endpoint methods on `ApplicationsEndpoint` | `getAdditionalInfo` (GET) + `saveAdditionalInfo` (PUT, `retry:"never"`) against the live-verified contract; permissive schemas (R-A-5) |
| C2 | Panel | `features/applications/workspace/AdditionalInfoPanel.tsx` — own `useAsync` + `AsyncSection` (R-A-4); per-type fields, unknown types as text (R-A-5) |
| C3 | Human-initiated save | explicit "Save answers" button; no auto-save timer (R-A-2, R-W-7) |
| C4 | Completion feedback | progress row; `{persisted, unfilledRequired}` reflected; `persisted:false` → "Not saved — kept on this device", answers retained (R-A-3) |
| C5 | No clobbering | desktop sends exactly its form state; never writes `__`-prefixed keys (R-A-6) |
| C6 | Wiring + coverage | panel mounted in cockpit grid; fixtures gain the two methods; parity/capability tests pin `additional-info` literals |
| C7 | Verification gates | `vitest` full suite, `tsc --noEmit`, `eslint .`, `prettier --check .` — zero errors |
| C8 | Human verification | user fills + saves on a live DRAFT workspace, reload shows saved answers; recorded in `INTEGRATION_EVAL.md` |

## Explicitly out of contract

Response blueprint, document generation, enrichment, refine, briefing pack/export,
submission recording, board screen, stage auto-advance on completion. Parent repo
changes: none.

## Non-negotiable constraints

- Live deployment is the contract; schemas stay permissive (R-A-5).
- Saving happens only on a deliberate button press (R-A-2, R-W-7, brief §4.3).
- No `npm run build` / `next build` / prisma migrations (repo rule).
