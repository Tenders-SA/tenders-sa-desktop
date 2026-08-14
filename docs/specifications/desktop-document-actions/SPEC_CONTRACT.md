# Desktop — Document Actions — SPEC_CONTRACT (Slice 8)

- **Status**: `COMPLETE — INTERNAL VIEWER AMENDMENT`
- **Date**: 2026-08-09
- **Scope**: document opening, Document Vault download, and batch tender-document download.
- **Approved by**: user — “proceed all tasks approved”, with government fallback explicitly excluded.
- **Internal viewer amendment approved by**: user task on 2026-08-14. This
  supersedes tender-document OS Open while retaining authenticated Download.
- **Permanent scope decision**: on 2026-08-09 the user confirmed government/source
  fallback must remain skipped permanently. It is rejected scope, not backlog.

## Contract checklist (mirrors tasks.md)

| # | Item | Contract |
|---|---|---|
| T1 | Native foundation — DONE | Opener plugin + shared saved-path outcome + injectable temp-open/directory port; only directory picker and `$TEMP/tenders-sa/**` write/open-path capability expansion. Evidence: 28 targeted tests, TypeScript and `cargo check` pass. |
| T2 | Open action — DONE | Existing per-document component gains explicit Open with `Opening…`, single-flight, existing resolver, temp copy, OS viewer and safe errors. Evidence: TenderDetail and ApplicationWorkspace screen tests pass. |
| T3 | Vault download — DONE | Existing shared Download control mounted per company document; upload remains web-only. Evidence: Vault save, cancel and failure screen tests pass. |
| T4 | Batch download — DONE | Shared sequential coordinator/button on TenderDetail + ApplicationWorkspace; one directory choice, collision safety, progress, cancel and partial-failure honesty. Evidence: coordinator and both screen suites pass. |
| T5 | Gates/docs — DONE | Full frontend/Rust gates plus capability/parity regression coverage; task/contract/eval synchronized. Evidence: all 689 tests pass together; TypeScript, ESLint, Prettier, Rust and diff checks pass. |
| T6 | Human verification — DONE | User confirmed all Open, Vault save, batch save, duplicate-name, cancel and partial-failure behaviors work correctly. |
| T7 | Internal viewer contract — DONE | One route, existing byte contract and per-document analysis ownership pinned. |
| T8 | Viewer implementation — DONE | Three-pane PDF/fallback viewer with selected-document analysis and collapsible rails. |
| T9 | Open migration — DONE | Tender Detail, Application Workspace and Draft references route internally; Download remains unchanged. |
| T10 | Viewer hardening — DONE | Accessible controls, request/render cleanup, missing-id recovery and route/component coverage. |
| T11 | Gates/docs — DONE | Changelog plus Prettier, TypeScript, ESLint, Rust and diff checks pass; the full 844-test run had one known DraftStage timeout and that complete 19-test file passed immediately on isolated rerun. |

## Non-negotiable constraints

- `DocumentsEndpoint.downloadTenderDocument` remains the only resolver/fetch path.
- No government/source URL fallback, now or as follow-up work; no new HTTP origin, parent route, schema, auth,
  payment, or document-analysis change.
- No URL opener, shell permission, wildcard path, or arbitrary static filesystem scope.
- Tender-document Open means internal viewer navigation. Do not retain a second
  OS-launch Open action or fetch a raw/source URL.
- Batch is sequential and never overwrites a duplicate filename.
- No `npm run build`, `next build`, or Prisma command.

## Commit format

`feat(document-actions/TN): <description>` with requirements and spec reference in
the commit body.
