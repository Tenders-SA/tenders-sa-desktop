# ADR: Local SQLite Cache and Repositories (TASK-0.5)

- **Status**: accepted
- **Refs**: REQ-6, REL-1, PRIV-1; design.md §Local SQLite Design

## Context

Phase 0 needs a local SQLite foundation before the sync engine
(TASK-0.6) and API transport (TASK-0.7) can build on it: an
offline-safe schema that is unambiguously local infrastructure (never
a duplicate parent domain owner), with tested migrations and
parameterized repositories.

## Pre-check: no table duplicates a parent domain owner

Every table in `src-tauri/migrations/0001_init.sql` matches design.md's
"Local SQLite Design" table and its "Canonical Ownership" table:

| Table | What it holds | Server authority |
|---|---|---|
| `cache_entries` | Cache metadata + payload (JSON or ciphertext), ETag, expiry | Parent owns the payload's source of truth; this is a cache, not a second copy of record |
| `recent_records` | Device-local recent navigation | None -- doesn't exist server-side |
| `local_preferences` | UI preferences | None unless a later spec adds sync |
| `local_file_references` | Local path/handle metadata linked to a parent document | Parent owns the uploaded document; this only stores a local pointer |
| `sync_operations` | Pending offline mutation queue | Local until the server accepts it |
| `sync_conflicts` | Local/remote version pairs pending resolution | Joint record, resolved by explicit action, never silently overwritten |

No table stores a full parent entity (tender, application, company,
etc.) as an independent source of truth -- `cache_entries` stores an
opaque payload keyed by `entity_type`/`entity_id`/`etag`, which is a
cache invalidation record, not a duplicate schema.

## Migration ledger

Design.md's local-data table also lists a `schema_migrations` table
("applied migration ledger"). This implementation does **not** create
one: `tauri-plugin-sql`'s `Builder::add_migrations` already tracks
applied migrations internally. Hand-rolling a second ledger alongside
the plugin's own would create two sources of truth for the same fact
and a real drift risk if they ever disagreed. `src-tauri/src/db/mod.rs`
documents this deviation at the call site.

## Testing migrations without a live Tauri runtime

`tauri-plugin-sql` only runs migrations inside a running Tauri
app/tokio context, which this test environment doesn't have. Instead,
`src-tauri/src/db/mod.rs`'s tests apply the *same* `include_str!`-ed SQL
files directly against a real in-memory SQLite database via `rusqlite`
(a lightweight, bundled, sync-only dependency added under
`[dev-dependencies]` only -- it never ships in the app). This is real
DDL execution, not a syntax-only check: it exercises the actual
`CHECK`/`UNIQUE`/`FOREIGN KEY` constraints and proves:

- both migrations apply cleanly to an empty database;
- 0002 applies cleanly on top of a fixture that only has 0001 applied
  (the "prior version" case TASK-0.5 asks for), without losing rows
  already present;
- `sync_operations.status` rejects a value outside the six defined
  states;
- `sync_operations.idempotency_key` rejects a duplicate.

## Repositories: parameterized, and testable without a live database

`src/db/executor.ts` defines a narrow `SqlExecutor` interface
(`execute`/`select`) that `src/db/tauri-sql-executor.ts` implements
over `@tauri-apps/plugin-sql`, and that repository functions
(`src/db/repositories/**`) depend on instead of the plugin directly --
the same pattern TASK-0.4 used for `SecretStore`. Tests inject
`src/tests/fakes/sql-executor.ts`, a spy that records the exact SQL
text and bound parameter array for every call. This proves the
"parameterized repositories" property design.md requires: values never
get string-interpolated into a query, they're always passed as bind
parameters (`db-repositories.test.ts` asserts this directly, e.g. a
cached tender title never appears inside the SQL string itself, only
in the params array).

Repositories are implemented for three of the six tables --
`cache_entries`, `local_preferences`, `sync_operations` -- the ones
this task and TASK-0.6 (offline sync) actually need. `recent_records`,
`local_file_references`, and `sync_conflicts` keep their schema and
migration (so the tables exist and are tested), but get their query
functions added by whichever task first consumes them (a future
navigation feature, a document-handling task, and TASK-0.6
respectively) -- consistent with design.md's "avoid empty architecture
theatre."

## Auth secrets cannot be persisted here

No repository or migration references an auth token or credential.
Session material stays exclusively in OS secure storage via TASK-0.4's
`session_store`/`session_load`/`session_clear` -- it never has a
column in this schema. `src/services/storage/cache.ts` provides a
`sensitive` flag for cache payloads that *do* need at-rest protection
(e.g. a cached response containing pricing): when set, the plaintext is
passed through TASK-0.4's `encrypt_value` native command before it
ever reaches a SQL parameter, and decrypted again via `decrypt_value`
on read. `storage-cache.test.ts` asserts the raw secret string never
appears in the recorded SQL call's parameters -- only the ciphertext
does.
