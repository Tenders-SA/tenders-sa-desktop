# Desktop — Tender Document Download — Tasks (Slice 7)

> Read `requirements.md` and `design.md` before starting. Complete tasks in
> order; the contract checklist (`SPEC_CONTRACT.md`) must mirror this list.

## Status (2026-08-09)

- T1: OPEN.
- T2: OPEN.
- T3: OPEN.
- T4: OPEN.
- T5: OPEN.
- T6: OPEN.

## Tasks

| # | Task | Pre-check | Verification |
|---|---|---|---|
| T1 | Transport: `DownloadOptions.url` — fetch a validated absolute URL (https, origin in the two allowed serving origins), no auth headers, no retry, extended timeout honoured; invalid URL → typed error | existing download tests green | `vitest transport-download` + new absolute-URL tests |
| T2 | Endpoint: extend `downloadUrlSchema` with `fileName`; add `downloadTenderDocument(documentId)` — resolve via `getDownloadUrl` then fetch the URL with `retry: "never"`, `timeoutMs: 120_000`; filename precedence CD > fileName > derived | T1 green | `vitest module-endpoints` new cases |
| T3 | Capability: add `https://docs.tenders-sa.org/docs/*` and `https://etenders-api.tenders-sa.org/api/document*` to `http:default`; update `capability-scope.test.ts` (scoped-only, shell/opener/static-fs still denied) | T2 green | `vitest capability-scope` |
| T4 | UI: `DocumentDownloadButton` + mount in `TenderDetail.DocumentsSection` and `ApplicationWorkspace` documents panel (optional props, default save port); wire `clients.documents` in both routes | T3 green | `vitest tender-detail` + `module-screens` new cases |
| T5 | Gates + docs: fixtures gain `downloadTenderDocument`; parity pins `download-url` + `requireR2`; full `vitest`, `tsc --noEmit`, `eslint .`, `prettier --check .`; update `tasks.md`/`INTEGRATION_EVAL.md`; commit + push | T4 green | zero errors |
| T6 | Human verification: user downloads a real tender document from TenderDetail and from an application workspace; checks filename, save dialog, silent cancel, and a 403 (plan without entitlement) copy | T5 shipped | recorded in `INTEGRATION_EVAL.md` |
