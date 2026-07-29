# Parent audit baseline

**Task**: TASK-1.1 — Pin and document the parent audit baseline
**Refs**: REQ-10, REQ-11, INT-7
**Recorded**: 2026-07-28

This document pins the exact parent-repository state that every Phase 1 audit artifact in
this repository is read against. Any artifact that cites parent source must cite it at the
SHA below, or state its own baseline explicitly.

---

## 1. Baseline

| Field | Value |
|-------|-------|
| Remote | `https://github.com/freelancing-solutions/tendersa` |
| Default branch | `aws-production-app` |
| **Audit baseline SHA** | **`8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1`** |
| Baseline subject | `Merge pull request #106 from freelancing-solutions/claude/phase-1-handoff-2hdrw2` |
| Baseline date | Tue 28 Jul 2026 15:57:17 +0200 |
| Frozen registry | `.kiro/steering/IMMUTABLE_REGISTRY.md`, Registry Version **2.0** |
| Registry last updated | 2026-05-22 (last audited 2026-04-27) |
| Parent working tree at audit time | **clean** (`git status --porcelain` empty) |

Reproduce the audited state with:

```bash
git clone https://github.com/freelancing-solutions/tendersa
cd tendersa
git checkout 8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1
```

The default branch is **`aws-production-app`**, not `main` or `master` — confirmed via
`git remote show origin` (`HEAD branch: aws-production-app`). Anyone scripting against this
repository should read the default branch rather than assuming it.

The baseline SHA **is** the default branch tip at audit time
(`git rev-parse origin/aws-production-app` → `8ff2e4c2…`), so this baseline is the state a
contributor gets from a fresh clone with no checkout argument.

### Parent read access — confirmed before anything was written

TASK-1.1's gate is that the parent tree must be genuinely readable, and that an audit must
not be produced from inference if it is not. **The parent tree is fully readable in this
session**, attached as an initial source alongside the desktop repository:

| Check | Result |
|-------|--------|
| `git ls-files \| wc -l` in parent | 9794 tracked files |
| `src/lib/api-client.ts` present | yes |
| `src/app/globals.css` present | yes |
| Parent worktree clean | yes |

Every finding in every Phase 1 artifact in this directory is read from parent source at the
baseline SHA, from disk. Nothing is inferred from `design.md`, from the public Developer
API, or from the Phase 0 record.

---

## 2. The `be09f9d51` question — resolved

`requirements.md` §Context Note records the parent as "branch `aws-production-app`, reviewed
at `be09f9d51`", and `PHASE_1_SESSION_HANDOFF.md` flagged that this SHA **"was never
confirmed to exist"**, instructing TASK-1.1 to establish the real baseline from the parent
remote rather than adopt the SHA on trust.

**The commit exists.** It is a real, reachable commit:

| Field | Value |
|-------|-------|
| Full SHA | `be09f9d51aed10f97b3a941146aa89b9eba39b83` |
| Subject | `perf(route-runtime): complete efficiency workstream` |
| Author | mothetho |
| Date | Mon 27 Jul 2026 17:47:50 +0200 |

`git merge-base --is-ancestor be09f9d51 origin/aws-production-app` returns true, so it is a
valid, checkout-able ancestor of the default branch. The handoff's doubt was **unfounded** —
but demanding the check rather than assuming was correct, and the two other SHAs
`requirements.md` cites also resolve (`72217053e` `fix(api-pagination): address review
findings`; `02783dbe5` `docs(specs): add backend route efficiency program`).

### It was not adopted as the baseline, and that is a deliberate, disclosed correction

`be09f9d51` is **15 commits behind** the default branch tip. It was the tip of an
in-progress performance workstream about one hour before the branch moved on.

The decisive objection is not staleness in the abstract — it is that the drift lands
**inside Phase 1's audit surface**. Eight route handlers that Phase 2 depends on differ
between `be09f9d51` and the tip:

```
src/app/api/v1/applications/workspace/summary/route.ts       (+ route.test.ts)
src/app/api/v1/applications/[applicationId]/assist/chat/route.ts    (+ test)
src/app/api/v1/applications/[applicationId]/assist/events/route.ts  (+ test)
src/app/api/v1/dashboard/summary/route.ts                    (+ route.test.ts)
src/app/api/v1/documents/[documentId]/download-url/route.ts
src/app/api/intelligence/classification-stats/route.ts       (+ test)
src/app/api/admin/ai/analytics/route.ts                      (+ test)
src/app/api/cron/application-lifecycle/route.ts              (+ test)
```

`workspace/summary` is the application-workspace route `requirements.md` names as an
existing integration point; `download-url` is the tender-document flow INT-4 governs. An
endpoint inventory (TASK-1.4) or document mapping (TASK-1.5) pinned to `be09f9d51` would
record a contract that no longer exists, and would do so for exactly the routes Phase 2
consumes first.

Per the handoff's instruction that a differing baseline be **stated explicitly rather than
silently corrected**, the substitution is recorded in full:

```
be09f9d51  27 Jul 17:47  perf(route-runtime): complete efficiency workstream  <- requirements.md / handoff SHA
   |
   |  (10 commits — bounded-reads workstream)
   v
199e4229  27 Jul 18:56  docs(bounded-reads): record local completion...      <- superseded interim pin (§4)
   |
   |  (5 commits)
   v
8ff2e4c2  28 Jul 15:57  Merge pull request #106 ...                          <- ADOPTED AUDIT BASELINE
```

**`requirements.md` is not edited to match.** Its Context Note is a dated record of what the
specification author reviewed, and rewriting it would destroy the provenance this task
exists to protect. The authoritative audit baseline is this document.

### What the correction does and does not change

The auth surface is **byte-identical** across all three candidate baselines, so no TASK-1.3
finding depends on the choice:

```bash
git diff --name-only be09f9d51..origin/aws-production-app -- \
  src/lib/auth.ts src/lib/api-client.ts src/middleware.ts src/app/globals.css \
  src/lib/jwt-auth.ts src/lib/csrf.ts src/lib/auth-constants.ts \
  src/lib/jwt-service.ts src/app/api/auth src/app/api/subscription
# (no output — identical)
```

The correction matters only for the eight routes listed above, and it matters there.

---

## 3. Worktree drift — disclosed separately

TASK-1.1's verification requires that unrelated worktree drift be disclosed separately from
the pinned baseline.

**There is no worktree drift at this baseline.** The parent working tree is clean
(`git status --porcelain` produces no output), and the checked-out commit is exactly the
default branch tip:

| Check | Result |
|-------|--------|
| `git status --porcelain` | empty — 0 modified, staged, or untracked files |
| `git rev-parse HEAD` | `8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1` |
| `git rev-parse origin/aws-production-app` | `8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1` |
| HEAD vs default branch tip | identical — 0 commits ahead, 0 behind |

This is a material improvement on the condition `requirements.md` anticipated. Its Context
Note warned that "the parent working tree also contains unrelated, uncommitted
application-workspace changes, so Phase 1 must audit a named commit and separately disclose
worktree drift". At this baseline that uncommitted work is no longer present — it has since
been committed and merged. The audited commit and the working tree are the same state, so
the named-commit requirement and the drift requirement collapse into one clean answer.

The parent checkout is on local branch `claude/tenders-sa-phase-1-audit-qww7aq`, which is at
the same commit as `origin/aws-production-app`. That branch is **never written to** — see
§6.

---

## 4. Prior interim baseline — superseded, not discarded

A previous session pinned the audit baseline at
`199e422930af85fa295e89a66d4ee908225d3fbc` and recorded it in
`docs/desktop-workspace-phase1/parent-baseline.md` **in the parent repository**. That
session had the mirror-image access problem of the Phase 0 session: it could read and write
the parent but could not write the desktop repository, so it staged its output in the parent
with a README explaining that the files did not belong there.

