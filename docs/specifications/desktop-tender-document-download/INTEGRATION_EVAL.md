# Desktop — Tender Document Download — INTEGRATION_EVAL (Slice 7)

- **Status**: pending
- **Spec**: `desktop-tender-document-download/` (requirements R-D1..R-D8,
  design, tasks)

## Gates

| Gate | Task | Evidence | Date |
|---|---|---|---|
| Transport absolute-URL tests | T1 | `vitest transport-download` — 22/22: absolute fetch, origin guard (verbatim/worker allowed; http/foreign/unparsable rejected pre-fetch), keyless, never-retry, 120s timeout override, external 401 does NOT fire session loss, path 401 still does | 2026-08-09 |
| Endpoint resolve-then-fetch | T2 | `vitest module-endpoints` — 92/92 total: downloadTenderDocument resolves via `download-url?requireR2=1`, fetches keyless with `retry: "never"`/`timeoutMs: 120_000`; filename precedence Content-Disposition > fileName > derived extension; 403 `DOCUMENT_DOWNLOAD_ENTITLEMENT_REQUIRED`, 404, no-retry | 2026-08-09 |
| Capability scope | T3 | `vitest capability-scope` — 18/18: three allowed origins (`api`, `docs/*`, `etenders-api/api/document*`), shell/opener/static-fs denied; Developer-API check uses exact-hostname match | 2026-08-09 |
| Screen tests | T4 | `vitest tender-detail` 22/22 + `module-screens` (4 workspace download cases): per-document Download button, save to picked path, disabled while downloading, silent dialog cancel, 403 plan-limit copy, server copy | 2026-08-09 |
| Full suite + static gates | T5 | `vitest` 674/674 (37 files), `tsc --noEmit` clean, `eslint .` clean, `prettier --check .` clean | 2026-08-09 |
| Fixtures + parity | T5 | `vitest endpoint-parity` 11/11 — `download-url` + `query: { requireR2: 1 }` pinned in documents.ts; Developer-API host guard now hostname-exact so `etenders-api.tenders-sa.org` is not a false positive; `api-clients.ts` gains `downloadTenderDocument: idle()` | 2026-08-09 |
| Live human verification | T6 | user downloads a real tender document from TenderDetail and from an application workspace; filename, dialog, silent cancel, 403 copy | — |
