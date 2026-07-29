# Tenders-SA Desktop Authenticated Shell Requirements

## Context Note

- **Date**: 2026-07-29
- **Phase**: 2 — the first vertical slice after the Phase 0 foundation and Phase 1 audit.
- **Predecessor**: `docs/specifications/desktop-procurement-workspace/` (Phase 0–1, contract
  APPROVED, merged). This specification does not modify that contract; it opens a new one.
- **Derived from**: `docs/audits/phase-2-plan.md`, which was produced by TASK-1.7 and reviewed
  as part of Phase 1.
- **Parent audit baseline**: `8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1`
  (`freelancing-solutions/tendersa`, branch `aws-production-app`) — see
  `docs/audits/parent-baseline.md`.

### Why this slice, and why now

Phase 1 found that **the parent sets no CORS headers on any route the desktop needs**
(`docs/audits/auth-subscription-contract.md` §6). Only three route files in the parent's entire
`src/app/api` tree set `Access-Control-Allow-Origin`, all of them public embed/widget/beacon
surfaces. A `fetch` issued from a Tauri webview on a `tauri://localhost` origin is therefore
blocked on every auth, subscription, tender, application, and workspace route.

The consequence is decisive for ordering: **no slice that calls the parent can work until the
transport moves to Rust.** Every candidate vertical slice depends on this one. That is why the
authenticated shell comes first, and it is a stronger reason than the roadmap ordering in the
Phase 0–1 `design.md`, which anticipated only the security argument.

### What Phase 1 already settled

This specification consumes, and does not re-litigate, the following audited findings:

| Finding | Source |
|---------|--------|
| Bearer token from the login response body is the supported native transport | `auth-subscription-contract.md` §2 |
| `/api/auth/me` always returns HTTP 200; session validity is `user !== null` | §4 |
| `/me` re-mints the token on every call and is the only renewal mechanism | §4 |
| Logout does not revoke; local keychain clearing is the real logout | §5 |
| CSRF is minted but validated by no mutating route | §7 |
| Entitlement is server-authoritative and cannot be computed locally | §8 |
| There is no single parent-internal response envelope — nine shapes | `endpoint-inventory.md` §3 |
| No endpoint supports an idempotency key | `endpoint-inventory.md` §4 |

### Endpoint parity — binding

The desktop consumes the **same parent-internal routes the main Tenders-SA web application
uses**. It does **not** consume the public Developer API at `api.tenders-sa.org`, which is
read-only public data with no auth-session, workspace, or mutation routes and therefore cannot
serve this product at all. `docs/architecture/api.md` §0 records the resolution.

## Reality Check and Decision

- **Enhance Existing — desktop**: Phase 0 built the transport seam, auth ports, gated service,
  keychain commands, protected routing, and shell. This slice fills them in. No new foundational
  module is created.
- **No parent change required**: `docs/audits/workspace-gap-report.md` classifies 47 gaps and
  concludes **zero new parent endpoints are needed**. All ten parent proposals (P-1…P-10) are
  deferred and none blocks this slice.
- **No duplicate implementation**: the parent owns authentication, entitlement, and all domain
  data. This slice consumes those contracts and adds no server authority.

## Objective

- **Why**: prove the desktop can authenticate against the real platform and render real data,
  end to end, before any feature slice is built on that assumption.
- **Current goal**: a user logs in, the session survives restart, one authenticated read renders
  validated real data, and logout works — with the token never leaving the OS keychain and Rust.
- **Long-term goal**: unblock the tender, workspace, and document slices, each separately
  approved.

## Scope

### In scope

- `tauri-plugin-http`, scoped by an explicit URL allowlist to the API origin only, and a
  transport adapter implementing Phase 0's existing injectable seam over it.
- An audited authentication adapter implementing `AuthPort` against the Phase 1 contract.
- Extension of `AuthFailureKind` to express the states the audited contract actually produces.
- Keychain session lifecycle: store on login, replace on renewal, clear on 401 and logout.
- Activation of the existing `LoginShell`, currently rendered deliberately disabled.
- Enabling `desktopAuth` once an audited adapter exists and its contract tests pass.
- **One** authenticated read path — `GET /api/subscription/status` — rendered in the Command
  Centre, replacing placeholder content.
- Re-pointing Phase 0's Developer-API transport test fixtures (gap PA-1).

### Explicit non-goals

