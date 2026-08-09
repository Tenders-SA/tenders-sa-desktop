# Desktop — Document Actions — SPEC_CONTRACT (Slice 8)

- **Status**: `APPROVED`
- **Date**: 2026-08-09
- **Scope**: document opening, Document Vault download, and batch tender-document download.
- **Approved by**: user — “proceed all tasks approved”, with government fallback explicitly excluded.

## Contract checklist (mirrors tasks.md)

| # | Item | Contract |
|---|---|---|
| T1 | Native foundation — DONE | Opener plugin + shared saved-path outcome + injectable temp-open/directory port; only directory picker and `$TEMP/tenders-sa/**` write/open-path capability expansion. Evidence: 28 targeted tests, TypeScript and `cargo check` pass. |
| T2 | Open action | Existing per-document component gains explicit Open with `Opening…`, single-flight, existing resolver, temp copy, OS viewer and safe errors |
| T3 | Vault download | Existing shared Download control mounted per company document; upload remains web-only |
| T4 | Batch download | Shared sequential coordinator/button on TenderDetail + ApplicationWorkspace; one directory choice, collision safety, progress, cancel and partial-failure honesty |
| T5 | Gates/docs | Full frontend/Rust gates plus capability/parity regression coverage; task/contract/eval synchronized |
| T6 | Human verification | Real Open, Vault save and batch save behaviors recorded |

## Non-negotiable constraints

- `DocumentsEndpoint.downloadTenderDocument` remains the only resolver/fetch path.
- No government/source URL fallback, new HTTP origin, parent route, schema, auth,
  payment, or document-analysis change.
- No URL opener, shell permission, wildcard path, or arbitrary static filesystem scope.
- Batch is sequential and never overwrites a duplicate filename.
- No `npm run build`, `next build`, or Prisma command.

## Commit format

`feat(document-actions/TN): <description>` with requirements and spec reference in
the commit body.
