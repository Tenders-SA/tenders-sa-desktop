# Phase 2 vertical slice — plan

**Task**: TASK-1.7 — Define the Phase 2 vertical slice
**Refs**: REQ-15, and all Phase 0–1 outputs
**Baseline**: `8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1` — see `parent-baseline.md`
**Recorded**: 2026-07-28

> **This is a plan, not an implementation, and not a specification.**
>
> `SPEC_CONTRACT.md` scopes the current contract to "Phase 0 foundation and Phase 1 parent
> integration audit only". Phase 2 implementation requires a **new, separately approved
> contract**. Nothing in this document authorises code, and this document does not change the
> approved scope of the current contract.
>
> `tasks.md` permits creating a Phase 2 specification "only after user direction". No Phase 2
> specification is created here.

---

## 1. Pre-check — Phase 0 and Phase 1 are complete and internally consistent

TASK-1.7's pre-check requires confirming that the Phase 0 evaluation and all Phase 1 audits are
complete and internally consistent.

### Completeness

| Artifact | Task | Status |
|----------|------|--------|
| Phase 0 evaluation | TASK-0.13 | **Complete** — all automated gates, human-triggered Windows packaging, confirmed launch, PERF-1 within target |
| `parent-baseline.md` | TASK-1.1 | Complete |
| `model-inventory.md` | TASK-1.2 | Complete |
| `auth-subscription-contract.md` + `docs/architecture/auth.md` + fixtures | TASK-1.3 | Complete |
| `endpoint-inventory.md` | TASK-1.4 | Complete |
| `domain-mappings.md` | TASK-1.5 | Complete |
| `workspace-gap-report.md` | TASK-1.6 | Complete |
| `deferred-phase-0-precheck-resolutions.md` | carried + re-verified | Complete |

### Consistency — checked mechanically, and it found two defects

Two cross-artifact checks were run rather than asserted:

1. **Baseline agreement.** All seven audit artifacts cite `8ff2e4c2…`; none claims an older
   baseline as its own. Verified by grep. **Pass.**
2. **Gap-ID closure.** The 27 gap IDs defined across `model-inventory.md` (M-1…M-10),
   `auth-subscription-contract.md` (A-1…A-6), and `endpoint-inventory.md` (E-1…E-11) were
   extracted and diffed against the IDs classified in `workspace-gap-report.md`. **The first
   pass failed**: A-4, A-5 and E-7 were defined but never classified. They are now classified
   (D-13, P-10, D-14), and the re-run shows **27 defined / 27 cited, no dangling references
   either way.** **Pass after fix.**

A third inconsistency was found and resolved during TASK-1.4 itself: `model-inventory.md` §3
concluded the `Application` Json blobs must be treated as whole-value conflicts, which
`endpoint-inventory.md` §9 superseded once the shapes were known. Both documents state the
supersession explicitly rather than silently disagreeing.

**Pre-check satisfied.**

---

## 2. Slice selection

`design.md` §Future Roadmap Boundary recommends authentication/shell first, and REQ-15 asks for
"secure authentication and desktop shell integration". The audit confirms that ordering, for a
reason the roadmap could not have known:

> **C-1 — no CORS headers exist on any parent route the desktop needs — means the Phase 0
> `fetch` transport cannot reach the parent API at all.** Until the transport moves to Rust,
> *no* slice that calls the parent can work. Every candidate slice therefore depends on this
> one.

### Scope

**Slice: authenticated shell — log in, restore a session, see real data, log out.**

1. **Rust HTTP transport** behind Phase 0's existing injectable transport seam.
2. **Audited auth adapter** implementing `AuthPort` against the TASK-1.3 contract.
3. **`AuthFailureKind` extension** — `account-inactive`, `rate-limited`, `server-error`.
4. **Keychain session lifecycle** — store, sliding renewal via `/me`, clear on 401/logout.
5. **Enable `desktopAuth`** once the adapter is audited and its tests pass.
6. **One real read path end-to-end** — `GET /api/subscription/status` rendered in the Command
   Centre, replacing the placeholder.
7. **Login shell activation** — the existing disabled `LoginShell` becomes functional.

Item 6 is what makes this a *vertical* slice rather than an auth refactor: it proves transport,
auth, envelope validation, error handling, and rendering work together against the real parent.

`/api/subscription/status` is the deliberate choice for the first real call: it is
authenticated (so it proves the Bearer path), it is a `GET` (no mutation, no idempotency
concern), its shape is already pinned by TASK-1.3 fixtures, and it is rated **High** stability
— one of only two endpoint groups that are.

### Endpoint parity — the desktop calls the main application's API, not the Developer API

**This is a binding constraint on the slice, restated here because it is the easiest thing to
get wrong.**

The desktop consumes the **same parent-internal endpoints the main web application uses**. It
does **not** consume the public Tenders-SA Developer API.

