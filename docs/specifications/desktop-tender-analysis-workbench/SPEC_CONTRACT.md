# Specification contract — desktop tender analysis workbench

**Status: APPROVED — user directive, 2026-08-12**

Implementation is authorised by the user directive. Parent API implementation
still requires the separately governed parent-repository specification below.

## Locked decisions

- [ ] Extend the existing canonical analysis output; create no analysis path.
- [ ] Add one entitled projection to the existing tender detail contract.
- [ ] Enforce analysis access on the server before serialization and outside
  any user-agnostic shared cache.
- [ ] Make AI-Analyzed Compliance Requirements the first substantive panel.
- [ ] Preserve source provenance and all meaningful extended sections.
- [ ] Use the existing Application Workspace for company comparison and bid
  preparation.
- [ ] Preserve custom lifecycle states and the current tender/download/actions
  behavior.
- [ ] Make no schema, prompt, queue, cron, AI-client, or local-analysis change.

## Execution checklist

The following mirrors `tasks.md` and must be completed in order:

- [ ] 1.1 Parent specification and security/cache impact assessment approved.
- [ ] 1.2 Parent contract/security tests written first.
- [ ] 1.3 Existing parent formatter extended with server-side entitlement.
- [ ] 1.4 Parent deployed and live contract validated.
- [ ] 2.1 Desktop analysis schemas and fixtures added.
- [ ] 2.2 Existing subscription/navigation dependencies injected.
- [ ] 3.1 Analysis fields normalized and labelled.
- [ ] 3.2 Deduplication, ordering, provenance, and lifecycle derived.
- [ ] 4.1 Existing detail shell adapted to wide desktop layout.
- [ ] 4.2 Emphasised compliance panel implemented.
- [ ] 4.3 Full analysis explorer and structured evaluation implemented.
- [ ] 4.4 Preparation rail linked to existing workspace.
- [ ] 4.5 Honest lifecycle states implemented.
- [ ] 5.1 Automated gates passed.
- [ ] 5.2 Desktop visual/accessibility QA passed.
- [ ] 5.3 Changelogs completed; parent released before desktop.

## Stop conditions

Stop if implementation would require a new AI invocation, a duplicated analysis
endpoint, client-side-only access protection, a shared cache containing
user-specific entitled content, a database change, or a frozen-module edit not
covered by an approved impact assessment.
