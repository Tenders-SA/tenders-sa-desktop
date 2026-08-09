# Desktop — Document Actions — Tasks (Slice 8)

> Read `requirements.md`, `design.md`, `SPEC_CONTRACT.md`, and the repository
> execution protocol before code. Complete tasks in order; contract checklist and
> this list must remain identical.

## Status

- T1: DONE — native port, saved-path outcome, opener registration and scoped capabilities verified.
- T2: OPEN.
- T3: OPEN.
- T4: OPEN.
- T5: OPEN.
- T6: OPEN — human verification.

## Tasks

| # | Task | Pre-check | Verification |
|---|---|---|---|
| T1 | Native document-action foundation: add opener dependency/registration; extend shared storage outcome with saved path; add injectable temp-open/directory port; capability grants exactly directory-open + `$TEMP/tenders-sa/**` write/open-path scope | Re-read current save port, capability assertions and Tauri registration | storage unit tests + capability-scope + `cargo check` |
| T2 | Open action: extend `DocumentDownloadButton` with optional Open, per-document `Opening…` single-flight, temp write + OS viewer, safe errors | T1 green; existing single-download tests green | tender-detail + module-screens Open cases |
| T3 | Document Vault: mount the existing shared Download control per company document; remove website-only download copy; keep upload out of scope | T2 green; confirm Vault already receives `DocumentsEndpoint` | Vault save/cancel/error tests |
| T4 | Batch download: add shared sequential coordinator/button, collision-safe filenames, one directory choice, progress and partial-failure summary; mount in TenderDetail and ApplicationWorkspace | T3 green; confirm screens use already-loaded document arrays | coordinator + both screen suites |
| T5 | Integration gates and documentation: fixtures/parity/capability checks, full Vitest, TypeScript, ESLint, Prettier, Rust; sync tasks/contract/eval | T4 green | zero gate errors; known app-boot flake rerun alone if needed |
| T6 | Human verification: Open launches a real document; Vault Download saves; Download all saves all files after one folder choice; duplicate names do not overwrite; cancel silent; partial failure honest | T5 shipped | recorded in `INTEGRATION_EVAL.md` |