That interim pin is **superseded by this document**, on the same reasoning it used itself.
`199e422` was the default branch tip *at that session's time*; the tip has since advanced 5
commits:

| SHA | Subject | In audit surface? |
|-----|---------|-------------------|
| `9fd93b2` | `fix(download-url): remove cacheStatus gate from R2 resolution steps 2 and 3` | **yes** — INT-4 document flow |
| `d0f5a1d` | `feat(homepage): add Tender Document Intelligence section…` | no — marketing homepage |
| `a3ab7bf` | `docs(desktop-workspace/1.1): pin parent audit baseline` | no — the staged interim artifact |
| `17a1345` | `docs(desktop-workspace): resolve deferred phase zero pre-checks` | no — the staged interim artifact |
| `8ff2e4c` | `Merge pull request #106` | no — merge commit |

Only one of the five touches the audit surface, and the interim document flagged that file
itself: "Any *future* artifact that needs `download-url/route.ts` … must state which of the
two SHAs it read, because those files do differ." This baseline resolves that instruction by
pinning the SHA where the fix is present.

The interim artifacts' substantive findings are **not discarded**. The auth, API-envelope and
brand-hue surfaces they cite are byte-identical between `199e422` and this baseline
(verified in §2), so their findings hold here unmodified. They are carried into this
repository as `deferred-phase-0-precheck-resolutions.md`, re-based on this baseline, and every
material claim in them was **independently re-verified against parent source** before being
relied on by TASK-1.3 and TASK-1.4 — not adopted on trust.

### Parent submodule gitlink is stale

The parent added `desktop/tenders-sa-desktop` as a submodule in `07426e2`. Its gitlink points
at `cd9d2df9085eae9be307d139b70d9a633e0bd156` — `docs(desktop): add Phase 0-1 specification
suite`, the single commit that added the specification documents. It contains no `src/`, no
`src-tauri/`, and none of the Phase 0 implementation.

Anyone who initialises that submodule and reads it as "the desktop app" will find only
documents and reasonably conclude the application does not exist. Desktop-side evidence in
Phase 1 artifacts is therefore read at desktop `origin/main` (`105d5e4`), **not** at the
gitlink.

Advancing the gitlink is a parent-repository change and is out of scope for Phase 1.
Recorded as a finding for TASK-1.6.

---

## 5. Audit surface — measured at this baseline

Counted at `8ff2e4c2`, to size the remaining Phase 1 tasks honestly rather than estimate them:

| Surface | Count | Command | Consumer task |
|---------|-------|---------|---------------|
| API route handlers | **714** | `find src/app/api -name route.ts \| wc -l` | TASK-1.4 |
| Prisma models in generated schema | **193** | `grep -cE '^model ' prisma/schema.prisma` | TASK-1.2 |
| Prisma domain schema files | **35** | `ls prisma/*-domain.prisma \| wc -l` | TASK-1.2 |
| `.kiro` specification documents | **2272** | `find .kiro -name '*.md' \| wc -l` | TASK-1.6 |

The domain-file count is **35**, not the "40+" the interim artifact recorded; re-measured
here.

`prisma/schema.prisma.backup` and `prisma/schema.prisma.backups` both exist alongside the
domain files. Per TASK-1.2's pre-check the domain files are **canonical** and the backups are
**non-authoritative** — recorded now so the distinction is not rediscovered later.

714 route handlers is the number that shapes TASK-1.4. A per-route inventory of all 714 is
not what REQ-11 asks for: it scopes "every **relevant** endpoint" and "every Phase 2
dependency". TASK-1.4 therefore inventories the Phase-2-relevant subset in full per-route
detail, states its selection rule explicitly, and records the total so the coverage ratio is
visible rather than implied.

---

## 6. Read-only discipline against the parent

