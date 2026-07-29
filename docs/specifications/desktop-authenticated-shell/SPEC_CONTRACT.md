# SPEC CONTRACT — Tenders-SA Desktop Authenticated Shell (Phase 2)

# Generated: 2026-07-29
# Status: APPROVED
# Approved by: mobiusndou@gmail.com on 2026-07-29

## CODER INSTRUCTIONS

This contract governs **Phase 2 only**: the authenticated shell vertical slice. Read
`requirements.md`, `design.md`, and `tasks.md` completely before implementation. Implement tasks
in order; do not combine or silently change them. Complete each pre-check and verification.
Mirror checklist changes here and in `tasks.md`.

Implementation is authorised. The user approved this specification on 2026-07-29 (gate G1).
Gates G2–G5 remain outstanding and still block what they name below.

This contract does not alter the Phase 0–1 contract at
`docs/specifications/desktop-procurement-workspace/SPEC_CONTRACT.md`, which remains APPROVED and
complete.

## FEATURE SUMMARY

Make the desktop client authenticate against the real Tenders-SA platform and render real data,
end to end. Route API transport through `tauri-plugin-http` so requests execute in Rust and are
not subject to browser CORS, supply an audited authentication adapter against the Phase 1
contract, activate the login shell, and render one authenticated read in the Command Centre.

The desktop is an **extension of the existing production web platform**. It adapts to that
platform's contracts as they are; the web application is not changed to accommodate it.

## KEY CONSTRAINTS

- Phase 2 only. Phases 3–13 require later specifications.
- No parent repository source changes, schema migrations, production data writes, or
  frozen-module modifications.
- **The desktop consumes the main application's parent-internal API only** — never the public
  Developer API at `api.tenders-sa.org`.
- **The Tenders-SA web application is not modified to accommodate this client.** It is in
  production; the desktop is an extension of it. Every mismatch the Phase 1 audit found is
  absorbed on the desktop side. None of the ten parent-side items (P-1…P-10) is requested as a
  parent change.
- API requests are issued through `tauri-plugin-http`, which performs them in Rust and is
  therefore not subject to browser CORS. Its URL scope is an **explicit allowlist containing only
  the configured API origin**; the plugin grants no origin by default and that default-deny
  posture must not be widened. `dangerous-settings` and `unsafe-headers` stay off.
- The Bearer token is **at rest only in the OS keychain**. Because the plugin takes headers from
  the caller, the token may exist in webview memory **transiently for a single request** — it must
  never be written to SQLite, Zustand, browser storage, a URL, a log, or any module-level or
  global JavaScript variable. This is a recorded, directed relaxation of the Phase 1 position.
- The CSP must keep `script-src 'self'` and a `connect-src` restricted to `'self'`/`ipc:`. These
  are load-bearing exfiltration containment, not incidental hardening, and must not be widened.
- The desktop treats the token as opaque: it never parses, verifies, or signs a JWT.
- Production authentication requires **both** the `desktopAuth` flag and an audited adapter.
- Subscription and authorization checks remain server-enforced; no desktop control is an access
  boundary.
- Entitlement is never computed locally.
- No offline mutation, no document download, no profile editing in this slice.
- The audited contract must be re-verified against parent source before implementation begins.
- A Windows release package/build is verified by a human or approved CI gate.
- No production credentials, production writes, or deployment.

## INTEGRATION WARNINGS

- The parent sets **no CORS headers** on any route this slice needs. Ordinary webview `fetch`
  cannot reach the API; this is why transport goes through the HTTP plugin, and it is not
  optional.
- Login's three 401 causes must be told apart by **matching the `error` string**, because the
  parent emits no error code and will not be changed to. Isolate that match in one function with
  the strings pinned by fixtures, so a parent copy edit fails a test instead of silently
  degrading a user into a dead end.
- There is **no single parent-internal response envelope** — nine distinct shapes were observed,
  and `success` is absent from three. Each endpoint declares its own schema.
- `/api/auth/me` returns **HTTP 200 with `user: null`** when unauthenticated. Status codes cannot
  signal session expiry.
- `/api/auth/me` **re-mints the token on every call** and is the only renewal mechanism. Failing
  to persist the returned token converts a sliding window into a hard 7-day expiry.
- Logout performs **no server-side revocation**. A keychain token stays valid up to 7 days;
  clearing it locally is the real logout.
- `/api/subscription/status` **synthesises a `'free'` plan with `id: null`** for credit-holding
  users; `subscription === null` is not the test for "no entitlement".
- `/api/subscription/feature-access/*` returns **`hasAccess: false` inside its HTTP 500 body**.
- A 429 carries `Retry-After`, is IP-keyed, and is deliberately not reset on success — it must
  never be auto-retried.
- The parent's unimplemented `api-response-standardization` spec names `auth/login/route.ts`.
  If it lands, login's response shape changes. Watch it; do not design around it.

## TASK CHECKLIST

- [x] TASK-2.1 — Re-verify the audited contract at a current parent baseline (parent unmoved at `8ff2e4c2`; 18/18 claims confirmed — see tasks.md evidence)
- [x] TASK-2.2 — Add and scope `tauri-plugin-http` (one path-scoped origin; 13 boundary tests; Rust compiled first in CI — see tasks.md evidence)
- [ ] TASK-2.3 — Implement the transport adapter
- [ ] TASK-2.4 — Close the endpoint-parity gap (PA-1)
- [ ] TASK-2.5 — Extend the authentication failure union
- [ ] TASK-2.6 — Implement the audited auth adapter
- [ ] TASK-2.7 — Activate the login shell
- [ ] TASK-2.8 — Add the subscription endpoint adapter
- [ ] TASK-2.9 — Render real data in the Command Centre
- [ ] TASK-2.10 — Enable the gate
- [ ] TASK-2.11 — Evaluate the authenticated shell

## HUMAN APPROVAL GATES

| # | Gate | Blocks |
|---|------|--------|
| G1 | Approve this contract | All implementation |
| G2 | Accept the auth adapter as audited | TASK-2.10 |
| G3 | Enable `desktopAuth` | Any real authentication |
| G4 | Windows package + launch verification | Release |
| G5 | Production endpoint configuration | Production use |

## COMMIT FORMAT

Use the exact commit listed by each task. Each implementation commit must identify its task and
requirement references in the body. Documentation checkbox updates may be included with the task
commit when made after successful verification; never mark a task complete before evidence
exists.
