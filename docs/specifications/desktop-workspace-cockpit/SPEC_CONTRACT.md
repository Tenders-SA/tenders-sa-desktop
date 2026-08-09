# Desktop Workspace Cockpit — SPEC_CONTRACT (Slice 1)

- **Status**: `APPROVED — IMPLEMENTATION AND LIVE VERIFICATION COMPLETE`
- **Date**: 2026-08-08
- **Scope**: Slice 1 — cockpit panels + lifecycle actions (R-W-1..R-W-7).
- **Approved by**: user (live workspace verification)
- **Approval date**: 2026-08-09

## Contract checklist (mirrors tasks.md)

| # | Item | Contract |
|---|---|---|
| C1 | Endpoint methods on `ApplicationsEndpoint` | `getCockpit`, `getComplianceGaps`, `getResearch`, `getWorkspaceStage`, `updateWorkspace` against the live-verified contracts in `design.md`; permissive schemas (R-W-6) |
| C2 | Panel components | `features/applications/workspace/*`: StageBar, UrgencyBanner, AnalysisStatusPanel, ComplianceGapsPanel, ResearchPanel, ValueEstimatePanel, ChecklistPanel, EventsPanel — each own `useAsync` + `AsyncSection` (R-W-5) |
| C3 | Orchestrator wiring | `ApplicationWorkspace.tsx` mounts panels; keeps existing header/notes/documents; one cockpit request shared by its panels |
| C4 | Lifecycle actions | stage move `{action:'stage',stage,baseStage}`, clear `{action:'stage',stage:null}`, status `{action:'status',status}` (400 surfaces parent `error`+`allowed`), archive `{action:'remove'}` — all explicit, never automatic (R-W-4, R-W-7); **no restore** (parent defect) |
| C5 | Stage source | `GET workspace/summary` with status-derived fallback on 403 — never a failure |
| C6 | Capability/parity | new routes covered in capability-scope + endpoint-parity tests (all under `/api/v1/`) |
| C7 | Verification gates | `vitest` full suite, `tsc --noEmit`, `eslint .`, `prettier --check .` — zero errors |
| C8 | Human verification | user opens a live DRAFT workspace: panels render, lifecycle actions work, single-panel failure degrades only that panel; recorded in `INTEGRATION_EVAL.md` |

## Explicitly out of contract

Additional-info Q&A, response blueprint, document generation, enrichment, refine,
briefing pack/export, submission recording, board screen. Parent repo changes: none
(no routes touched, no schema changes, no parallel pipeline).

## Non-negotiable constraints

- Live deployment is the contract; schemas stay permissive (R-W-6).
- Nothing auto-submits, auto-moves or auto-archives (R-W-7, brief §4.3).
- No `npm run build` / `next build` / prisma migrations (repo rule).