| | Main application API — **use this** | Public Developer API — **do not use** |
|---|---|---|
| Host | the application host (`VITE_API_BASE_URL`) | `api.tenders-sa.org` |
| Routes | `/api/auth/*`, `/api/tenders`, `/api/v1/applications`, `/api/v1/company/profile`, `/api/subscription/*` | `/v1/*`, `/v2/*` |
| Auth | session JWT, `Authorization: Bearer` | API key (`apiKeyAuth`) |
| Pagination | `page`/`limit`, or `limit`/`offset` | `limit`/`cursor` |
| Coverage | auth, workspace, mutations | read-only public data only |
| Documented by | **nothing** — hand-authored schemas, `awaiting-contract` (E-7) | `docs/openapi/v1.yaml`, published v2.1.0 |

All 16 endpoints in `endpoint-inventory.md` are main-application routes; the Developer API is
inventoried only as the drift comparison INT-6 requires. `requirements.md` scopes the
parent-internal API, and the Developer API cannot serve this product regardless — it has no
auth-session, workspace, or mutation routes at all.

**Current state check** (run at this baseline):

- ✅ `VITE_API_BASE_URL=http://localhost:3000` — the main application's dev host. No production
  endpoint and no Developer API host is configured anywhere.
- ✅ `TenderDocument.downloadUrl` excluded from the projection; `requireR2=1` mandatory (C-5).
- ⚠️ **One artifact still encodes the Developer API contract**:
  `src/tests/api-transport.test.ts` uses `baseUrl: "https://api.tenders-sa.org"` and asserts
  `"…/v2/tenders?limit=20&cursor=abc"`. The base URL is incidental to what those tests actually
  cover (timeout, retry, cancellation), but the `cursor` pagination shape is **not** how any
  main-application route paginates, and a contributor reading it as the contract would build the
  wrong client.

> **Gap PA-1** — Phase 0's transport tests carry Developer-API fixtures. **Not fixed here**:
> Phase 1 is a documentation phase, and editing Phase 0 test files would put an unscoped code
> change into an audit commit. **Phase 2 fixes it** as part of the transport work it already
> touches (§5), re-pointing the fixtures at a main-application base URL and `page`/`limit`
> pagination. Acceptance criterion **A16**.

No parent change is needed for endpoint parity — the routes already exist and the desktop is
already pointed at them. The parent-side items that *do* need their own specifications are the
ten proposals in `workspace-gap-report.md`, none of which blocks this slice.

### Non-goals

Explicitly out of scope, each for a stated reason:

| Non-goal | Why |
|----------|-----|
| Tender list/detail UI | `/api/tenders` is rated Low-Medium stability with no tests and an unresolved list-vs-detail `Json` type split (E-11). Needs its own slice. |
| Any offline mutation | E-9 (`/workspace` action vocabulary) is unresolved; queueing a non-idempotent action would risk corruption. |
| Application workspace | Depends on the above. |
| Document download | INT-4 flow is mapped but needs filesystem capability work and its own retention decisions. |
| Company profile editing | E-10's write foot-gun makes this a slice that needs careful validation design. |
| Any parent change | INT-7 — all ten proposals are separate parent specifications. |
| macOS / Linux | Windows-only for v1 per `requirements.md`. |
| New parent endpoints | None are needed (`workspace-gap-report.md` §7). |

---

## 3. Dependencies

### Inbound — what Phase 2 needs that already exists

| Dependency | Source | Ready? |
|------------|--------|--------|
| Audited auth contract | `auth-subscription-contract.md`, `docs/architecture/auth.md` | **Yes** |
| Contract fixtures + schemas | `src/tests/fixtures/parent-auth-contract.ts` (26 tests) | **Yes** |
| OS keychain commands | TASK-0.4 `session_store`/`session_load`/`session_clear` | **Yes** |
| Injectable transport seam | TASK-0.7 `src/services/api/**` | **Yes** |
| Auth ports + gate | TASK-0.9 `src/services/auth/**` | **Yes** |
| Protected routing + shell | TASK-0.10 | **Yes** |
| Redaction | TASK-0.11 | **Yes** |
| Config with `desktopAuth` flag | TASK-0.3 | **Yes** |

**Phase 0 built everything this slice needs.** No foundational work is outstanding — which is
the point of having done Phase 0 first.

### Parent dependencies — none blocking

No parent change is required. All ten proposals (P-1…P-10) are deferred, and §2's scope avoids
the paths where their absence would hurt:

| Proposal | Would help | Workaround in this slice |
|----------|-----------|--------------------------|
| P-1 login error codes | Distinguishing account-inactive | String-match the three known `error` values; brittle but contained, and pinned by fixtures |
| P-2 idempotency keys | Offline mutations | Slice has none |
| P-7 version column | Conflict detection | Slice has no mutations |
| D-1 token revocation | Logout security | Local keychain clear is the real logout; the 7-day residual is documented |

