# Desktop Local-First User Workspace — Design

## Status

`PENDING USER APPROVAL — NO IMPLEMENTATION AUTHORIZED`

## Architecture decision

Enhance the existing local infrastructure behind one composition-root workspace. React features consume local-first ports; they do not call SQLite or filesystem plugins directly.

```text
React screen
  -> LocalFirstQuery / WorkspaceDocument / LocalMutation ports
       -> existing repositories + native crypto + app-data filesystem
       -> BackgroundWorkspaceCoordinator
            -> existing endpoint clients
```

The parent remains canonical. A local projection is usable workspace state, not an independent business record.

## Existing implementation retained

| Existing owner | Reuse |
|---|---|
| `src/db/executor.ts`, `tauri-sql-executor.ts` | all structured persistence |
| `src/db/repositories/cache-entries.ts` | owner-scoped entity/query cache |
| `src/services/storage/cache.ts` | encrypted payload serialization |
| `sync-operations.ts`, `services/sync/*` | queue transitions, backoff and conflicts |
| `response-doc-*` repositories/store | drafts, versions and response-save replay |
| `DocumentsEndpoint.downloadTenderDocument` | only authenticated document byte source |
| Endpoint Zod schemas | remote and cached projection validation |
| `TenderDocumentViewer` | presentation and PDF rendering |

## Workspace ownership

Introduce `WorkspaceOwnerId`, constructed only after a valid `SessionSummary` exists. Use a deterministic SHA-256 digest of the canonical `userId`, encoded as lowercase hex/base32 and prefixed with a schema version. Do not use email. The digest is path-safe and avoids exposing raw identity in filesystem paths.

The active workspace is created/closed in `AuthenticatedApp` when session identity changes. Endpoint clients remain session-agnostic; local services receive the owner explicitly through an `ActiveWorkspace` provider.

## Additive schema direction

Migration `0004_local_workspace_ownership.sql` should:

- add owner-aware replacement tables where SQLite cannot safely add a required column;
- copy legacy rows into a quarantined legacy owner rather than an authenticated owner;
- preserve all source rows during copy/rename;
- establish composite uniqueness/indexes beginning with `owner_id`;
- extend file references with tender ID, document fingerprint, content type, cache state and updated timestamp;
- add base-version/fingerprint fields needed for response conflict detection.

No drop occurs until copied row counts and migration tests prove parity. If SQLite table rebuild is used, it occurs transactionally inside the migration.

## Cache keys and policy

Create:

- `cache-policy.ts`: central per-entity TTL and persistence rules;
- `cache-key.ts`: stable sorted JSON query encoding plus owner/endpoint namespace;
- `workspace-cache.ts`: typed JSON encode/decode, encryption, validation and stale metadata;
- `local-first-query.ts`: cache-first/SWR orchestration and request deduplication.

`expires_at` means “stale after”, not “delete immediately”. Existing `pruneExpiredCache` semantics must change or be restricted: stale-while-revalidate entries remain readable until retention expiry. Store freshness and retention separately if necessary.

## Query lifecycle

```text
load(key)
  cached + valid -> emit immediately
  cached stale   -> emit stale; schedule one refresh
  missing        -> fetch (or offline-unavailable)

refresh(key)
  deduplicate in-flight request
  endpoint validates response
  compare updatedAt/fingerprint
  transactionally persist encrypted projection
  notify active subscribers
```

The service exposes subscribe/getSnapshot semantics suitable for React without making React the cache owner. A small hook adapter may use `useSyncExternalStore`.

## Background coordinator

One coordinator is started by `AuthenticatedApp` after workspace activation and stopped before account change/logout. It owns:

- online-event response-save replay;
- active stale query refresh;
- single-flight map;
- bounded concurrency and exponential backoff;
- aborting owner A work before owner B activates;
- redacted status events.

No global interval scans all cached entities. A low-frequency maintenance pass may prune beyond-retention data and missing file references.

## Document workspace

Add an injectable native file port that resolves the app data directory and supports atomic write/read/existence/remove operations. `WorkspaceDocumentService` constructs paths solely from safe owner/tender/document IDs and a MIME-derived allowlisted extension.

The service validates the file reference owner, fingerprint and existence before reading. New downloads write `*.partial`, then atomically rename and commit the reference. A crash leaves an unreferenced partial file eligible for maintenance cleanup.

Document fingerprint input, in priority order:

1. server checksum/ETag/version if a future existing payload exposes one;
2. document ID + file size + MIME type + processed timestamp + filename;
3. document ID alone, explicitly marked `identity-only`.

The service never probes raw source/download URLs and never refreshes bytes solely because a TTL elapsed.

## Application snapshots

Use independent validated cache records for list, detail, cockpit, blueprint and supporting projections. A screen may show a complete last-known detail while a cockpit panel refreshes independently. Cache metadata exposes section freshness so partial refresh failure does not invalidate unrelated cached sections.

## Draft save ordering and conflict base

Refactor the existing store orchestration, not its repositories, so every explicit Save first persists/snapshots/upserts pending operation in one local transaction where feasible. The pending payload includes the last confirmed remote content fingerprint. Replay fetches/uses current remote projection when the existing contract makes comparison possible; mismatch records both encrypted versions and stops replay.

Where the parent contract cannot provide an authoritative precondition or version token, the spec must not claim race-free server CAS. The desktop still prevents silent local overwrite and records the limitation. No parent endpoint is invented.

## Impact map

| Area | Expected change | Risk |
|---|---|---:|
| migrations/schema mirrors | owner scoping, file/cache/conflict metadata | high |
| auth composition root | activate/close owner workspace | high |
| cache/sync/storage services | extend existing owners | high |
| tender/radar/application hooks | replace network-first orchestration with shared local-first adapter | medium |
| document viewer | source bytes through workspace service | medium |
| DraftStage/store | enforce local-before-remote ordering and central replay | high |
| status UI | shared freshness/sync metadata | low |

## Route impact

- `/tenders`, `/radar`, `/tenders/:tenderId`
- `/tenders/:tenderId/documents/:documentId`
- `/applications`, `/applications/:applicationId/*`
- `/applications/:applicationId/draft/:documentKey`

No route shape or parent API path changes.

## Frozen-module assessment

The parent repository is untouched. The desktop repository is not listed in the parent immutable registry. Authentication contracts remain unchanged; only session-derived `userId` is consumed locally. Any discovery that company-level sharing requires a company ID not exposed by the existing session must stop at a documented limitation—do not add a parent endpoint under this spec.

## Rollout

1. ownership migration and workspace activation;
2. shared cache/key/policy primitives;
3. tender lists and detail;
4. document workspace;
5. application projections;
6. draft ordering, central replay and conflicts;
7. status UX and maintenance.

Each slice is independently gated and may ship behind a desktop feature flag. Rollback disables new reads/replay while retaining additive local data; it never deletes user drafts.

## Verification strategy

- Real SQLite migration tests, including multi-owner fixtures.
- Repository tests for owner parameter binding and corrupt payload handling.
- Service tests with fake clock/network/filesystem for SWR, dedupe and atomic documents.
- Component tests for immediate cached rendering and honest stale/offline status.
- Restart/account-switch tests through the composition root.
- Existing response editor, viewer, routing, download and API endpoint suites remain green.
- Required gates: `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm rust:check`, `git diff --check`. Build remains user-only under repository governance.

