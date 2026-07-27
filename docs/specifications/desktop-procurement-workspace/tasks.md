# Tenders-SA Desktop Procurement Workspace — Implementation Tasks

> **READ BEFORE STARTING**: Read all five specification files. Do not implement while `SPEC_CONTRACT.md` is `PENDING APPROVAL`. Do not skip, reorder, or combine tasks. Complete each pre-check and verification before marking a task complete. Mirror every checkbox change in `SPEC_CONTRACT.md`.

## Current Status

- [x] Specification approved by user
- [ ] Phase 0 foundation complete
- [ ] Phase 1 audit complete
- [ ] Integration evaluation passed
- [ ] All Phase 0–1 success criteria verified

## Phase 0A: Repository and Native Foundation

- [x] **TASK-0.1 — Scaffold the Tauri 2 workspace**
  - *Refs*: REQ-1, REQ-9; Design §Proposed Repository Structure
  - *Files*: create `package.json`, lockfiles, TypeScript/Vite config, `src/main.tsx`, `src-tauri/**`
  - *Pre-check*: verify the repository contains only approved documentation and load current official Tauri 2 project/security guidance
  - *Verify*: strict TypeScript configuration resolves; Rust project metadata is valid; lint/type/Rust-check scripts exist and run without a release build
  - *Commit*: `feat(desktop-workspace/0.1): scaffold Tauri workspace`
  - *Evidence*: scaffolded via `create-tauri-app` (Tauri 2, React 19, strict TypeScript, Vite 7). `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass. `cargo check --manifest-path src-tauri/Cargo.toml` and `cargo fmt --check` pass (required installing `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev` in the sandbox — Tauri's Linux backend needs these for `cargo check` to compile at all; they are not part of the Windows-only v1 product target). No release/bundle build was run, per the Windows packaging gate in `AGENTS.md` and `SPEC_CONTRACT.md`. Demo `greet` command and default template UI were removed to avoid presenting placeholder functionality as real (design.md: "avoid empty architecture theatre"). Bundle targets in `tauri.conf.json` are restricted to `nsis`/`msi` (Windows-only, REQ non-goal).

- [x] **TASK-0.2 — Configure frontend quality and test tooling**
  - *Refs*: REQ-1, REQ-9, A11Y-1
  - *Files*: create lint/format/test configs, `src/tests/**`, shared test setup
  - *Pre-check*: inspect TASK-0.1 scripts and avoid overlapping formatter/linter ownership
  - *Verify*: formatting check, lint, TypeScript check, and one smoke unit/component test pass
  - *Commit*: `chore(desktop-workspace/0.2): add quality gates`
  - *Evidence*: added Prettier (`.prettierrc.json`, `.prettierignore` — spec docs under `docs/` excluded from automated formatting), `eslint-config-prettier` to avoid stylistic conflicts with TASK-0.1's ESLint config, and `eslint-plugin-jsx-a11y` recommended rules for A11Y-1. Added Vitest + Testing Library (`src/tests/setup.ts`, `src/tests/App.test.tsx`) via a `test` block in `vite.config.ts`, no separate config to avoid duplicate tool ownership. `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` (1 passing smoke test) all pass; `pnpm build` and `pnpm rust:check` re-verified unaffected.

- [x] **TASK-0.3 — Implement validated runtime configuration**
  - *Refs*: REQ-3, SEC-4, OPS-1
  - *Files*: create `.env.example`, `src/app/config/**`, configuration tests, updater configuration placeholder
  - *Pre-check*: confirm no secrets or production endpoint are present in Git history/worktree
  - *Verify*: valid environments load; missing/invalid values fail closed; tests prove secrets cannot be part of public config
  - *Commit*: `feat(desktop-workspace/0.3): validate runtime configuration`
  - *Evidence*: `src/app/config/schema.ts` defines a strict Zod schema (environment, HTTPS API base URL with a localhost-only http exception, allowed origins, feature flags defaulting risky/incomplete modules off, telemetry + redaction mode, an updater channel/public-key placeholder, and request timeout/retry bounds). `src/app/config/load-config.ts` builds the config candidate from an explicit VITE_-prefixed allowlist — no `...env` spread — so unrelated values (including anything secret-shaped) in the same `.env` file can never reach the parsed config, and throws a `ConfigError` listing every issue when required values are missing or invalid (fail closed). `src/tests/config.test.ts` (7 tests) proves valid-load, default-off feature flags, fail-closed on missing/invalid/non-https-production values, and that secret-shaped extra env keys never appear in the output. Config is not yet imported by `main.tsx`/`App.tsx` — wiring it into the running shell belongs to the tasks that actually consume it (API transport, auth, desktop shell), consistent with design.md's "avoid empty architecture theatre." Pre-check: `grep` across `src/`, `.env.example`, and Tauri config for credential/production-endpoint patterns found none. Verified: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (8 passing), `pnpm build`, and `pnpm rust:check` all pass.

- [x] **TASK-0.4 — Establish least-privilege native security commands**
  - *Refs*: REQ-4, SEC-1, SEC-2, SEC-4
  - *Files*: create `src-tauri/capabilities/**`, `src-tauri/src/security/**`, `src-tauri/src/commands/**`, security ADR
  - *Pre-check*: load current official Tauri 2 capabilities, secure-storage, CSP, and updater documentation
  - *Verify*: capability audit shows default deny, no generic shell permission, scoped filesystem access, typed command input validation, and secret redaction tests
  - *Commit*: `feat(desktop-workspace/0.4): add native security boundary`
  - *Evidence*: `docs/architecture/security.md` records the full ADR. `capabilities/default.json` grants only `core:default` (audited against the pinned tauri 2.11.5 source: no fs/shell/SQL/HTTP reach) plus five explicit `allow-*` permissions for our own commands (auto-generated by `tauri-build`'s `AppManifest::commands(...)` in `build.rs`); the TASK-0.1 scaffold's `tauri-plugin-opener` (unscoped `http(s)://*` + reveal-in-dir) was removed as a SEC-1 violation with nothing yet using it. `security::secret_store` (`SecretStore` trait, `OsKeychain` via the `keyring` crate v4 — Windows Credential Manager/macOS Keychain/pure-Rust Linux Secret Service, no `libdbus` needed — and a test-only `InMemorySecretStore`) backs `session_store`/`session_load`/`session_clear` over a closed `SessionKey` enum. `security::encryption` (AES-256-GCM) backs `encrypt_value`/`decrypt_value` for future local-cache payloads (TASK-0.5). All commands validate key/value length before touching storage and return `SecurityError`, which never carries secret material (tested). `tauri.conf.json`'s CSP moved from `null` to a `script-src 'self'` policy forbidding remote script sources. **Pre-check note**: `v2.tauri.app` is blocked by this sandbox's egress policy (403); used the pinned `tauri`/`tauri-build`/`tauri-utils` crate source under `~/.cargo/registry` instead, which for a lockfile-pinned implementation is the more exact source anyway. Verified: `cargo check`, `cargo fmt --check`, and `cargo test` (9 passing, including secret-redaction and tamper-rejection cases) all pass; `pnpm format:check`/`lint`/`typecheck`/`test`/`build` re-verified unaffected.

## Phase 0B: Data, API, Sync, and Shell

- [x] **TASK-0.5 — Add local SQLite migrations and repositories**
  - *Refs*: REQ-6, REL-1, PRIV-1; Design §Local SQLite Design
  - *Files*: create `src/db/**`, `src/services/storage/**`, migration fixtures/tests, local-data ADR
  - *Pre-check*: confirm every proposed table is local infrastructure rather than a duplicate parent domain owner
  - *Verify*: migrations apply to empty and prior-version fixtures; parameterized repository tests pass; auth secrets cannot be persisted
  - *Commit*: `feat(desktop-workspace/0.5): add local cache database`
  - *Evidence*: `docs/architecture/local-data.md` records the full ADR, including the pre-check table-by-table against design.md's Canonical Ownership table. `src-tauri/migrations/{0001_init,0002_add_lookup_indexes}.sql` define all six local tables via `tauri-plugin-sql` (no hand-rolled `schema_migrations` ledger -- the plugin already tracks applied migrations, documented as a deliberate deviation). `src-tauri/src/db/mod.rs` tests apply the same SQL directly via `rusqlite` (dev-only) against a real in-memory database: empty-apply, upgrade-from-0001-only fixture without data loss, and the `sync_operations` CHECK/UNIQUE constraints (13 Rust tests total). `src/db/executor.ts`'s `SqlExecutor` interface plus a recording fake let `src/tests/db-repositories.test.ts` assert repositories (`cache_entries`, `local_preferences`, `sync_operations`) bind values as parameters rather than string-interpolating them. `src/services/storage/cache.ts` routes `sensitive` payloads through TASK-0.4's `encrypt_value`/`decrypt_value` before they ever reach a SQL parameter; `src/tests/storage-cache.test.ts` asserts a raw secret string never appears in the recorded SQL call. `recent_records`, `local_file_references`, and `sync_conflicts` get schema + migration only, no repository yet -- their query functions arrive with the task that first consumes them (documented in the ADR). Also removed the unused `@tauri-apps/plugin-opener`/`tauri-plugin-opener` leftover from the TASK-0.4 capability removal. Verified: `cargo check`, `cargo fmt --check`, `cargo test` (13 passing); `pnpm format:check`/`lint`/`typecheck`/`test` (21 passing)/`build` all pass.

- [ ] **TASK-0.6 — Implement the offline operation state machine**
  - *Refs*: REQ-7, REL-1, REL-2
  - *Files*: create `src/services/sync/**`, state-machine tests, sync ADR
  - *Pre-check*: confirm database tables and transaction APIs from TASK-0.5 match the design
  - *Verify*: tests cover pending, retry, complete, conflict, failure, cancellation, dependency ordering, and no-silent-overwrite rules
  - *Commit*: `feat(desktop-workspace/0.6): define conflict-safe sync queue`

- [ ] **TASK-0.7 — Implement the typed API transport foundation**
  - *Refs*: REQ-5, INT-2, INT-6, PERF-3
  - *Files*: create `src/services/api/**`, transport fixtures/tests, API ADR
  - *Pre-check*: compare the parent response envelope, `src/lib/api-client.ts`, audited OpenAPI metadata, and representative route responses
  - *Verify*: tests cover validation, cancellation, timeout, safe retry, envelope variants, 401/403, rate limit, offline, malformed response, and redacted error handling
  - *Commit*: `feat(desktop-workspace/0.7): add validated API transport`

- [ ] **TASK-0.8 — Establish the dark design system and token foundation**
  - *Refs*: REQ-17, A11Y-1; Design §Design System and Theming
  - *Files*: create `src/styles/tokens.css`, extend `tailwind.config.ts`, create `docs/architecture/design-system.md`
  - *Pre-check*: confirm the parent web platform's brand tokens in `src/app/globals.css` (`--primary`, `--accent`, `--info`, success/warning/error/destructive) as the source hues; confirm shadcn/ui theming conventions
  - *Verify*: every token pair (background/foreground, card, popover, sidebar, primary, secondary, muted, accent, destructive, success/warning/error/info, border, input, ring, chart-1..5) is defined for the single dark theme only; automated contrast checks pass WCAG 2.2 AA on every defined surface/interactive-state pairing; no light-theme tokens, `.dark` class, or `prefers-color-scheme` branching is introduced
  - *Commit*: `feat(desktop-workspace/0.8): add dark design system tokens`

- [ ] **TASK-0.9 — Build the authentication interface shell**
  - *Refs*: REQ-4, REQ-13, INT-1, INT-5
  - *Files*: create `src/features/auth/**`, `src/services/auth/**`, auth adapter tests, feature flag
  - *Pre-check*: confirm production auth is disabled, confirm TASK-0.8 design tokens are available, and review the current parent login/me/logout route behavior without changing it
  - *Verify*: login/session/logout ports are testable; secrets never enter persistent webview state; production authentication remains gated pending TASK-1.3; the login shell renders using design-system tokens only
  - *Commit*: `feat(desktop-workspace/0.9): add gated auth shell`

- [ ] **TASK-0.10 — Build the accessible desktop application shell**
  - *Refs*: REQ-2, A11Y-1, PERF-1, PERF-2
  - *Files*: create router/providers/layouts, navigation, command palette, Command Centre placeholder, error and sync-status components/tests
  - *Pre-check*: verify brief navigation labels, confirm TASK-0.8 design tokens are available, and ensure no later-phase feature is represented as functional
  - *Verify*: protected-route, keyboard, focus, empty/loading/error, responsive layout, and sync/connectivity tests pass; performance measurement harness exists; shell renders using design-system tokens only
  - *Commit*: `feat(desktop-workspace/0.10): add accessible desktop shell`

- [ ] **TASK-0.11 — Add structured logging and redaction**
  - *Refs*: REQ-8, OPS-1, PRIV-1
  - *Files*: create `src/services/observability/**`, Rust log bridge, redaction tests, observability ADR
  - *Pre-check*: inventory all Phase 0 error boundaries and native command failure paths
  - *Verify*: tests prove credentials, pricing, document content, and personal values are redacted; user-visible errors remain generic and actionable
  - *Commit*: `feat(desktop-workspace/0.11): add redacted observability`

- [ ] **TASK-0.12 — Configure CI and contributor documentation**
  - *Refs*: REQ-9, REQ-16, SEC-4
  - *Files*: create `.github/workflows/ci.yml`, update `README.md`, create development/release docs
  - *Pre-check*: confirm agent build restrictions and decide which Windows package check requires human/approved-CI execution
  - *Verify*: CI syntax is valid; required non-build checks are represented; signing secrets are referenced only by secret names; contributor setup is reproducible
  - *Commit*: `chore(desktop-workspace/0.12): document and automate checks`

### Phase 0 Evaluation Gate

- [ ] **TASK-0.13 — Evaluate Phase 0 foundation**
  - *Refs*: REQ-1 through REQ-9, REQ-16, REQ-17; Design §Testing and Validation Plan
  - *Files*: update `INTEGRATION_EVAL.md`, `tasks.md`, `SPEC_CONTRACT.md`
  - *Pre-check*: read every Phase 0 requirement and collect command/test evidence
  - *Verify*: all Phase 0 checks pass, including dark design-token contrast evidence; human/approved Windows packaging evidence is attached or the task remains incomplete
  - *Commit*: `docs(desktop-workspace/0.13): record phase zero evaluation`

## Phase 1: Parent Data and API Audit

- [ ] **TASK-1.1 — Pin and document the parent audit baseline**
  - *Refs*: REQ-10, REQ-11, INT-7
  - *Files*: create `docs/audits/parent-baseline.md`
  - *Pre-check*: confirm parent remote, branch, commit SHA, working-tree state, and frozen registry version
  - *Verify*: another contributor can check out the exact audited parent state; unrelated worktree drift is disclosed separately
  - *Commit*: `docs(desktop-workspace/1.1): pin parent audit baseline`

- [ ] **TASK-1.2 — Inventory canonical parent data models**
  - *Refs*: REQ-10, REQ-12, INT-3
  - *Files*: create `docs/audits/model-inventory.md` and optional generated inventory JSON
  - *Pre-check*: enumerate domain schemas and generated schema, treating domain files as canonical and backups as non-authoritative
  - *Verify*: all required desktop entities map to a canonical model, local projection, confirmed gap, or explicit deferred status with path evidence
  - *Commit*: `docs(desktop-workspace/1.2): inventory parent models`

- [ ] **TASK-1.3 — Audit authentication and subscription contracts**
  - *Refs*: REQ-4, REQ-13, INT-1, INT-5
  - *Files*: create `docs/audits/auth-subscription-contract.md`, approved auth ADR update, contract fixtures
  - *Pre-check*: inspect login/me/logout, JWT request verification behavior, CSRF, middleware, feature-access, and subscription routes/tests at the pinned SHA
  - *Verify*: document token/cookie transport, expiry/renewal, CSRF, logout/revocation, device/account switching, entitlement checks, error cases, and a production enable/blocked decision
  - *Commit*: `docs(desktop-workspace/1.3): decide native auth contract`

- [ ] **TASK-1.4 — Inventory relevant parent endpoints and OpenAPI drift**
  - *Refs*: REQ-11, INT-2, INT-6
  - *Files*: create `docs/audits/endpoint-inventory.md` and optional generated inventory JSON
  - *Pre-check*: enumerate route handlers and compare them with both parent OpenAPI documents and representative tests
  - *Verify*: every Phase 2 dependency records route, method, auth, schemas, pagination, idempotency/CSRF, evidence path, stability, and missing capability; undocumented assumptions are labelled
  - *Commit*: `docs(desktop-workspace/1.4): inventory parent endpoints`

- [ ] **TASK-1.5 — Produce cross-domain desktop mappings**
  - *Refs*: REQ-12, INT-3, INT-4, INT-8
  - *Files*: create `docs/audits/domain-mappings.md`
  - *Pre-check*: load model and endpoint inventories and the canonical parent tender-document architecture before mapping document flows
  - *Verify*: company/vault, tender/matching, supplier, buyer, award, workspace, document, subscription, and notification needs each map to source, endpoint, local projection, provenance, and access rule
  - *Commit*: `docs(desktop-workspace/1.5): map desktop domains`

- [ ] **TASK-1.6 — Create the capability gap report**
  - *Refs*: REQ-14, INT-7
  - *Files*: create `docs/audits/workspace-gap-report.md`
  - *Pre-check*: search parent routes, services, components, specs, and TODOs for every apparent gap
  - *Verify*: each gap is classified client-only, enhance endpoint, new endpoint, additive model, deferred, or rejected duplication, with evidence, risk, owner, and approval boundary
  - *Commit*: `docs(desktop-workspace/1.6): classify capability gaps`

- [ ] **TASK-1.7 — Define the Phase 2 vertical slice**
  - *Refs*: REQ-15, all Phase 0–1 outputs
  - *Files*: create `docs/audits/phase-2-plan.md`; create a new Phase 2 spec only after user direction
  - *Pre-check*: confirm Phase 0 evaluation and all Phase 1 audits are complete and internally consistent
  - *Verify*: plan contains scope/non-goals, dependencies, feature flags, parent proposals, file impact, acceptance criteria, tests, rollout, rollback, and human approval gates
  - *Commit*: `docs(desktop-workspace/1.7): plan phase two slice`

### Final Evaluation Gate

- [ ] **TASK-1.8 — Complete final integration evaluation**
  - *Refs*: all requirements and success criteria
  - *Files*: update `requirements.md`, `tasks.md`, `SPEC_CONTRACT.md`, `INTEGRATION_EVAL.md`
  - *Pre-check*: audit task/contract parity and trace every requirement to evidence
  - *Verify*: all checks pass, no parent file was modified, commit history is task-scoped, and the contract records PASS or a precise blocker
  - *Commit*: `docs(desktop-workspace/1.8): complete integration evaluation`
