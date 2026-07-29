# Desktop documentation

## Sources and ownership

- `prompts/` preserves the original product brief verbatim.
- `specifications/` contains implementation contracts derived from that brief and grounded in the live parent repository.
- Future architecture decisions should live in `architecture/` as ADRs created by an approved specification task.
- `audits/` holds the Phase 1 parent inventories. Every artifact records the parent commit SHA it audited.

The original brief is an input. The approved specification contract is the authority for implementation scope and task order.

## Specifications

| Contract | Scope | Status |
|---|---|---|
| [`desktop-procurement-workspace/`](specifications/desktop-procurement-workspace/) | Phase 0 foundation + Phase 1 parent audit | **APPROVED, complete** — three items recorded as open blockers, all carried into Phase 2 |
| [`desktop-authenticated-shell/`](specifications/desktop-authenticated-shell/) | Phase 2 — authenticated shell vertical slice | **PENDING APPROVAL** — no implementation may begin |

## Phase 1 audit output

All artifacts are pinned to parent commit `8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1`
(`freelancing-solutions/tendersa`, branch `aws-production-app`). Start with
[`audits/parent-baseline.md`](audits/parent-baseline.md), which records the baseline and why it
differs from the SHA originally named in `requirements.md`.

| Artifact | Contents |
|---|---|
| [`parent-baseline.md`](audits/parent-baseline.md) | Pinned baseline, drift disclosure, measured audit surface |
| [`model-inventory.md`](audits/model-inventory.md) | Canonical models, fields, ownership, sensitivity, gaps |
| [`auth-subscription-contract.md`](audits/auth-subscription-contract.md) | Native auth decision record; see also [`architecture/auth.md`](architecture/auth.md) |
| [`endpoint-inventory.md`](audits/endpoint-inventory.md) | 16 Phase-2-relevant endpoints and OpenAPI drift |
| [`domain-mappings.md`](audits/domain-mappings.md) | Nine domains × source, endpoint, projection, provenance, access |
| [`workspace-gap-report.md`](audits/workspace-gap-report.md) | 47 classified gaps; ten parent proposals |
| [`phase-2-plan.md`](audits/phase-2-plan.md) | The plan this Phase 2 contract was written from |
| [`deferred-phase-0-precheck-resolutions.md`](audits/deferred-phase-0-precheck-resolutions.md) | The three deferred Phase 0 pre-checks, resolved |

Two things worth knowing before reading them:

- **The desktop consumes the main application's parent-internal API**, never the public
  Developer API at `api.tenders-sa.org`. The pinned `tenders-sa-developer-api-v2.1.0-openapi.json`
  is retained only as INT-6 drift evidence and is not a source of desktop types.
- [`audits/PHASE_1_SESSION_HANDOFF.md`](audits/PHASE_1_SESSION_HANDOFF.md) is a **historical
  working note**, not an audit artifact. Phase 1 is complete and its blockers are resolved; the
  note is kept for provenance rather than deleted.
