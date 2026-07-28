# Desktop documentation

## Sources and ownership

- `prompts/` preserves the original product brief verbatim.
- `specifications/` contains implementation contracts derived from that brief and grounded in the live parent repository.
- Future architecture decisions should live in `architecture/` as ADRs created by an approved specification task.
- Phase 1 model, endpoint, and gap inventories should live in `audits/` and must record the parent commit SHA they audited. Before starting Phase 1, read [`audits/PHASE_1_SESSION_HANDOFF.md`](audits/PHASE_1_SESSION_HANDOFF.md) — it records why Phase 1 needs a session with parent-repository access and which Phase 0 pre-checks were deferred into it.

The original brief is an input. The approved specification contract is the authority for implementation scope and task order.
