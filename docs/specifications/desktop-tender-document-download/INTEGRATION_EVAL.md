# Desktop — Tender Document Download — INTEGRATION_EVAL (Slice 7)

- **Status**: pending
- **Spec**: `desktop-tender-document-download/` (requirements R-D1..R-D8,
  design, tasks)

## Gates

| Gate | Task | Evidence | Date |
|---|---|---|---|
| Transport absolute-URL tests | T1 | `vitest transport-download` — absolute fetch, origin guard, keyless, never-retry, timeout | — |
| Endpoint resolve-then-fetch | T2 | `vitest module-endpoints` — downloadTenderDocument, filename precedence, 403/404 mapping | — |
| Capability scope | T3 | `vitest capability-scope` — scoped origins allowed, shell/opener/static-fs denied | — |
| Screen tests | T4 | `vitest tender-detail` + `module-screens` — per-document button, downloading, saved, silent cancel, 403 + generic copies | — |
| Full suite + static gates | T5 | `vitest` (all), `tsc --noEmit`, `eslint .`, `prettier --check .` — 0 errors | — |
| Fixtures + parity | T5 | `vitest module-endpoints endpoint-parity` — `download-url` + `requireR2` pinned, fixtures stubbed | — |
| Live human verification | T6 | user downloads a real tender document from TenderDetail and from an application workspace; filename, dialog, silent cancel, 403 copy | — |