Phase 1 is read-only against the parent. Concretely, in this session:

- No file in `freelancing-solutions/tendersa` is created, modified, or deleted.
- No commit, no branch write, and no push is made to the parent remote.
- No schema migration, production data write, or frozen-module edit is performed.
- All parent reads are `git show`, `git log`, `git diff`, and filesystem reads.

Verified at the end of the phase by TASK-1.8, which re-runs `git status --porcelain` and
`git log origin/aws-production-app..HEAD` in the parent and records both as empty.

## 7. Constraints in force at this baseline

Carried forward from the handoff and re-affirmed:

- Parent auth, API response, database client, configuration, middleware and several services
  are frozen (Tier 1 LOCKED / Tier 2 FROZEN, registry v2.0). Contracts are consumed through
  APIs; parent changes are proposed separately, never made.
- Route code and tests at the baseline SHA **outrank** OpenAPI documentation wherever they
  disagree. Domain schema files are canonical; backups are non-authoritative.
- Tender document flow follows the existing parent Worker/R2/D1 architecture; government
  sources are never fetched directly.
- Subscription and authorization checks remain server-enforced.
- Local SQLite holds cache/offline state only, never persistent auth tokens.
- `SPEC_CONTRACT.md` is `APPROVED`; checklist changes are mirrored in both `tasks.md` and
  `SPEC_CONTRACT.md`.
- Phase 2 implementation requires a new approved contract. TASK-1.7 produces a plan, not code.

---

## 7a. Phase 2 re-verification (TASK-2.1) — 2026-07-29

Phase 2's TASK-2.1 requires re-verifying the audited contract against parent source at a current
baseline before any implementation, because this audit is a point-in-time artifact and commit
`9fd93b2` demonstrated in-scope parent routes moving within days.

**Result: the parent has not moved. The audit baseline is still current.**

| Check | Result |
|-------|--------|
| Parent tree readable | yes — 9794 tracked files, worktree clean |
| `origin/aws-production-app` tip | `8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1` |
| Commits since the audit baseline | **0** — the tip *is* the baseline |
| The 15 files cited by `auth-subscription-contract.md` | all **unchanged** |

Because the SHA is identical the files are byte-identical by definition, but the 18 load-bearing
behavioural claims were nonetheless re-asserted directly against source rather than inferred from
the SHA — Bearer precedence and its guarding parent test, the login body token and
`sameSite: 'strict'` cookie, the 10-per-15-minute IP-keyed rate limit, the three
status-indistinguishable 401s, `/me`'s 200-with-`user: null` and token re-minting and lower-cased
tier overlay, the absence of any revocation primitive, the 7-day expiry, CSRF being validated by
exactly one route and not by middleware, `/api/auth/me` being on the public allowlist while the
subscription routes are not, the synthesised free plan with `id: null`, `feature-access`'s
`hasAccess: false` inside its 500, and the absence of CORS on every needed route.

**All 18 confirmed.** One check reported a failure on first run — the synthesised-free-plan
assertion — which turned out to be a too-narrow `grep -A3` window rather than a contract change;
`id: null` sits four lines in. The finding stands; the check was wrong.

**No revision to the Phase 2 specification is required.** Implementation proceeds against
`8ff2e4c2`.

## 8. Status

| Item | Status |
|------|--------|
| Parent remote, default branch, SHA | **Confirmed** — recorded in §1 |
| `be09f9d51` existence question | **Resolved** — exists, reachable, not adopted; §2 |
| Baseline substitution disclosed | **Yes** — §2, with the eight-route justification |
| Worktree state | **Clean**, no drift to disclose; §3 |
| Frozen registry version | **2.0**, `.kiro/steering/IMMUTABLE_REGISTRY.md`; §1 |
| Reproducibility | **Yes** — clone + checkout in §1 reproduces the audited state exactly |

TASK-1.1 is complete. TASK-1.2 onward are read against `8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1`.
