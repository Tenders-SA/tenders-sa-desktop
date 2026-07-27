# SPEC CONTRACT — Tenders-SA Desktop Procurement Workspace

# Generated: 2026-07-27
# Status: APPROVED
# Approved by: mobiusndou@gmail.com on 2026-07-27

## CODER INSTRUCTIONS

This contract governs Phase 0 foundation and Phase 1 parent integration audit only. Read `requirements.md`, `design.md`, and `tasks.md` completely before implementation. Implement tasks in order; do not combine or silently change them. Complete each pre-check and verification. Mirror checklist changes here and in `tasks.md`.

Implementation must not begin until the user explicitly approves this specification and this status is changed to `APPROVED`.

## FEATURE SUMMARY

Create the production-oriented foundation for a Tauri 2 procurement desktop client and audit the existing Tenders-SA backend contracts it will consume. The desktop repository remains a client of the parent platform, with local data limited to secure cache/offline concerns and no duplicate backend.

## KEY CONSTRAINTS

- Phase 0 and Phase 1 only; Phases 2–13 require later specifications.
- No parent repository source changes, schema migrations, production data writes, or frozen-module modifications.
- Existing parent records and APIs are canonical; no independent backend.
- Local SQLite contains cache/offline/supporting state only and never persistent auth tokens.
- Production native auth remains feature-flagged off until TASK-1.3 is accepted.
- Tauri permissions are default-deny and least privilege; no generic shell access.
- No automatic submission, pricing approval, partner commitment, or compliance override.
- Original product prompt remains verbatim under `docs/prompts/`.
- A Windows release package/build is verified by a human or approved CI gate under repository rules.
- The desktop application ships a single dark theme only, no light-theme variant. Colors derive from the existing web platform's brand hues (emerald primary, gold accent, blue info) re-tuned for dark-surface WCAG 2.2 AA contrast.

## INTEGRATION WARNINGS

- Parent login currently exposes both response-token and cookie behavior; do not assume the supported native contract before the auth audit.
- Parent OpenAPI documents do not automatically cover internal workspace APIs; route code and tests at the pinned SHA outrank documentation.
- Parent auth, API response, database client, configuration, middleware, and several services are frozen. Consume contracts through APIs; propose parent changes separately.
- Tender document download must follow the existing parent Worker/R2/D1 application flow and must not fetch government sources directly.
- Subscription and authorization checks remain server-enforced.
- Proposal/pricing conflicts must preserve both local and remote versions for human resolution.

## TASK CHECKLIST

- [x] TASK-0.1 — Scaffold the Tauri 2 workspace
- [x] TASK-0.2 — Configure frontend quality and test tooling
- [x] TASK-0.3 — Implement validated runtime configuration
- [x] TASK-0.4 — Establish least-privilege native security commands
- [x] TASK-0.5 — Add local SQLite migrations and repositories
- [x] TASK-0.6 — Implement the offline operation state machine
- [x] TASK-0.7 — Implement the typed API transport foundation (pre-check partly satisfied; parent-internal contract remains UNCONFIRMED — see tasks.md evidence)
- [x] TASK-0.8 — Establish the dark design system and token foundation
- [x] TASK-0.9 — Build the authentication interface shell (pre-check partly blocked; parent auth contract UNCONFIRMED — see tasks.md evidence)
- [x] TASK-0.10 — Build the accessible desktop application shell
- [ ] TASK-0.11 — Add structured logging and redaction
- [ ] TASK-0.12 — Configure CI and contributor documentation
- [ ] TASK-0.13 — Evaluate Phase 0 foundation
- [ ] TASK-1.1 — Pin and document the parent audit baseline
- [ ] TASK-1.2 — Inventory canonical parent data models
- [ ] TASK-1.3 — Audit authentication and subscription contracts
- [ ] TASK-1.4 — Inventory relevant parent endpoints and OpenAPI drift
- [ ] TASK-1.5 — Produce cross-domain desktop mappings
- [ ] TASK-1.6 — Create the capability gap report
- [ ] TASK-1.7 — Define the Phase 2 vertical slice
- [ ] TASK-1.8 — Complete final integration evaluation

## COMMIT FORMAT

Use the exact commit listed by each task. Each implementation commit must identify its task and requirement references in the body. Documentation checkbox updates may be included with the task commit when made after successful verification; never mark a task complete before evidence exists.