### Outbound risk — the one to watch

**D-3 / G-1**: `.kiro/specs/api-response-standardization` is specified but unimplemented, and its
"Files to Modify" list names `auth/login/route.ts` — an endpoint this slice consumes. If it
lands, login's response shape changes.

**Do not design around it.** Per-endpoint schemas already bound the blast radius to one adapter,
and boundary validation would fail visibly rather than corrupt state. The action is to **watch
the spec**, and to re-run the TASK-1.3 fixtures against parent source at the Phase 2 baseline
before implementation starts.

---

## 4. Feature flags

| Flag | Phase 0 | During Phase 2 | Exit |
|------|---------|----------------|------|
| `desktopAuth` | `false` | `false` until the adapter passes contract tests | `true` only at the human approval gate (§9) |

**The two-condition gate stays.** `GatedAuthService.isEnabled()` requires both the flag **and**
an audited adapter (`gated-auth-service.ts:42-44`). Phase 2 supplies the adapter, which means
the flag becomes load-bearing for the first time — so flipping it becomes an explicit,
gated decision rather than a config tweak.

`ProtectedRoute`'s `allowUnauthenticated` escape hatch is derived from `auth.isEnabled()` and
**turns itself off** when auth ships (TASK-0.10). No manual removal needed; a test should assert
this rather than trusting it.

---

## 5. File impact

Estimated, and deliberately small.

### Create

| Path | Purpose |
|------|---------|
| `src-tauri/src/commands/http.rs` | Narrow native HTTP command — the Rust transport (C-1) |
| `src/services/api/tauri-transport.ts` | Transport adapter implementing Phase 0's seam over the native command |
| `src/services/auth/parent-auth-adapter.ts` | The audited `AuthPort` implementation |
| `src/services/api/endpoints/subscription.ts` | First real endpoint adapter + Zod schema |
| `src/tests/parent-auth-adapter.test.ts` | Adapter contract tests against TASK-1.3 fixtures |
| `src/tests/tauri-transport.test.ts` | Transport tests |

### Modify

| Path | Change |
|------|--------|
| `src/services/auth/ports.ts` | Extend `AuthFailureKind` (C-3) |
| `src/services/auth/gated-auth-service.ts` | Accept the adapter; map new failure kinds |
| `src/features/auth/LoginShell.tsx` | Activate; render the new failure states |
| `src/features/command-centre/**` | Render real subscription data |
| `src-tauri/capabilities/default.json` | Permit the new HTTP command only |
| `src-tauri/src/lib.rs` | Register the command |
| `.env.example`, config schema | API base URL wiring if needed |
| `src/tests/auth-service.test.ts`, `login-shell.test.tsx` | Update for new failure kinds |
| `CHANGELOG.md` | First user-visible behaviour change in the product |

**Security note on the new native command**: it must be a *narrow* HTTP command scoped to the
configured API origin — **not** a general-purpose fetch primitive. A generic native HTTP command
callable from the webview would hand the webview back the capability SEC-1 exists to withhold,
and would undo the reason for moving transport to Rust in the first place.

---

## 6. Acceptance criteria

| # | Criterion |
|---|-----------|
| A1 | A user logs in with real credentials against a non-production parent environment and reaches the Command Centre |
| A2 | The JWT is in the OS keychain and appears in **no** SQLite table, Zustand store, browser storage, URL, or log — asserted by test |
| A3 | The token never enters webview JavaScript; requests are issued from Rust — asserted by test |
| A4 | `/api/auth/me` on start-up restores a session, and **the returned token replaces the stored one** (sliding renewal) |
| A5 | `user: null` from `/me` at HTTP 200 is treated as "no session", not as success |
| A6 | Logout clears the keychain **even when the remote call fails** |
| A7 | All five login failure states render distinctly: invalid credentials, account inactive, rate limited (with `Retry-After`), network, server error |
| A8 | A 429 is **never** auto-retried |
| A9 | `GET /api/subscription/status` renders real data, including the **synthesised free plan with `id: null`** |
| A10 | A `feature-access` HTTP 500 renders as an error, **not** as an upsell |
| A11 | Both 401 body shapes are handled; either clears the session |
| A12 | `x-csrf-token` is sent on mutations when a token exists, and its absence never blocks anything |
| A13 | Response-schema validation failure renders a handled error state, not a crash |
| A14 | `desktopAuth=false` fully disables login; `ProtectedRoute`'s escape hatch is off once auth ships |
| A15 | No secret appears in any log at either redaction mode — asserted by test |
| A16 | **Every request targets a main-application route.** No Developer API host or `/v1`–`/v2` path appears in desktop source or fixtures; `api-transport.test.ts`'s Developer-API fixtures are re-pointed (PA-1) — asserted by a test that greps the built source for the Developer API host |

