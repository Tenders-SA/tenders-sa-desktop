# Desktop — Document Actions — Tasks (Slice 8)

> Read `requirements.md`, `design.md`, `SPEC_CONTRACT.md`, and the repository
> execution protocol before code. Complete tasks in order; contract checklist and
> this list must remain identical.

## Status

- T1: DONE — native port, saved-path outcome, opener registration and scoped capabilities verified.
- T2: DONE — Open uses the existing resolver, scoped temp copy and per-document single-flight UI.
- T3: DONE — Document Vault rows use the shared Download control; upload remains website-only.
- T4: DONE — shared sequential Download all control is mounted in Tender Detail and Application Workspace.
- T5: DONE — full frontend/Rust gates and Slice 8 traceability records are complete.
- T6: DONE — user verified all live Open, Vault Download and Download all behaviors.
- T7: DONE — viewer route, byte/analysis ownership and Open migration pinned.
- T8: DONE — selected-document PDF/fallback preview and analysis panes shipped.
- T9: DONE — every tender Open consumer now navigates to the internal route.
- T10: DONE — accessibility, abort cleanup, missing-id and routing coverage added.
- T11: DONE — changelog and all permitted desktop gates completed.

## Tasks

| # | Task | Pre-check | Verification |
|---|---|---|---|
| T1 | Native document-action foundation: add opener dependency/registration; extend shared storage outcome with saved path; add injectable temp-open/directory port; capability grants exactly directory-open + `$TEMP/tenders-sa/**` write/open-path scope | Re-read current save port, capability assertions and Tauri registration | storage unit tests + capability-scope + `cargo check` |
| T2 | Open action: extend `DocumentDownloadButton` with optional Open, per-document `Opening…` single-flight, temp write + OS viewer, safe errors | T1 green; existing single-download tests green | tender-detail + module-screens Open cases |
| T3 | Document Vault: mount the existing shared Download control per company document; remove website-only download copy; keep upload out of scope | T2 green; confirm Vault already receives `DocumentsEndpoint` | Vault save/cancel/error tests |
| T4 | Batch download: add shared sequential coordinator/button, collision-safe filenames, one directory choice, progress and partial-failure summary; mount in TenderDetail and ApplicationWorkspace | T3 green; confirm screens use already-loaded document arrays | coordinator + both screen suites |
| T5 | Integration gates and documentation: fixtures/parity/capability checks, full Vitest, TypeScript, ESLint, Prettier, Rust; sync tasks/contract/eval | T4 green | zero gate errors; known app-boot flake rerun alone if needed |
| T6 | Human verification: Open launches a real document; Vault Download saves; Download all saves all files after one folder choice; duplicate names do not overwrite; cancel silent; partial failure honest | T5 shipped | recorded in `INTEGRATION_EVAL.md` |
| T7 | Characterize and specify one internal viewer route using the existing tender-detail and authenticated byte contracts | Re-read router, tender/document schemas and every Open consumer | contract fixture and route plan; no parent change |
| T8 | Implement the three-pane viewer, PDF page/zoom controls, unsupported fallback, selected-document analysis and collapsible rails | T7 complete; confirm packaged PDF renderer compatibility | focused rendering, selection, analysis and cleanup tests |
| T9 | Replace every tender OS Open action with internal viewer navigation; preserve Download and Vault behavior | T8 green; inventory all `DocumentDownloadButton` consumers | Tender Detail, workspace and Draft Open routing tests |
| T10 | Harden accessibility, stale-request cleanup, missing ids and pane-isolated errors | T9 green | keyboard/labels, abort/revoke and recovery tests |
| T11 | Update changelog/evaluation and run full desktop verification | T10 green; inspect complete diff | format, typecheck, lint, full Vitest, Rust, diff check |
