# Desktop Local-First User Workspace — SPEC CONTRACT

- **Status:** `IMPLEMENTED — MANUAL WINDOWS VERIFICATION PENDING`
- **Implementation authorized:** yes — user approved 2026-08-14
- **Approach:** enhance existing desktop SQLite/cache/sync/document/draft infrastructure
- **Remote authority:** existing Tenders-SA parent APIs remain canonical
- **Parent changes:** prohibited

## Contract checklist

| Task | State | Binding outcome |
|---|---|---|
| T1 | DONE | Complete evidence-backed flow/cacheability audit. |
| T2 | DONE | Additive, lossless account-ownership migration. |
| T3 | DONE | Session-derived safe workspace activation and isolation. |
| T4 | DONE | Owner-scoped encrypted cache with stale/retention semantics. |
| T5 | DONE | Central query keys, policies, SWR and single-flight coordinator. |
| T6 | DONE | Tender and Radar lists render cached data immediately. |
| T7 | DONE | Tender details/analysis remain available offline after access. |
| T8 | DONE | Authenticated document bytes cached atomically by stable IDs. |
| T9 | DONE | Viewer prefers workspace bytes; explicit Download unchanged. |
| T10 | DONE | Application projections render locally then refresh. |
| T11 | DONE | Existing response save becomes local-before-remote in all connectivity states. |
| T12 | DONE | One owner-scoped coordinator replays only allowlisted idempotent saves. |
| T13 | DONE | Conflicts preserve both encrypted versions and require explicit resolution. |
| T14 | DONE | Honest, subtle shared freshness/sync UX. |
| T15 | MANUAL GATE | Automated security/performance/changelog/full gates complete; human Windows verification remains. |

## Non-negotiable constraints

- No second database, cache, draft system, sync queue, HTTP client or document fetch path.
- No optional owner parameter and no global cache fallback after authentication.
- No credentials, email addresses or raw server filenames in paths.
- No document byte TTL refresh.
- No silent local overwrite or false “Synced” claim.
- No queued AI generation or other unproven/non-idempotent mutation.
- No parent repository modification.

## Approval gate

The user approved this contract on 2026-08-14. Any future change to auth
contracts, parent APIs, queue allowlist, conflict semantics or destructive
migration behavior requires a new explicit approval checkpoint.