| Non-goal | Reason |
|----------|--------|
| Tender list/detail UI | `/api/tenders` is Low-Medium stability, has no route tests, and returns the same `Json` fields as different types on list vs detail (gap E-11) |
| Any offline mutation | The `/workspace` action vocabulary is unenumerated (gap E-9); queueing a non-idempotent action risks corruption |
| Application workspace | Depends on the above |
| Document download | INT-4 flow is mapped but needs scoped filesystem capabilities and its own retention decisions |
| Company profile editing | Gap E-10's unvalidated-write defect needs deliberate validation design |
| Any parent repository change | INT-7 — all ten proposals are separate parent specifications |
| New parent endpoints | None are needed |
| macOS or Linux | Windows-only for v1 |
| Production credentials or production writes | Carried forward from Phase 0–1 |

## Functional Requirements

- [ ] **REQ-A1 — Native HTTP transport via `tauri-plugin-http`**: API requests shall be issued
      through `tauri-plugin-http`, which performs the request in Rust and is therefore not
      subject to browser CORS. Browser `fetch`/`XHR` to the API shall remain blocked by the
      existing CSP. The plugin's URL scope shall be an **explicit allowlist containing only the
      configured API origin** — the plugin grants no origin by default, and that default-deny
      posture shall not be widened.
- [ ] **REQ-A2 — Transport adapter**: the plugin shall be consumed through Phase 0's existing
      injectable transport seam, preserving its timeout, cancellation, bounded-retry, and
      error-normalisation policy without reimplementation.
- [ ] **REQ-A3 — Audited auth adapter**: an `AuthPort` implementation shall authenticate via
      `POST /api/auth/login`, carry `Authorization: Bearer <token>` on every request, and treat
      the token as opaque — never parsing, verifying, or signing it (INT-1).
- [ ] **REQ-A4 — Session validity and renewal**: session restoration shall call
      `GET /api/auth/me`, treat `user === null` as "no session" regardless of the HTTP 200
      status, and **replace the stored token with the one returned** on every successful call.
- [ ] **REQ-A5 — Failure states**: `AuthFailureKind` shall express at minimum
      `account-inactive`, `rate-limited`, and `server-error` in addition to the existing kinds,
      and the login UI shall render each distinctly.
- [ ] **REQ-A6 — Rate-limit safety**: a `429` shall never be retried automatically, and its
      `Retry-After` value shall be surfaced to the user.
- [ ] **REQ-A7 — Keychain lifecycle**: the token shall be stored, replaced, and cleared only
      through the Phase 0 native keychain commands, and shall never enter SQLite, Zustand,
      browser storage, a URL, or a log.
- [ ] **REQ-A8 — Logout**: logout shall call the parent endpoint and then clear local
      credentials **regardless of the remote outcome**, because the parent performs no token
      revocation.
- [ ] **REQ-A9 — Gate**: production authentication shall remain unavailable unless both the
      `desktopAuth` flag is enabled and an audited adapter is present, and the shell's
      unauthenticated escape hatch shall disable itself once auth is live.
- [ ] **REQ-A10 — One real read**: the Command Centre shall render validated data from
      `GET /api/subscription/status`, correctly handling the synthesised free plan with a
      `null` id.
- [ ] **REQ-A11 — Entitlement integrity**: entitlement shall never be computed locally; a
      `feature-access` HTTP 500 carrying `hasAccess: false` shall render as an error, not as an
      upgrade prompt.
- [ ] **REQ-A12 — Per-endpoint schemas**: each consumed endpoint shall declare its own Zod
      response schema. No global envelope shall be assumed, and failure parsing shall accept
      `{error}` with or without `message` and shall not require `success: false`.
- [ ] **REQ-A13 — CSRF forward-compatibility**: the client shall capture `csrfToken` at login,
      hold it in memory only, and send `x-csrf-token` on mutations; its absence shall never
      block login or any operation.
- [ ] **REQ-A14 — Endpoint parity**: no Developer API host or `/v1`–`/v2` path shall appear in
      desktop source or test fixtures. Gap PA-1 shall be closed.

## Non-Functional Requirements

- [ ] **SEC-A1 — Token storage boundary**: the Bearer token shall be **at rest only in the OS
      keychain**. It may exist in webview memory **transiently, for the duration of a single
      request**, because `tauri-plugin-http` requires the caller to supply request headers. It
      shall never be written to SQLite, Zustand, `localStorage`, `sessionStorage`, IndexedDB, a
      URL, a log, or any module-level or global JavaScript variable.
      *This is a deliberate, recorded relaxation of the Phase 1 design position — see
      `design.md` §Transport decision.*
