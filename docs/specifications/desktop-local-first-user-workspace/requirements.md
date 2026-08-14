# Desktop Local-First User Workspace — Requirements

## Status and decision

- **Status:** `IMPLEMENTED — AUTOMATED GATES COMPLETE; MANUAL WINDOWS VERIFICATION PENDING`
- **Date:** 2026-08-14
- **Decision:** enhance the existing SQLite, cache, sync, encryption and response-document stores. Do not create a second database, draft store, API client or server contract.
- **Parent boundary:** the parent Tenders-SA checkout and backend are read-only. This work consumes only existing desktop endpoint contracts.

## Repository reality

The requested architecture partially exists:

- `src-tauri/migrations/0001_init.sql` already defines `cache_entries`, `local_file_references`, `sync_operations` and `sync_conflicts`.
- `src/services/storage/cache.ts` encrypts sensitive cache values, but no production tender or application read uses it.
- `src/services/storage/response-doc-store.ts` and migration `0003_response_doc_drafts.sql` already provide encrypted debounced drafts, versions and idempotent queued response-document saves.
- `DraftStage.tsx` already restores drafts and retries queued response-document saves, but replay is screen-owned and local records are not account-scoped.
- `TenderList`, `TenderDetail`, `ApplicationList`, `ApplicationWorkspace` and `TenderDocumentViewerRoute` remain network-first.
- `TenderDocumentViewer` calls `downloadTenderDocument` on every selection. No repository consumes `local_file_references`.
- `SessionSummary.userId` is available after authentication, but local tables and cache keys do not currently isolate data by workspace owner.

## Objective

Make previously accessed tenders, applications, analyses, response documents and tender files immediately usable from an account-isolated local workspace while the existing parent APIs remain canonical and refresh/sync in the background.

## Non-goals

- No parent endpoint, schema, storage bucket or authentication change.
- No local replacement for canonical tender/application records.
- No queuing of AI generation, application creation, submission, eligibility checks or other non-idempotent mutations.
- No localStorage or browser Cache API persistence.
- No periodic re-download of tender file bytes.
- No rewrite of the shipped response-document local-first implementation.

## Functional requirements

### LFW-1 — Account-isolated workspace identity

Every local cache row, file reference, draft, version, sync operation and conflict MUST belong to a stable workspace owner derived from the authenticated `SessionSummary.userId` through a deterministic safe identifier. Raw email addresses, credentials and untrusted strings MUST NOT become path segments.

The application data directory layout MUST be:

```text
workspace/<safe-owner-id>/documents/<tender-id>/<document-id>.<safe-extension>
workspace/<safe-owner-id>/cache/
workspace/<safe-owner-id>/exports/
```

Account switching MUST never return another owner's cached data. Logout MUST close the active workspace; deletion requires a separate explicit human action.

### LFW-2 — Additive migration and existing-data adoption

Add ownership/version metadata through ordered additive migrations. Existing unscoped rows MUST NOT be guessed into a newly signed-in account. They may be quarantined as legacy-local data or adopted only through a deterministic, documented rule that cannot cross accounts.

Migration tests MUST cover empty install, upgrade from migrations 0001–0003, retained data, uniqueness per owner, and cross-owner denial.

### LFW-3 — Central cache policy

One policy module MUST define freshness by entity type. Initial defaults:

| Entity | Freshness |
|---|---:|
| Tender list/search/filter query | 20 minutes |
| Radar/recommendation query | 20 minutes |
| Tender detail and document inventory | stale-while-revalidate, 30 minutes |
| Application list/detail/workspace/cockpit | stale-while-revalidate, 10 minutes |
| Blueprint and analysis projections | stale-while-revalidate, 10 minutes |
| Tender document bytes | persistent until inventory fingerprint changes |
| Drafts/versions/pending writes | no TTL |

Changing policy MUST not require editing React screens.

### LFW-4 — Canonical query keys

List cache keys MUST include owner, endpoint identity and a stable canonical encoding of every effective query parameter, including defaults, paging, filters, search and Radar inputs. Object property order MUST not produce distinct keys. Different queries MUST never overwrite one another.

### LFW-5 — Local-first read contract

A shared local-first query service MUST:

1. read and validate the owner's cached projection;
2. return it immediately when usable, including when stale;
3. refresh stale or forced queries through the existing endpoint in the background;
4. atomically replace the cache only after the new payload validates;
5. retain the last valid cache when refresh fails or cache data is corrupt;
6. expose `fresh`, `stale`, `refreshing`, `offline`, and `refresh-failed` metadata without treating stale data as an error.

Concurrent consumers of the same key MUST share one in-flight refresh. Manual refresh MUST bypass freshness while retaining cached content during the request.

### LFW-6 — Tender and Radar lists

All Tenders, filters/search and Radar/recommendation results MUST use LFW-5. Cached results render before network completion. Pagination metadata is cached with the items. An offline empty state MUST distinguish “never downloaded” from “no matching results.”

### LFW-7 — Tender detail and analysis

