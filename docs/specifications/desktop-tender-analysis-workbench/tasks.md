# Desktop tender analysis workbench — implementation tasks

Implementation may begin only after `SPEC_CONTRACT.md` is approved and the
parent API work has its separately approved parent-repository specification.

## Phase 1 — parent contract and security

- [ ] 1.1 Create/approve the parent API specification for the additive tender
  analysis projection and entitlement/cache boundary.
  - Pre-check: verify current model field names, route consumers, middleware,
    feature-service semantics, and cache key/value behavior.
  - Files: parent specification only.
  - Verify: impact assessment explicitly proves analysis text cannot leak to a
    locked user or through a shared cache.
- [ ] 1.2 Add failing parent route tests for entitled, locked, bundle-wallet,
  partial, legacy, extended, and feature-service-error responses.
  - Pre-check: capture the current bare response contract.
  - Files: focused tests adjacent to `src/app/api/tenders/[id]/route.ts`.
  - Verify: tests fail for missing projection before implementation.
- [ ] 1.3 Extend the existing parent route formatter and enforce access before
  analysis serialization.
  - Pre-check: confirm no frozen module edit is required.
  - Files: existing route and, only if necessary, a route-local projector.
  - Verify: focused tests, targeted TypeScript, lint, no analysis text in a
    locked response, and no extracted text/raw AI internals in any response.
- [ ] 1.4 Deploy and validate the parent contract before desktop consumption.
  - Pre-check: user/CI owns deployment.
  - Verify: authenticated smoke fixtures for available, locked, and pending.

## Phase 2 — desktop contract

- [ ] 2.1 Add Zod schemas and fixtures for analysis access, nested legacy
  fields, extended sections, structured evaluation, provenance, and versions.
  - Pre-check: compare against the deployed parent response.
  - Files: `src/services/api/endpoints/tenders.ts`, endpoint tests.
  - Verify: malformed optional sections degrade locally without rejecting the
    entire tender; required core tender fields remain strict.
- [ ] 2.2 Pass the existing subscription endpoint and workspace navigation
  capability into the tender detail route.
  - Pre-check: reuse `clients.subscription`; do not create a new access client.
  - Files: `src/app/router/routes.tsx`, navigation tests.
  - Verify: feature-access errors are retryable and never shown as a denial.

## Phase 3 — pure analysis presentation model

- [ ] 3.1 Implement section normalization and human labels for all legacy and
  extended keys.
  - Pre-check: compare the web section order and noise rules.
  - Files: `src/features/tenders/detail/analysis-presentation.ts` and tests.
  - Verify: unknown future keys remain visible with safe labels.
- [ ] 3.2 Implement cross-document exact/near deduplication, noise removal,
  primary-document ordering, source attribution, and lifecycle derivation.
  - Pre-check: use production-shaped multi-document fixtures.
  - Verify: important distinct requirements survive while duplicated boilerplate
    appears once; no point is truncated in the presentation model.

## Phase 4 — desktop workbench

- [ ] 4.1 Refactor the existing tender detail into a wide, sticky decision
  shell without changing download/save/pursue behavior.
  - Files: `TenderDetail.tsx`, `TenderDecisionHeader.tsx`, layout tests.
  - Verify: existing tender-detail and download tests remain green.
- [ ] 4.2 Implement the emphasised AI-Analyzed Compliance Requirements panel.
  - Files: `ComplianceRequirementsPanel.tsx`, component tests.
  - Verify: priority order, counts, source labels, verification notice, locked
    state, and keyboard reading order.
- [ ] 4.3 Implement the section navigator, full document analysis explorer,
  and structured evaluation renderer.
  - Files: navigator/explorer/evaluation components and tests.
  - Verify: every meaningful field is reachable, supporting documents expand,
    invalid JSON falls back to text, and long content remains selectable.
- [ ] 4.4 Implement the preparation rail and existing Application Workspace
  handoff.
  - Files: `PreparationRail.tsx`, route/component tests.
  - Verify: no AI processing or pursue action runs without an explicit click.
- [ ] 4.5 Implement honest no-document, pending, partial, failed, locked,
  unavailable, and empty-analysis states.
  - Verify: generic tender details and documents remain usable in every state.

## Phase 5 — gates and rollout

- [ ] 5.1 Run focused endpoint, normalization, tender-detail, navigation, and
  download tests; TypeScript; scoped ESLint; Prettier; and diff check.
- [ ] 5.2 Perform desktop visual/accessibility QA at wide and compact widths,
  keyboard-only, 200% zoom, long tender titles, and multi-document analysis.
- [ ] 5.3 Run changelog maintenance in both repositories and release parent
  before desktop.