- [ ] **SEC-A2 — Exfiltration containment**: because the token is briefly webview-reachable,
      the paths by which a compromised webview could send it anywhere shall be closed:
      the plugin's URL allowlist shall permit **only** the API origin; the CSP shall keep
      `script-src 'self'` (no remote script sources) and `connect-src` restricted to `'self'`
      and `ipc:` so ordinary `fetch`/`XHR` cannot reach an external host. Tests shall assert
      both.
- [ ] **SEC-A3**: no credential, token, or password shall appear in any log at either redaction
      mode, or in any user-visible error.
- [ ] **SEC-A4**: backend authorization remains authoritative; no desktop control is treated as
      an access boundary.
- [ ] **REL-A1**: a schema-validation failure shall render a handled error state, never a crash.
- [ ] **REL-A2**: network failure, timeout, and cancellation shall remain distinct from
      authentication failure.
- [ ] **A11Y-A1**: the activated login form shall be keyboard operable, expose accessible names,
      associate errors with their fields, and meet WCAG 2.2 AA contrast.
- [ ] **PRIV-A1**: logout and device reset shall remove local account data after clear human
      confirmation.
- [ ] **PERF-A1**: PERF-2's 100 ms input-acknowledgement target, left unmeasured in Phase 1,
      shall be measured on the agreed Windows 11 reference device.

## Integration Requirements

- [ ] **INT-A1**: authenticate only through the audited contract in
      `docs/audits/auth-subscription-contract.md`; do not reimplement parent JWT logic.
- [ ] **INT-A2**: validate every consumed response at the desktop boundary.
- [ ] **INT-A3**: consume the main application's parent-internal API only.
- [ ] **INT-A4**: re-verify the audited contract against parent source at a current baseline
      **before** implementation begins — the audit is a point-in-time artifact, and commit
      `9fd93b2` demonstrated that in-scope parent routes move within days.
- [ ] **INT-A5**: any parent defect found during implementation shall be recorded as a proposal
      in a separate parent-repository specification, never fixed from this repository.

## Impact Map

### Desktop repository

| Area | Change | Risk |
|---|---|---|
| Rust native command | New origin-scoped HTTP command | **High** — a mistake here hands the webview a general-purpose fetch primitive |
| Tauri capabilities | One new command permission | Medium |
| Transport adapter | New adapter behind the existing seam | Medium |
| Auth adapter and ports | New adapter; extended failure union | **High** — security contract |
| Login shell, Command Centre | Activation and first real data | Medium |
| Test fixtures | PA-1 re-pointing | Low |

### Parent repository

| Parent surface | Action | Mutation? |
|---|---|---:|
| `/api/auth/login`, `/api/auth/me`, `/api/auth/logout` | Consume | No |
| `/api/subscription/status` | Consume (read) | No |
| Everything else | None | No |

**No parent file is modified by this contract.**

## Frozen Module Assessment

This specification modifies no parent Tier 1, Tier 2, or Tier 3 file. It consumes the frozen
auth, API-response, and feature-gating contracts through network interfaces only. Any discovered
need to change a frozen parent module stops at a written proposal.

## Success Criteria

- [ ] A user logs in against a non-production parent environment and reaches the Command Centre.
- [ ] The session survives an application restart via `/api/auth/me`, with the returned token
      persisted.
- [ ] The Command Centre renders real, schema-validated subscription data.
- [ ] Logout clears the keychain even when the remote call fails.
- [ ] All five login failure states render distinctly.
- [ ] Automated tests prove the token is absent from SQLite, Zustand, browser storage, URLs, and
      logs, and is never retained in a module-level or global JavaScript variable beyond the
      request that uses it.
- [ ] The HTTP plugin's URL allowlist contains only the API origin, and the CSP still forbids
      remote scripts and external `connect-src` — both asserted by test.
- [ ] No Developer API host or `/v1`–`/v2` path remains anywhere in desktop source or fixtures.
- [ ] `desktopAuth=false` fully disables authentication, and the gate still requires both
      conditions.
- [ ] A human or approved Windows CI job confirms the package builds and launches.
- [ ] PERF-2 is measured on the reference device.
