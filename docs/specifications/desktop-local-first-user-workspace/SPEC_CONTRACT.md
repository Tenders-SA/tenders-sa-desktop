# Desktop Local-First User Workspace — SPEC CONTRACT

- **Status:** `PENDING USER APPROVAL`
- **Implementation authorized:** no
- **Approach:** enhance existing desktop SQLite/cache/sync/document/draft infrastructure
- **Remote authority:** existing Tenders-SA parent APIs remain canonical
- **Parent changes:** prohibited

## Contract checklist

| Task | State | Binding outcome |
|---|---|---|
| T1 | BLOCKED | Complete evidence-backed flow/cacheability audit. |
| T2 | BLOCKED | Additive, lossless account-ownership migration. |
| T3 | BLOCKED | Session-derived safe workspace activation and isolation. |
| T4 | BLOCKED | Owner-scoped encrypted cache with stale/retention semantics. |
| T5 | BLOCKED | Central query keys, policies, SWR and single-flight coordinator. |
| T6 | BLOCKED | Tender and Radar lists render cached data immediately. |
| T7 | BLOCKED | Tender details/analysis remain available offline after access. |
| T8 | BLOCKED | Authenticated document bytes cached atomically by stable IDs. |
| T9 | BLOCKED | Viewer prefers workspace bytes; explicit Download unchanged. |
| T10 | BLOCKED | Application projections render locally then refresh. |
| T11 | BLOCKED | Existing response save becomes local-before-remote in all connectivity states. |
| T12 | BLOCKED | One owner-scoped coordinator replays only allowlisted idempotent saves. |
| T13 | BLOCKED | Conflicts preserve both encrypted versions and require explicit resolution. |
| T14 | BLOCKED | Honest, subtle shared freshness/sync UX. |
| T15 | BLOCKED | Security review, changelog, gates and human verification. |

## Non-negotiable constraints

- No second database, cache, draft system, sync queue, HTTP client or document fetch path.
- No optional owner parameter and no global cache fallback after authentication.
- No credentials, email addresses or raw server filenames in paths.
- No document byte TTL refresh.
- No silent local overwrite or false “Synced” claim.
- No queued AI generation or other unproven/non-idempotent mutation.
- No parent repository modification.

## Approval gate

The user must approve this contract before T1 implementation work begins. Any change to auth contracts, parent APIs, queue allowlist, conflict semantics or destructive migration behavior requires a new explicit approval checkpoint.

