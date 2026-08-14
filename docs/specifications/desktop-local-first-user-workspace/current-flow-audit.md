# Current Flow Audit

## Ownership matrix

| Data/operation | Current read/write owner | Local implementation now | Sensitivity | Cache/replay decision |
|---|---|---|---|---|
| All Tender queries | `TendersEndpoint.list` called by `TenderList` | none | commercial discovery | cache by owner + canonical query; SWR |
| Radar recommendations | `RecommendationsEndpoint.list` called by `TenderList`/`TenderRadar` | none | company-derived | encrypted owner query cache; SWR |
| Tender detail, document inventory and analysis | `TendersEndpoint.get` called by `TenderDetail`, `UnderstandStage`, viewer route | none | tender analysis | encrypted owner entity cache; SWR |
| Tender document bytes | `DocumentsEndpoint.downloadTenderDocument` called by viewer | `local_file_references` table exists but has no repository/consumer | official tender files | persistent owner workspace file; inventory fingerprint invalidation |
| Explicit document Download | same endpoint + `saveDownload` | user-selected destination | official tender files | never substitute workspace cache for explicit save |
| Application list/detail | `ApplicationsEndpoint.list/get` | none | commercially sensitive | encrypted owner query/entity cache; SWR |
| Cockpit/workspace support projections | application endpoint methods | none | company/application analysis | encrypted owner section caches; SWR |
| Response blueprint/generated documents | `getResponseBlueprint` | local draft is separate; no server projection cache | proposal content | encrypted owner cache plus existing draft overlay |
| Response typing | `DraftStage` | encrypted debounced `response_doc_drafts` | highly sensitive | preserve, add owner |
| Response Save | `saveResponseDocument` then offline queue on failure | versions + `sync_operations` | highly sensitive | reorder to local pending before remote |
| AI generation | parent mutation | never queued | highly sensitive | remote-only; retain local edits |

## Confirmed implementation defect

`src-tauri/src/db/mod.rs` registers migrations 0001 and 0002 only. Migration `0003_response_doc_drafts.sql`, although tested through mocked repositories, is not registered with `tauri-plugin-sql`; a clean production database therefore cannot create the draft/version tables. T2 must register 0003 before adding 0004 and cover the real ordered migration list.

## Cacheability rules

- Cache only validated endpoint projections, never transport responses containing credentials or resolved raw download URLs.
- Encrypt every owner-specific recommendation, application, analysis, blueprint, draft, sync and conflict payload.
- Public tender list projections may still be encrypted for uniform owner isolation.
- Only response-document save currently has a proven idempotent queued mutation contract.

## Parent limitations

- Document metadata has no guaranteed checksum/ETag/version; use the safest available metadata fingerprint and identity-only fallback.
- Response save exposes no server compare-and-swap/version precondition. Local conflict preservation is implementable, but race-free server CAS cannot be claimed or invented.
- Session exposes user ID, not a confirmed company ID; v1 workspace isolation is per signed-in user.