A2, A3, A5, A6, A8, A10 and A16 exist because each is a specific trap the audit found. They are
not generic hygiene.

---

## 7. Test plan

| Layer | Coverage |
|-------|----------|
| Contract | Extend `parent-auth-contract.test.ts`; the adapter parses **every** TASK-1.3 fixture |
| Adapter unit | Login success/failure paths, session restore, renewal-token persistence, logout-always-clears |
| Transport | Timeout, cancellation, bounded retry, 429 no-retry, offline, malformed 2xx |
| Rust | Command input validation, origin scoping, error redaction |
| Component | `LoginShell` in every failure state; keyboard and accessible names (A11Y-1) |
| Security | No token in SQLite/Zustand/storage/URL/logs; no secret in errors |
| Integration | Local mock server only — **never production**, per `requirements.md` non-goals |

**A pre-implementation step, not a test**: re-run the TASK-1.3 verification against parent source
at the Phase 2 baseline. The audit is a point-in-time artifact, and `9fd93b2` already
demonstrated that in-scope parent routes move within days.

---

## 8. Rollout and rollback

**Rollout**

1. Land the transport and adapter with `desktopAuth=false` — inert, fully tested.
2. Verify all gates plus the Windows packaging/launch gate.
3. Human approval (§9) → enable `desktopAuth` in a non-production build.
4. Manual verification against a non-production parent environment.
5. Only then consider a production-configured build.

**Rollback**

| Level | Action | Cost |
|-------|--------|------|
| Instant | Set `desktopAuth=false` | Auth disabled; the two-condition gate makes this total |
| Build | Revert the Phase 2 commits | Returns to Phase 0; changes no parent runtime |
| Data | None needed | The slice has no mutations and no migrations |

Rollback is unusually clean **because the slice has no write path** — a deliberate consequence of
the scope choice in §2, not a happy accident.

---

## 9. Human approval gates

| # | Gate | Who | Blocks |
|---|------|-----|--------|
| G1 | **Approve a new Phase 2 SPEC_CONTRACT** | User | All implementation |
| G2 | Accept the auth adapter as "audited" | User/reviewer | Enabling the flag |
| G3 | Enable `desktopAuth` | User | Any real authentication |
| G4 | Windows package + launch verification | Human or approved CI | Release |
| G5 | Production endpoint configuration | User | Production use |
| G6 | Approve any parent proposal (P-1…P-10) | Parent maintainer | Separate parent spec |

**G1 is absolute.** No Phase 2 file may be written before a new contract is approved. This
document exists to make that approval decision informed — it is not itself the approval.

---

## 10. Recommended slice order after Phase 2

Not part of this slice; recorded so Phase 2's boundaries make sense.

| Phase | Slice | Gating dependency |
|-------|-------|-------------------|
| 3 | Tender discovery (list + detail, read-only) | Resolve E-11's list/detail type split |
| 4 | Company profile + vault | E-10 write validation design |
| 5 | Tender documents | INT-4 flow + scoped filesystem capabilities |
| 6 | Application workspace (read-only) | — |
| 7 | Offline workspace mutations | **E-9 action vocabulary — hard blocker** |
| 8+ | Intelligence, JV, proposals, pricing | Pricing needs a parent model that does not exist (N-1) |

Each requires its own approved contract and its own audit refresh at a current baseline.

---

## 11. Verification

TASK-1.7's verify condition: *plan contains scope/non-goals, dependencies, feature flags, parent
proposals, file impact, acceptance criteria, tests, rollout, rollback, and human approval gates.*

| Required | Section |
|----------|---------|
| Scope | §2 — seven items, vertical through transport to UI |
| Endpoint parity (main application API, not the Developer API) | §2 — binding constraint, current-state check, gap PA-1, criterion A16 |
| Non-goals | §2 — eight, each with a reason |
| Dependencies | §3 — inbound, parent, and the one outbound risk |
| Feature flags | §4 |
| Parent proposals | §3, §9 G6 — all ten deferred, none blocking |
| File impact | §5 — 6 created, 9 modified, with a security constraint on the native command |
| Acceptance criteria | §6 — 15, six of them audit-specific traps |
| Tests | §7 — seven layers, plus a pre-implementation re-verification step |
| Rollout | §8 |
| Rollback | §8 — three levels |
| Human approval gates | §9 — six |
| Pre-check: Phase 0 + Phase 1 complete and consistent | §1 — checked mechanically; found and fixed two defects |

**This document is a plan.** No Phase 2 code was written, no Phase 2 specification was created,
and `SPEC_CONTRACT.md`'s approved scope is unchanged.

**TASK-1.7 is complete.**
