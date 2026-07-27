# ADR: Structured Logging and Redaction (TASK-0.11)

- **Status**: accepted
- **Refs**: REQ-8, OPS-1, PRIV-1

## Pre-check: what can fail in Phase 0

Error boundaries and failure paths inventoried before designing:

| Surface | Failure type | Can carry sensitive data? |
|---|---|---|
| `components/common/ErrorBoundary` | Any React render error | Yes — message may quote payload/pricing |
| `services/api/errors` `ApiError` | 401/403/404/429/5xx, offline, timeout, cancelled, malformed | Yes — response bodies |
| `services/auth/ports` `AuthError` | disabled, invalid-credentials, network, contract-unconfirmed | Yes — credentials |
| `services/sync/state-machine` `InvalidTransitionError` | Illegal queue transition | Operation metadata |
| `services/sync/ordering` `DependencyCycleError` | Cyclic dependencies | Operation IDs |
| `app/config/load-config` `ConfigError` | Invalid/missing config | Environment values |
| Native `session_store`/`session_load`/`session_clear` | `SecurityError` | Yes — tokens |
| Native `encrypt_value`/`decrypt_value` | `SecurityError` | Yes — plaintext |
| `tauri-plugin-sql` | SQL/migration errors | Yes — row content |

TASK-0.4 and TASK-0.7 already ensured their own error *types* carry no
secrets. This task covers what happens when those errors, or arbitrary
context, are handed to a logger.

## Redact by default, not by denylist

`src/services/observability/redaction.ts` keeps a field only when its
key is on a short **allowlist** of operational keys (`status`, `code`,
`requestId`, `durationMs`, `attempt`, …). Everything else becomes
`[redacted]` in `strict` mode.

This direction is the whole point. A denylist of "sensitive-looking"
key names silently leaks every field nobody thought of — and this
application handles tender pricing, document content, and personal
data, where one missed field is a real disclosure. An allowlist fails
closed: a new field added by a future call site is redacted until
someone deliberately classifies it as safe.

Two mechanisms layer on top:

- **`ALWAYS_REDACT`** key pattern (`token|password|secret|credential|
  authorization|api_key|…`) drops values regardless of mode or
  allowlist — so `standard` mode cannot expose credentials either.
- **Value-level scrubbing** catches sensitive content in otherwise-safe
  fields: bearer tokens, JWTs, `tsa_prod_*` API keys, email addresses,
  13-digit SA ID numbers, rand amounts, and card-like digit runs.

`Error` instances are reduced to `{ name, message: "[redacted]" }`.
An error message routinely quotes the thing that failed — a filesystem
path, a response body, a pricing figure — so the class name is the only
part worth keeping.

`standard` mode keeps scrubbed values for unknown keys, which is
genuinely useful when debugging locally. It is **not** the production
default: TASK-0.3's config defaults `telemetry.redactionMode` to
`strict`.

## The Rust side redacts again

`src-tauri/src/observability/` re-redacts every event received over
IPC before writing it. The webview already redacts, so this is
duplicated work by design: the IPC boundary is exactly where "the
caller already sanitised it" stops being a safe assumption. A future
call site that bypasses `Logger`, or a bug in the TypeScript redactor,
would otherwise write unredacted tender content to disk.

The native side accepts **flat string pairs**, not arbitrary JSON.
Accepting nested structures would mean maintaining a second full
recursive scrubber in Rust, with two implementations to keep in sync;
flattening in the webview avoids that entirely. Fields are also
truncated to 2 KiB and the event name is length-validated.

The Rust scrubber is hand-rolled rather than regex-based: the patterns
are few and fixed, and it keeps the dependency surface of a
security-adjacent path small.

## Sink and fallback

`nativeSink` forwards to the `log_event` command. If the native bridge
is unavailable — browser dev server, tests — it falls back to the
console rather than throwing. Losing a log line must never break the
application.

`log_event` writes JSON lines to stdout/stderr by level. A file sink
with rotation is an operational decision that belongs with packaging
(TASK-0.12 onward), not something to guess at now.

## User-visible errors stay generic

The error boundary's on-screen text is fixed and generic ("Something
went wrong… Your local data has not been changed") with a retry
action. Diagnostics go to the logger, not the screen — a crash screen
is exactly the thing users screenshot and paste into a ticket, so it
must not contain tender content.

`ApiError`'s user-facing messages come from the server's own `error`
string or a fixed local string, never a request body (see
`docs/architecture/api.md`).

## Verification

- 22 TypeScript tests: value patterns for all seven sensitive shapes,
  allowlist behaviour in both modes, credential keys dropped in both
  modes, `Error` reduction, nested/array handling, a recursion depth
  limit, and logger context/correlation/disabled behaviour.
- 13 Rust tests: independent re-redaction of bearer tokens, emails,
  JWTs, API keys, ID numbers and rand amounts, event-name validation,
  field truncation, and operational values surviving intact.

## Not built yet

No telemetry export, no crash reporting to a remote service, and no
log file rotation. Each involves sending data off the device, which
needs its own privacy decision and is out of scope for Phase 0.
