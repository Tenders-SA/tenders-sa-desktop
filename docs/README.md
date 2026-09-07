# Desktop documentation

## Sources and ownership

- `prompts/` preserves the original product brief verbatim.
- `specifications/` contains implementation contracts derived from that brief and grounded in the live parent repository.
- Future architecture decisions should live in `architecture/` as ADRs created by an approved specification task.
- `audits/` holds the Phase 1 parent inventories. Every artifact records the parent commit SHA it audited.

The original brief is an input. The approved specification contract is the authority for implementation scope and task order.

## Specifications

All contracts below are **APPROVED** unless noted otherwise; "IMPLEMENTED" means
the code is in the repository and verified. Contracts without a
`SPEC_CONTRACT.md` are scoped refinements approved by user directive with a
single `spec.md`.

| Contract | Scope | Status |
|---|---|---|
| [`desktop-procurement-workspace/`](specifications/desktop-procurement-workspace/) | Phase 0 foundation + Phase 1 parent audit | **APPROVED, complete** — three items recorded as open blockers, all carried into Phase 2 |
| [`desktop-authenticated-shell/`](specifications/desktop-authenticated-shell/) | Phase 2 — authenticated shell, then the workflow modules | **IMPLEMENTED** — authentication is on by default |
| [`desktop-tenders-nav-item/`](specifications/desktop-tenders-nav-item/) | Tender discovery navigation item | **IMPLEMENTED** |
| [`desktop-tender-radar-parity-refactor/`](specifications/desktop-tender-radar-parity-refactor/) | Tender Radar parity with the web decision workspace | **IMPLEMENTED** |
| [`desktop-visual-command-centre/`](specifications/desktop-visual-command-centre/) | Command Centre visual workbench (activity timeline, attention items) | **IMPLEMENTED** |
| [`desktop-command-centre-workbench/`](specifications/desktop-command-centre-workbench/) | Command Centre workbench refinement (spec.md) | **IMPLEMENTED** |
| [`desktop-company-opportunity-desk/`](specifications/desktop-company-opportunity-desk/) | Company-specific matched/scored tender browsing (spec.md) | **IMPLEMENTED** |
| [`desktop-opportunity-assessment-queue/`](specifications/desktop-opportunity-assessment-queue/) | Opportunities screen fix + shortlist queue (spec.md) | **IMPLEMENTED** |
| [`desktop-workspace-cockpit/`](specifications/desktop-workspace-cockpit/) | Application workspace cockpit | **IMPLEMENTED — live verification complete** |
| [`desktop-workspace-additional-info/`](specifications/desktop-workspace-additional-info/) | Workspace additional-info panels | **IMPLEMENTED** |
| [`desktop-workspace-deep-analyse-enrichment/`](specifications/desktop-workspace-deep-analyse-enrichment/) | Workspace deep-analyse enrichment | **IMPLEMENTED** |
| [`desktop-workspace-response-blueprint/`](specifications/desktop-workspace-response-blueprint/) | Response blueprint in the Draft stage | **IMPLEMENTED** |
| [`desktop-workspace-response-doc-authoring/`](specifications/desktop-workspace-response-doc-authoring/) | Response-document authoring (full-screen editor) | **IMPLEMENTED — live verification complete** |
| [`desktop-workspace-response-doc-authoring-enhancements/`](specifications/desktop-workspace-response-doc-authoring-enhancements/) | Batch generate, composer, list statuses | **IMPLEMENTED** |
| [`desktop-workspace-response-doc-editor-hardening/`](specifications/desktop-workspace-response-doc-editor-hardening/) | Editor hardening (honest failures, recovery) | **IMPLEMENTED** |
| [`desktop-workspace-response-doc-local-first-drafting/`](specifications/desktop-workspace-response-doc-local-first-drafting/) | Local-first drafting (version history, offline save queue) | **IMPLEMENTED** |
| [`desktop-workspace-export-response-package/`](specifications/desktop-workspace-export-response-package/) | PDF/Word response package export | **IMPLEMENTED** |
| [`desktop-tender-assistance-workflow/`](specifications/desktop-tender-assistance-workflow/) | Tender application assistance workflow | **IMPLEMENTED** (incl. dynamic-document + WYSIWYG amendments) |
| [`desktop-tender-analysis-workbench/`](specifications/desktop-tender-analysis-workbench/) | Tender analysis workbench | **IMPLEMENTED** |
| [`desktop-company-profile-full-record/`](specifications/desktop-company-profile-full-record/) | Complete company record read (CIDB, experience, personnel) | **IMPLEMENTED** |
| [`desktop-company-profile-studio/`](specifications/desktop-company-profile-studio/) | Company profile section-based editing (spec.md) | **IMPLEMENTED** |
| [`desktop-document-actions/`](specifications/desktop-document-actions/) | Tender document actions (open/download) | **COMPLETE** — internal viewer amendment |
| [`desktop-tender-document-download/`](specifications/desktop-tender-document-download/) | Tender document download | **IMPLEMENTED** |
| [`desktop-document-downloads-destination/`](specifications/desktop-document-downloads-destination/) | Document download destination control | **PENDING APPROVAL** |
| [`desktop-supplier-profile/`](specifications/desktop-supplier-profile/) | Supplier Intelligence + supplier profile detail | **IMPLEMENTED** |
| [`desktop-procurement-officer-directory/`](specifications/desktop-procurement-officer-directory/) | Procurement Officers directory (local index, corrections) | **IMPLEMENTED** |
| [`desktop-local-first-user-workspace/`](specifications/desktop-local-first-user-workspace/) | Account-isolated local workspace, offline sync, conflicts | **IMPLEMENTED** — manual Windows verification pending |
| [`desktop-app-updater/`](specifications/desktop-app-updater/) | Signed automatic updates | **IMPLEMENTED** (T1–T8) |
| [`desktop-sidebar-brand-icons/`](specifications/desktop-sidebar-brand-icons/) | Sidebar icons + canonical brand mark (spec.md) | **IMPLEMENTED** |
| [`desktop-sign-in-brand-refinement/`](specifications/desktop-sign-in-brand-refinement/) | Sign-in brand refinement (spec.md) | **IMPLEMENTED** |

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