The complete validated `TenderDetail` projection, including document inventory and analysis, MUST be encrypted at rest and available offline after one successful visit. A background refresh MUST not blank the screen. Replacement SHOULD compare parent `updatedAt` when present; otherwise a validated payload fingerprint may detect change without inventing server version semantics.

### LFW-8 — Persistent tender documents

One `WorkspaceDocumentService` MUST own viewer bytes:

```text
open(owner, tenderId, documentMetadata)
  -> verified owner-local reference and file exists: return local bytes
  -> otherwise downloadTenderDocument(documentId)
  -> write atomically under the owner workspace using server IDs
  -> record metadata/fingerprint
  -> return cached bytes
```

Original filenames remain display metadata only. Paths MUST be constructed from validated/sanitized IDs and controlled extensions. Partial files MUST not become valid references. Download continues to use the existing save dialog and MUST NOT be redirected to the workspace cache.

### LFW-9 — Document freshness limitation

The existing tender detail contract exposes document identity plus optional filename, MIME type, size, processing state and processed timestamp, but no guaranteed checksum/ETag/version. Until that changes, compute the safest inventory fingerprint from available stable metadata. A changed fingerprint marks the local copy stale; an unchanged fingerprint avoids a byte download. The limitation MUST be documented in UI/help text only where relevant and MUST NOT cause periodic byte downloads.

### LFW-10 — Application projections

Application lists, complete application detail, cockpit/workspace state, response blueprint and relevant analysis/reference payloads MUST use account-isolated encrypted projections. Screens render the newest internally consistent local snapshot first and refresh active data in the background. Related calls may be cached independently, but UI MUST identify partial/stale sections honestly.

### LFW-11 — Preserve and strengthen local-first drafts

The existing response document store remains canonical locally. Save MUST be ordered:

1. encrypted local draft persisted;
2. previous content versioned;
3. idempotent pending save upserted;
4. remote `saveResponseDocument` attempted;
5. operation marked complete and draft cleared only after success.

This ordering applies even while online. A crash between steps MUST leave recoverable local content. Existing drafts, versions and queued operations MUST gain workspace ownership without losing data. AI regeneration MUST remain blocked by unsaved or pending local content unless the user explicitly resolves it.

### LFW-12 — Controlled sync coordinator

One application-level coordinator MUST own connectivity-triggered replay, bounded backoff, single-flight refresh and active-query registration. Screens may register interest or request refresh; they MUST NOT create independent polling timers or general queue loops.

Only operations with proven idempotency/replay semantics may enter the queue. Response-document save is initially allowlisted. Queue error text MUST be redacted and bounded.

### LFW-13 — Conflict preservation

If remote response content changed since the local base while a local edit or pending save exists, preserve both encrypted versions in the existing `sync_conflicts` infrastructure and mark the operation conflicted. No refresh, save retry or AI regeneration may silently choose a winner. An explicit resolution UI MUST support keep local, keep remote and merge/edit where the format permits.

### LFW-14 — Workspace status UX

Shared status presentation MUST distinguish:

- Synced
- Saved locally / pending sync
- Syncing
- Offline (showing saved copy)
- Update available or stale
- Sync failed
- Conflict needs review

The normal cached/fresh case should remain quiet. Status copy MUST never claim remote success after only a local write.

### LFW-15 — Corruption and filesystem recovery

Invalid JSON, decryption failure, missing files, fingerprint mismatch and interrupted writes MUST degrade to the existing authenticated network path when online. Corrupt entries are quarantined or invalidated without deleting a separate valid draft/version. Offline failures provide a recoverable message rather than an empty crash.

## Security and privacy requirements

- Sensitive tender, application, analysis, draft, conflict and sync payloads are encrypted through the existing native encryption boundary.
- Credentials/tokens never enter SQLite, cache payloads, file metadata or logs.
- Logs contain IDs/statuses only; never file contents, proposal text, pricing or decrypted payloads.
- Every repository operation requires an explicit owner ID; there is no optional/global owner fallback.
- Filesystem access remains confined to the Tauri app data workspace and explicit user-selected download/export locations.

## Integration requirements

- Existing endpoint classes remain the only remote transport owners.
- Existing Zod endpoint schemas validate both remote payloads and decoded cache payloads.
- `cache_entries`, `local_file_references`, `sync_operations`, `sync_conflicts`, `response_doc_drafts` and `response_doc_versions` are extended, not duplicated.
- The existing consolidated Tender Analysis Workbench and internal document viewer remain presentation owners.
- Parent backend and parent checkout remain unchanged.

## Success criteria

- Cached lists/details/applications render before a delayed network response.
- Offline revisits work after one successful access.
- A tender document is downloaded once, reused locally, and invalidated only when its available metadata fingerprint changes.
- Saving a response document creates recoverable local/pending state before the remote call.
- A restart restores exact drafts and resumes allowlisted sync.
- Conflicting local/remote response content preserves both versions.
- Switching users cannot observe another user's rows, paths or file bytes.
- Corrupt local state falls back safely without destroying unrelated valid content.
