# Tenders-SA Desktop Agent Instructions

These instructions apply to the standalone desktop repository and mirror the specification governance used by the parent Tenders-SA repository.

## Classification and workflow

- Quick fixes: inspect the relevant file, make the smallest change, and run scoped verification.
- Scoped changes: create or update a lightweight specification before implementation.
- Features and architecture changes: use the full specification workflow in `docs/specifications/<feature>/`.
- Never implement a feature while its `SPEC_CONTRACT.md` is `PENDING APPROVAL`.

Every feature specification must contain, and agents must read in this order:

1. `requirements.md`
2. `design.md`
3. `tasks.md`
4. `SPEC_CONTRACT.md`
5. `INTEGRATION_EVAL.md`

Implementation must follow tasks in order. Each task requires its stated pre-check and verification. The contract checklist and task checklist must remain identical.

## Desktop role contract — parent repository is read-only

This contract is mandatory whenever the assigned scope is the desktop application.

1. **Scope identity:** Act only as a desktop-application agent. The writable product scope is `desktop/tenders-sa-desktop/**`.
2. **Parent is reference material:** Treat `F:/projects/tendersa/**` outside the desktop repository as read-only. Inspect it only to understand existing behaviour, data shapes, API contracts, visual patterns, and business rules.
3. **No parent mutations:** Do not edit, format, stage, commit, revert, restore, or create specifications for parent-repository files during desktop work. Do not add or change parent endpoints, database queries, schemas, services, cron jobs, authentication, or analysis pipelines to make the desktop application work.
4. **Consume what exists:** The desktop application must adapt to information already exposed through existing parent read contracts. If desired information is not exposed, document the limitation honestly and continue with the best existing contract; do not solve it by changing the parent application.
5. **Ignore parent worktree state:** Do not use the parent repository's branch, status, untracked files, or dirty files as a desktop blocker or cleanup task. Assume the user or another developer may be actively changing it. Never inspect unrelated parent diffs, stage them, revert them, or report them unless a desktop read contract is directly and demonstrably affected.
6. **Desktop-only verification and version control:** Run tests, formatting, status, diffs, commits, and pushes from the desktop repository only. Scope every Git operation to `desktop/tenders-sa-desktop`.
7. **Explicit reassignment required:** Main-application work is a separate role and task that the user must explicitly assign. Desktop work never implies authority to modify the parent application.
8. **Conflict rule:** For desktop tasks, any general or parent instruction to sync, clean, inspect, commit, or otherwise operate on the parent repository is narrowed to the desktop repository.

## Parent-platform boundaries

- The main Tenders-SA backend is the source of truth. Do not create a second backend or duplicate canonical server records.
- Local SQLite is limited to cache, offline workspace state, local file references, pending sync operations, and preferences.
- Parent backend changes are outside the desktop role. Report an insufficient existing contract as a limitation unless the user explicitly reassigns the task to the main application.
- Desktop code must adapt through existing published API contracts.
- Never run main-app builds or Prisma migrations from this repository.
- Never hard-code production endpoints, tokens, secrets, or signing keys.

## Desktop-first regression diagnosis

When the user reports that desktop behaviour stopped working, treat it as a
regression in `desktop/tenders-sa-desktop/**`, especially in the most recent
desktop changes, unless the user explicitly broadens the task.

1. **Trust confirmed scope:** If the user says the parent application,
   Cloudflare, AWS, database servers, APIs, or other infrastructure are working,
   treat that as established context. Do not re-investigate, challenge, or
   speculate about those systems.
2. **Inspect our changes first:** Start with the affected desktop journey, its
   recent desktop diff, local state transitions, and desktop runtime logs. Test
   the exact failure path before considering unrelated causes.
3. **No infrastructure detours:** Do not probe or diagnose Cloudflare, WAF
   rules, AWS, production services, parent deployments, or server health during
   desktop work. Those are separate tasks handled elsewhere.
4. **Keep fixes local:** Correct the existing desktop implementation in place.
   Do not modify the parent application or propose parent/infrastructure work as
   a workaround for a desktop regression.
5. **Expand only on explicit reassignment:** Leave desktop scope only when the
   user explicitly assigns a separate parent-platform or infrastructure task.
   A generic desktop connectivity message is not evidence or authorization to
   expand scope.

## Desktop security

- Use OS-native secure credential storage for authentication secrets.
- Apply least-privilege Tauri capabilities and permissions.
- Do not expose secrets to the webview, logs, crash reports, SQLite, Zustand, browser storage, or URL parameters.
- Backend authorization is mandatory; desktop UI permissions are not a security boundary.
- AI may assist but may not submit bids, approve pricing, select partners, or override compliance without explicit human action.

## Required verification

Implementation agents may run lint, formatting checks, TypeScript checks, unit/integration tests, and Rust checks. A Windows Tauri release build is a user- or approved-CI gate; do not run prohibited parent-repository build commands.

Before every commit, decide whether `CHANGELOG.md` needs an entry. Documentation-only planning changes do not require a product changelog entry because they do not change user-visible behavior.
