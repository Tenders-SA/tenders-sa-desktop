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

## Parent-platform boundaries

- The main Tenders-SA backend is the source of truth. Do not create a second backend or duplicate canonical server records.
- Local SQLite is limited to cache, offline workspace state, local file references, pending sync operations, and preferences.
- Backend changes belong in the parent repository and require a separately approved parent-repository specification.
- Treat the parent repository's Tier 1 and Tier 2 modules as frozen. Desktop code must adapt through published API contracts.
- Never run main-app builds or Prisma migrations from this repository.
- Never hard-code production endpoints, tokens, secrets, or signing keys.

## Desktop security

- Use OS-native secure credential storage for authentication secrets.
- Apply least-privilege Tauri capabilities and permissions.
- Do not expose secrets to the webview, logs, crash reports, SQLite, Zustand, browser storage, or URL parameters.
- Backend authorization is mandatory; desktop UI permissions are not a security boundary.
- AI may assist but may not submit bids, approve pricing, select partners, or override compliance without explicit human action.

## Required verification

Implementation agents may run lint, formatting checks, TypeScript checks, unit/integration tests, and Rust checks. A Windows Tauri release build is a user- or approved-CI gate; do not run prohibited parent-repository build commands.

Before every commit, decide whether `CHANGELOG.md` needs an entry. Documentation-only planning changes do not require a product changelog entry because they do not change user-visible behavior.
