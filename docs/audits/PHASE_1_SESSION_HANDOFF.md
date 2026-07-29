# Phase 1 session handoff

> ## ⚠️ HISTORICAL — Phase 1 is complete. Do not act on this note.
>
> Every blocker below was resolved on 2026-07-28. The parent repository was
> attached and readable, all three deferred Phase 0 pre-checks were closed,
> and TASK-1.1 through TASK-1.8 are done and merged.
>
> Two things this note says are now **wrong**, and are corrected in the
> artifacts rather than here:
>
> - It records `be09f9d51` as "never confirmed to exist". **It exists** and is
>   a reachable ancestor of the default branch. It was still not adopted as
>   the baseline, for a different reason — see `parent-baseline.md` §2.
> - It describes the parent repository as unattachable. It is attachable, and
>   the audit is drawn from parent source rather than inference.
>
> Start from `parent-baseline.md`, or from `docs/README.md`. This file is kept
> for provenance, not guidance.

> **This is not an audit artifact.** It is a working note for whoever
> starts Phase 1. The audit artifacts are `parent-baseline.md`,
> `model-inventory.md`, `auth-subscription-contract.md`,
> `endpoint-inventory.md`, `domain-mappings.md`,
> `workspace-gap-report.md`, and `phase-2-plan.md`, each created by its
> own task. Do not treat anything below as evidence — it is a list of
> what still needs evidence.

## Why Phase 1 did not run in the Phase 0 session

Phase 0 was implemented in a session scoped to the `Tenders-SA` owner.
The parent repository `freelancing-solutions/tendersa` is visible to the
account and the account has push access, but it could not be attached:

```
add_repo: cross-tier adds are not supported in v1: requested
"freelancing-solutions/tendersa" but session already has repos
from owner(s) [tenders-sa]
```

Every Phase 1 task's pre-check requires reading parent source at a
pinned SHA, and `AGENTS.md` requires tasks in order, so Phase 1 could
not begin. Three Phase 0 pre-checks were deferred into Phase 1 for the
same reason.

## Starting the Phase 1 session

Start a **new** session with `freelancing-solutions/tendersa` as an
**initial source** — added alongside this repository at session
creation, not with `add_repo` afterwards. Then begin at **TASK-1.1**.

Verify parent access before writing anything: if the parent tree is not
readable, stop and say so rather than producing an audit from inference.

## Deferred Phase 0 pre-checks — resolve these first

These three were left open in Phase 0. Each names the parent path that
was supposed to be read and what the desktop code assumed instead.
Resolving them is a prerequisite for the tasks listed, not separate work.

### 1. Parent auth contract — deferred from TASK-0.9, resolve in TASK-1.3

- **Not read**: parent login / me / logout route behaviour and tests.
- **What Phase 0 did instead**: shipped `GatedAuthService`, which
  requires *both* the `desktopAuth` feature flag *and* an audited
  adapter. No audited adapter exists, so production auth cannot be
  enabled by flipping a flag. Session restoration is gated identically;
  logout is always permitted.
- **Known ambiguity (INT-1)**: parent login exposes both response-token
  and cookie behaviour. Do not assume which one is the supported native
  contract — that determination is TASK-1.3's output.
- **Blocks**: supplying an audited adapter, and therefore REQ-4.

### 2. Parent API contract — deferred from TASK-0.7, resolve in TASK-1.4

- **Not read**: parent `src/lib/api-client.ts` and the parent-internal
  routes.
- **What Phase 0 did instead**: verified the envelope against the
  **live public Developer API** (`https://api.tenders-sa.org`, v2.1.0)
  with non-mutating GETs. That API is read-only public data with no
  auth-session, workspace, or mutation routes — **it is not the
  parent-internal API** that `requirements.md` scopes.
- **Findings to reconcile against parent source**: `error` is a plain
  string with `code` as a *sibling* (design.md's sketch said
  `string | {code, message}`); there is no `meta` block, pagination is
  `?limit`/`?cursor`. The implemented schema follows the verified live
  contract. Confirm whether the parent-internal envelope matches.
- **Drift already observed (INT-6)**: 1 of 98 endpoints documents a
  `200` content schema; the `Unauthorized` and `NotFound` component
  responses are referenced by no endpoint.
- **Pinned document**: `tenders-sa-developer-api-v2.1.0-openapi.json`
  in this directory is the **public** API. TASK-1.4 must compare route
  handlers against **both** parent OpenAPI documents, which is a
  different and larger comparison.

### 3. Parent brand hues — deferred from TASK-0.8

- **Not read**: parent `src/app/globals.css` (`--primary`, `--accent`,
  `--info`, and the success / warning / error / destructive tokens).
- **What Phase 0 did instead**: took hues from `design.md`'s
  second-hand record.
- **Important**: the desktop tokens deliberately **do not** match
  design.md's proposed table. An automated check found six real WCAG 2.2
  AA failures in it, all corrected in `src/styles/tokens.css`. When
  comparing against the parent, expect and preserve that divergence —
  re-aligning the desktop values to the parent's light-surface hues
  would reintroduce the contrast failures. `src/tests/design-tokens.test.ts`
  will fail if anyone tries.
- **Not blocking**: this is a fidelity check, not a correctness gate.

## Unverified baseline

`be09f9d51` is recorded as the intended parent audit baseline commit but
**was never confirmed to exist**. TASK-1.1 must establish the real
baseline from the parent remote rather than adopting this SHA on trust.
If the confirmed baseline differs, say so explicitly in
`parent-baseline.md` — a silently corrected SHA is exactly the drift
TASK-1.1 exists to prevent.

## Constraints that remain in force

- No parent repository source changes, schema migrations, production
  data writes, or frozen-module modifications. Phase 1 is **read-only**
  against the parent.
- Parent auth, API response, database client, configuration,
  middleware, and several services are frozen. Consume contracts through
  APIs; propose parent changes separately.
- Route code and tests at the pinned SHA outrank OpenAPI documentation
  wherever they disagree.
- Local SQLite holds cache/offline state only, never persistent auth
  tokens.
- `SPEC_CONTRACT.md` is `APPROVED`; task checklist changes must be
  mirrored in both `tasks.md` and `SPEC_CONTRACT.md`.
- Phase 2 implementation requires a new approved contract. TASK-1.7
  produces a *plan*, not code.

## Open product decision carried forward

The Windows artifact is **399 MB** (from 7.8 MB) because
`webviewInstallMode` is `offlineInstaller` and the NSIS and MSI
installers each embed their own WebView2 copy — roughly 3× the ~127 MB
the change was approved on. Dropping one installer format halves the
embedded payload; `embedBootstrapper` is far smaller but requires
internet at install time. Not a Phase 1 blocker. See `docs/release.md`.
