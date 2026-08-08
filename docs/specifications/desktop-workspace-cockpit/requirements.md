# Desktop Workspace Cockpit — Requirements (Slice 1)

- **Date**: 2026-08-08
- **Status**: proposal
- **Scope**: Slice 1 of the workspace mirror — cockpit data panels + lifecycle actions.
  Slices 2–5 (additional-info Q&A, blueprint + generation, submission/export, refine)
  are separate future specs. See `docs/specifications/dashboard-live-data.md` for the
  governing principle: **the live parent deployment is the only contract**.
- **Parent evidence**: routes verified live on 2026-08-08 against
  `https://www.tenders-sa.org` with a live session (app `cmsed6wb71ct5knmuidlfu7fw`).
  Parent code references at branch `aws-production-app`.

## Problem

The desktop workspace (`src/features/applications/ApplicationWorkspace.tsx`) renders a
static read of the application detail route. The parent web application's workspace
("Workspace Cockpit") is a working lifecycle surface: an 8-stage stepper, an urgency
banner, document-analysis status, quality checks, a compliance-gaps register, market
research (buyer, competitors, province health, eligibility), a value estimate, a
preparation checklist, an events timeline, and lifecycle actions (stage moves, status
transitions, archive). The desktop does none of it.

## Functional requirements

### R-W-1 — Cockpit data, live
The workspace loads the parent cockpit payload `GET /api/v1/applications/[id]/assist`
and renders: status/currentStep/progress/readiness header data, urgency banner
(level, message, days/hours remaining), document-analysis status (status/message/progress),
quality checks (id, category, status, message), value estimate (min/max/median,
confidence, methodology, currency, warnings), preparation checklist (id, label,
completed, category), and events timeline (title, description, date, type, completed).

### R-W-2 — Compliance gaps
`GET /api/v1/applications/[id]/assist/compliance-gaps` renders each gap (category,
severity, label, detail, tenderRequirement, companyStatus, canAutoFix) and the summary
(blocking, important, strengths, info, score). Severity colours: blocking → destructive,
strengths → success, important → warning, info → muted.

### R-W-3 — Market research
`GET /api/v1/applications/[id]/assist/research` renders the buyer organisation profile
(name, type, contact, address, website, active/closed/award counts), top competitors
(supplierName, totalValue, awardCount), province health (province, score, activityLevel),
and eligibility results (cidb/bbbee/taxClearance status + detail).

### R-W-4 — Lifecycle actions (explicit human actions only, brief §4.3)
- **Stage bar**: the 8 parent stages (`suggested → needs_analysis →
  review_requirements → fix_readiness → add_information → generate_documents →
  ready_to_submit → submitted`) shown as a stepper; the current stage comes from
  `GET /api/v1/applications/workspace/summary` (live-verified for this user) with a
  status-derived fallback when the route is denied.
- **Move stage**: `PATCH /api/v1/applications/[id]/workspace` `{action:'stage', stage,
  baseStage}`; **clear override**: `{action:'stage', stage:null}`.
- **Status transition**: `{action:'status', status}`; parent validates transitions and
  answers 400 with an `allowed` list — the desktop surfaces the parent's message.
- **Archive**: `{action:'remove'}`.
- **No restore**: the parent's live `restore` action does not persist (defect in the
  deployed `[applicationId]/workspace` route, `isArchived: true: false` literal), so the
  desktop does not offer it until the parent fixes the route.

### R-W-5 — Panel independence
Each panel owns its request and renders its own loading/error/empty states
(`AsyncSection`, REQ-A8/A11Y-1). One failing route must not blank the workspace or the
other panels. This is the same rule Command Centre already follows.

### R-W-6 — Contract tolerance
All cockpit schemas are permissive (recognised fields typed, everything else
passthrough, nullable) so a moved parent shape degrades a panel to its error state
rather than failing the whole screen — the lesson of the dashboard `{}` defect.

### R-W-7 — Mutations are never automatic
No lifecycle action runs on mount or on load. Every transition is a deliberate button
press. Nothing auto-submits, auto-archives or auto-moves stages.

## Non-functional

- Same transport/error/redaction rules as the rest of the desktop (REQ-5, REQ-8).
- PATCH mutations are not auto-retried beyond safe bounds; a 400 transition surfaces
  the parent's allowed list verbatim.
- No new parent routes, no schema changes, no parallel analysis pipeline.
- Routes used are all under `/api/v1/` — already permitted by the app's
  capability-scope and endpoint-parity tests.

## Out of scope (later slices)

Additional-info Q&A, response blueprint, document generation, enrichment, refine,
briefing pack/export, submission recording, board screen (the summary route is used
here only as a stage source).

## Success criteria

1. Opening a workspace renders: stage bar, urgency, analysis status, quality checks,
   compliance gaps, research, value estimate, checklist, events — each from its live
   route.
2. Moving a stage, clearing an override, and archiving issue the correct PATCH bodies
   and reflect the response.
3. A forced 400 status transition shows the parent's message + allowed list.
4. One panel forced to fail shows its own error while the rest render.
5. `vitest`, `tsc --noEmit`, `eslint`, `prettier --check` pass.
