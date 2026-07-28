# Tenders-SA Desktop Procurement Workspace — Implementation Tasks

> **READ BEFORE STARTING**: Read all five specification files. Do not implement while `SPEC_CONTRACT.md` is `PENDING APPROVAL`. Do not skip, reorder, or combine tasks. Complete each pre-check and verification before marking a task complete. Mirror every checkbox change in `SPEC_CONTRACT.md`.

## Current Status

- [x] Specification approved by user
- [x] Phase 0 foundation complete
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

- [x] **TASK-0.6 — Implement the offline operation state machine**
  - *Refs*: REQ-7, REL-1, REL-2
  - *Files*: create `src/services/sync/**`, state-machine tests, sync ADR
  - *Pre-check*: confirm database tables and transaction APIs from TASK-0.5 match the design
  - *Verify*: tests cover pending, retry, complete, conflict, failure, cancellation, dependency ordering, and no-silent-overwrite rules
  - *Commit*: `feat(desktop-workspace/0.6): define conflict-safe sync queue`
  - *Evidence*: `docs/architecture/sync.md` records the ADR. Pre-check confirmed `sync_operations`/`sync_conflicts` carry every needed field and that the `status` CHECK constraint already enumerates exactly design.md's six states; also confirmed `tauri-plugin-sql` exposes no transaction API across IPC, so this module is written as pure transition functions persisted via single-statement UPDATEs rather than faking multi-statement atomicity (documented, with a note that a future task needing real multi-table atomicity requires a native Rust command). `src/services/sync/state-machine.ts` implements `startSync`/`resolveAttempt`/`cancel`/`resolveConflict` as pure functions throwing `InvalidTransitionError` on any edge the diagram disallows, with bounded capped-exponential backoff; `ordering.ts` topologically orders by `depends_on` (oldest-first for independents), holds back dependents of failed/cancelled/missing dependencies rather than running them out of order, and raises `DependencyCycleError` on cycles; `conflicts.ts` persists both versions with no overwrite path, guards re-resolution of an already-decided conflict, and flags `proposal`/`pricing` as human-resolution-only. 28 new tests (49 total) cover all six states, both retry-exhaustion and terminal-error paths, cancellation from every legal/illegal state, all dependency-ordering cases, and the no-silent-overwrite rules. No runner/scheduler is built yet -- driving operations through these transitions needs TASK-0.7's transport to exist first, so this task delivers decision logic plus tests only. Verified: `pnpm format:check`/`lint`/`typecheck`/`test` (49 passing)/`build` all pass; Rust side untouched and re-verified.

- [x] **TASK-0.7 — Implement the typed API transport foundation**
  - *Refs*: REQ-5, INT-2, INT-6, PERF-3
  - *Files*: create `src/services/api/**`, transport fixtures/tests, API ADR
  - *Pre-check*: compare the parent response envelope, `src/lib/api-client.ts`, audited OpenAPI metadata, and representative route responses
  - *Verify*: tests cover validation, cancellation, timeout, safe retry, envelope variants, 401/403, rate limit, offline, malformed response, and redacted error handling
  - *Commit*: `feat(desktop-workspace/0.7): add validated API transport`
  - *Evidence*: `docs/architecture/api.md` records the ADR; the OpenAPI document is pinned at `docs/audits/tenders-sa-developer-api-v2.1.0-openapi.json`. **Pre-check only partly satisfied, deliberately and explicitly**: the envelope and representative responses were verified against the live Tenders-SA Developer API (`https://api.tenders-sa.org`, v2.1.0) via non-mutating GETs, but the parent repository's `src/lib/api-client.ts` and internal routes were NOT inspected — that repo is unreachable from this session (cross-owner `add_repo` unsupported). This API is also *not* the parent-internal API requirements.md scopes: it is read-only public data with no auth-session, workspace, or mutation routes, so everything about the parent-internal contract stays `UNCONFIRMED` for TASK-1.3/1.4. Verification found design.md's `ApiEnvelope` sketch is wrong in two ways — `error` is always a plain string with `code` as a *sibling* (not `string | {code, message}`), and there is no `meta` block (pagination is `?limit`/`?cursor`) — so the implemented schema follows the verified contract, with the divergence documented at the point of definition. Also found severe OpenAPI drift per INT-6: exactly 1 of 98 endpoints documents a `200` content schema, and the `Unauthorized`/`NotFound` component responses are referenced by no endpoint; `apiSuccessEnvelope(dataSchema)` structurally forces every call site to hand-author its expected shape. 16 new tests (65 total) cover all ten enumerated cases: envelope unwrapping, malformed 2xx, unparseable non-2xx, 401/403 distinction, rate-limit retry, 5xx retry-then-give-up, retry-never policy, no-retry on 4xx, offline, timeout, caller cancellation (including pre-aborted signal), and API-key non-leakage into messages/log fields. No endpoint adapters or TanStack Query wiring yet — those belong to the feature tasks that consume specific endpoints. CSP `connect-src` is deliberately not yet widened, since nothing calls the API at runtime. Verified: `pnpm format:check`/`lint`/`typecheck`/`test` (65 passing)/`build` all pass.

- [x] **TASK-0.8 — Establish the dark design system and token foundation**
  - *Refs*: REQ-17, A11Y-1; Design §Design System and Theming
  - *Files*: create `src/styles/tokens.css`, extend `tailwind.config.ts`, create `docs/architecture/design-system.md`
  - *Pre-check*: confirm the parent web platform's brand tokens in `src/app/globals.css` (`--primary`, `--accent`, `--info`, success/warning/error/destructive) as the source hues; confirm shadcn/ui theming conventions
  - *Verify*: every token pair (background/foreground, card, popover, sidebar, primary, secondary, muted, accent, destructive, success/warning/error/info, border, input, ring, chart-1..5) is defined for the single dark theme only; automated contrast checks pass WCAG 2.2 AA on every defined surface/interactive-state pairing; no light-theme tokens, `.dark` class, or `prefers-color-scheme` branching is introduced
  - *Commit*: `feat(desktop-workspace/0.8): add dark design system tokens`
  - *Evidence*: `docs/architecture/design-system.md` records the ADR. `src/styles/tokens.css` defines every promised token for a single dark theme; `src/styles/theme.css` maps them to Tailwind's semantic utilities. **The automated contrast check found six real AA failures in design.md's proposed table** — `destructive-foreground` on `destructive` (3.87), `error` as text on `card` (4.39), and four border/input pairings (1.22–1.39) — all corrected: `--destructive`/`--error` moved `58%`→`59%` with `--destructive-foreground` flipped to dark (dark-on-red at 4.79, versus darkening the red to ~35% which stops reading as an alert), and `--input` raised `19%`→`42%`. `--border` deliberately stays decorative at `17%`: SC 1.4.11 governs information identifying controls, not dividers/card edges — pinned by a test asserting `--border` stays below 3:1 *and* `--input` clears it, so nobody raises the wrong one. `src/tests/design-tokens.test.ts` (34 assertions) parses the shipped CSS rather than restating values, so an unchecked token edit fails the suite; it covers 23 text pairs at 4.5:1, 6 non-text pairs at 3:1, all chart series on both surfaces, token completeness, the single-theme absences (no `.dark`, no `prefers-color-scheme`, no `[data-theme]`, exactly one `:root` block — judged against comment-stripped CSS), and the tightened radius. **Deviations**: no `tailwind.config.ts` — Tailwind v4 configures via CSS `@theme`, which matches REQ-17's "CSS custom properties consumed by Tailwind" better than a JS object; and the pre-check's parent `src/app/globals.css` was NOT readable from this session (same parent-repo blocker as TASK-0.7), so hues came from design.md's second-hand record and should be verified directly by a session with parent access. No shadcn/ui components installed yet — tokens are the contract they'll be generated against. `App.tsx` migrated onto semantic utilities and `App.css` deleted; verified in the production build that `.text-muted-foreground` resolves to `hsl(var(--muted-foreground))`. Verified: `pnpm format:check`/`lint`/`typecheck`/`test` (99 passing)/`build` all pass.

- [x] **TASK-0.9 — Build the authentication interface shell**
  - *Refs*: REQ-4, REQ-13, INT-1, INT-5
  - *Files*: create `src/features/auth/**`, `src/services/auth/**`, auth adapter tests, feature flag
  - *Pre-check*: confirm production auth is disabled, confirm TASK-0.8 design tokens are available, and review the current parent login/me/logout route behavior without changing it
  - *Verify*: login/session/logout ports are testable; secrets never enter persistent webview state; production authentication remains gated pending TASK-1.3; the login shell renders using design-system tokens only
  - *Commit*: `feat(desktop-workspace/0.9): add gated auth shell`
  - *Evidence*: `src/services/auth/ports.ts` defines the login/session/logout ports plus a closed `AuthFailureKind` union; `native-credential-store.ts` persists tokens only through TASK-0.4's `session_store`/`session_load`/`session_clear` (OS keychain), never SQLite/Zustand/browser storage. **The REQ-4 gate is enforced in code, not just config**: `GatedAuthService.isEnabled()` requires BOTH the `desktopAuth` flag AND an audited adapter, so flipping the flag alone cannot authenticate against an unaudited contract — no audited adapter exists yet, and supplying one would mean guessing at a security contract before TASK-1.3. Session *restoration* is gated identically, so a token left by an earlier build cannot silently grant a session; logout is deliberately always permitted (refusing to let a user drop stored credentials because a flag is off would be backwards, PRIV-1) and still clears locally when the adapter's remote logout fails. `src/features/auth/LoginShell.tsx` renders visibly disabled with a `role="status"` explanation rather than faking a working form, using design-system tokens only. 18 new tests (117 total): gate behaviour in both directions, adapter never invoked while gated, stale-token restoration blocked, logout-always-clears, no `Storage.setItem` call, password absent from thrown errors and from the DOM, accessible names on every field, and a check that the markup uses semantic tokens and no raw Tailwind palette colours. **Pre-check partly blocked**: production-auth-disabled ✓ and TASK-0.8 tokens ✓ both confirmed, but "review the current parent login/me/logout route behavior" could NOT be done — `freelancing-solutions/tendersa` is visible to the account yet cannot be added to this session (cross-owner adds unsupported; session scoped to `tenders-sa`). Doing it needs a new session started with the parent repo as its initial source. The parent contract therefore stays UNCONFIRMED for TASK-1.3. Verified: `pnpm format:check`/`lint`/`typecheck`/`test` (117 passing)/`build` all pass.

- [x] **TASK-0.10 — Build the accessible desktop application shell**
  - *Refs*: REQ-2, A11Y-1, PERF-1, PERF-2
  - *Files*: create router/providers/layouts, navigation, command palette, Command Centre placeholder, error and sync-status components/tests
  - *Pre-check*: verify brief navigation labels, confirm TASK-0.8 design tokens are available, and ensure no later-phase feature is represented as functional
  - *Verify*: protected-route, keyboard, focus, empty/loading/error, responsive layout, and sync/connectivity tests pass; performance measurement harness exists; shell renders using design-system tokens only
  - *Commit*: `feat(desktop-workspace/0.10): add accessible desktop shell`
  - *Evidence*: `src/app/{layouts,providers,router}/**` provide the layout, QueryClient/error-boundary providers, and routes; `src/components/navigation/**` the sidebar and Ctrl/Cmd+K command palette; `src/components/common/**` the error boundary and sync/connectivity indicator; `src/features/command-centre/` the placeholder; `src/lib/performance.ts` the measurement harness. **Pre-check**: navigation labels transcribed verbatim from the brief's §5 (19 items in 3 groups) and pinned by a test that fails if they drift; TASK-0.8 tokens confirmed present. **No later-phase feature is represented as functional** — `navigation-items.ts` carries an `available` flag, only Command Centre is true, and unavailable items are given no `path` at all, render as `aria-disabled` spans rather than links, and appear disabled in the command palette so it cannot become a back door into an unbuilt route; tests assert all three. `ProtectedRoute` has an `allowUnauthenticated` escape hatch, on only while TASK-0.9's auth gate is closed (otherwise the shell would be unreachable, since no session can be established); it is derived from `auth.isEnabled()` so it flips off automatically when auth ships, and authorization remains server-enforced regardless (SEC-3). The error boundary shows a deliberately generic message — a thrown error can carry pricing or payload fragments — with diagnostics going to an injected reporter; a test throws an error containing a fake pricing value and asserts it never reaches the DOM. `SyncStatus` labels state in text, never colour alone. The performance harness records marks and the PERF-1/PERF-2 targets but deliberately asserts **no** threshold: a pass/fail computed on CI or developer hardware would be evidence of nothing, so real Windows-reference-device numbers are TASK-0.13's job. 23 new tests (139 total) cover navigation fidelity, later-phase non-functionality, skip-link focus order, palette open/close/filter/empty-state/focus-restore, protected-route redirect in all three states, error-boundary redaction, and sync-status text labelling. TanStack Query retry is disabled at the provider because TASK-0.7's transport already applies bounded retries — layering both would multiply attempts and defeat PERF-3. Verified: `pnpm format:check`/`lint`/`typecheck`/`test` (139 passing)/`build` all pass.

- [x] **TASK-0.11 — Add structured logging and redaction**
  - *Refs*: REQ-8, OPS-1, PRIV-1
  - *Files*: create `src/services/observability/**`, Rust log bridge, redaction tests, observability ADR
  - *Pre-check*: inventory all Phase 0 error boundaries and native command failure paths
  - *Verify*: tests prove credentials, pricing, document content, and personal values are redacted; user-visible errors remain generic and actionable
  - *Commit*: `feat(desktop-workspace/0.11): add redacted observability`
  - *Evidence*: `docs/architecture/observability.md` records the ADR, including the pre-check inventory (6 TS error types + the React boundary, and 5 native commands funnelling through `SecurityError`, plus SQL plugin errors). **Redaction is allowlist-based, not denylist-based**: `src/services/observability/redaction.ts` keeps a field only when its key is on a short operational allowlist (`status`, `code`, `requestId`, `durationMs`, …) and drops everything else in `strict` mode — a denylist silently leaks every field nobody thought of, which is unacceptable where the data is tender pricing, document content, and personal information. Two layers sit on top: an `ALWAYS_REDACT` key pattern that drops credential-shaped keys in *both* modes, and value-level scrubbing for bearer tokens, JWTs, `tsa_prod_*` keys, emails, 13-digit SA ID numbers, rand amounts, and card-like runs. `Error` instances are reduced to `{name, message: '[redacted]'}` since messages routinely quote the failing payload. `standard` mode keeps scrubbed unknown values for local debugging and is explicitly not the production default (TASK-0.3 defaults `redactionMode` to `strict`). **The Rust bridge re-redacts independently** (`src-tauri/src/observability/**`): the IPC boundary is where "the caller already sanitised it" stops being safe, so a bypassing call site or a TS redactor bug cannot write raw tender content to disk. It accepts flat string pairs rather than arbitrary JSON, deliberately — nested input would mean maintaining a second recursive scrubber in Rust with two implementations to keep in sync — and validates event-name length plus truncates fields to 2 KiB. The native scrubber is hand-rolled rather than regex-crate-based to keep the security-adjacent dependency surface small. `nativeSink` falls back to the console when the bridge is unavailable rather than throwing: losing a log line must never break the app. The error boundary now reports through the logger while its on-screen text stays fixed and generic — a crash screen is exactly what users screenshot into tickets. 35 new tests (161 TS + 26 Rust): all seven sensitive value shapes, allowlist behaviour in both modes, credential keys dropped in both, `Error` reduction, nested/array handling, recursion depth limit, logger context/correlation/disabled behaviour, and independent Rust re-redaction. Not built: telemetry export, remote crash reporting, log rotation — each sends data off-device and needs its own privacy decision. Verified: `cargo check`/`cargo fmt --check`/`cargo test` (26 passing) and `pnpm format:check`/`lint`/`typecheck`/`test` (161 passing)/`build` all pass.

- [x] **TASK-0.12 — Configure CI and contributor documentation**
  - *Refs*: REQ-9, REQ-16, SEC-4
  - *Files*: create `.github/workflows/ci.yml`, update `README.md`, create development/release docs
  - *Pre-check*: confirm agent build restrictions and decide which Windows package check requires human/approved-CI execution
  - *Verify*: CI syntax is valid; required non-build checks are represented; signing secrets are referenced only by secret names; contributor setup is reproducible
  - *Commit*: `chore(desktop-workspace/0.12): document and automate checks`
  - *Evidence*: `.github/workflows/ci.yml` runs the non-build gates on every push and PR — a `frontend` job (`format:check`, `lint`, `typecheck`, `test`, `build`) and a `rust` job (`fmt --check`, `clippy -D warnings`, `check`, `test`), with concurrency cancellation and `permissions: contents: read`. The Linux runner installs `libgtk-3-dev`/`libwebkit2gtk-4.1-dev`/`libayatana-appindicator3-dev`/`librsvg2-dev`, needed only so Tauri's Linux backend compiles for `cargo check` — the shipped product is Windows/WebView2. **Pre-check decision**: `AGENTS.md` makes a Windows release build a human- or approved-CI gate, so packaging is deliberately NOT in `ci.yml`; it lives in `.github/workflows/windows-package.yml` as `workflow_dispatch`-only, which logs the requesting actor. Running it on push would defeat the gate. **Signing secrets are referenced by name only** (SEC-4): `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` appear solely as `${{ secrets.* }}` expressions behind an opt-in `sign` input; no key material is in the repository, and unsigned artifacts are the default for test packages. Both workflows were parsed with a YAML loader to verify syntax rather than assumed valid (`ci.yml` → triggers `push`/`pull_request`, jobs `frontend`/`rust`; `windows-package.yml` → trigger `workflow_dispatch`, job `package`). `cargo clippy -- -D warnings` was run locally first and passes clean, so CI does not land red on its first run. Contributor setup is reproducible via `docs/development.md` (prerequisites, the Linux/macOS system-library caveat with the exact `gdk-sys` failure it prevents, the verification commands verbatim as CI runs them, and repository conventions) and `docs/release.md` (manual packaging procedure, the secrets table, and precisely what evidence TASK-0.13 needs). `README.md` was corrected — it still claimed "No product implementation has been approved or started", which is no longer true — and now carries a per-area implemented/not-implemented table so nothing reads as more finished than it is (REQ-16). Verified: all CI-equivalent commands pass locally.

### Phase 0 Evaluation Gate

- [x] **TASK-0.13 — Evaluate Phase 0 foundation**
  - *Refs*: REQ-1 through REQ-9, REQ-16, REQ-17; Design §Testing and Validation Plan
  - *Files*: update `INTEGRATION_EVAL.md`, `tasks.md`, `SPEC_CONTRACT.md`
  - *Pre-check*: read every Phase 0 requirement and collect command/test evidence
  - *Verify*: all Phase 0 checks pass, including dark design-token contrast evidence; human/approved Windows packaging evidence is attached or the task remains incomplete
  - *Commit*: `docs(desktop-workspace/0.13): record phase zero evaluation`
  - *Evidence*: `INTEGRATION_EVAL.md` records the full Phase 0 evaluation at commit `ea02e08`. **All automated gates pass**: `pnpm format:check`/`lint`/`typecheck`/`test` (161 tests, 13 files)/`build`, and `cargo fmt --check`/`clippy -D warnings`/`test` (26 tests) — 187 tests total — plus CI run 30334729707 green on both jobs. **Windows packaging evidence exists**: two human-triggered `workflow_dispatch` runs by @freelancing-solutions succeeded — 30313966903 (`e0cd4c9`, 7.8 MB) and 30335441194 (`ea02e08`, 399 MB, NSIS + MSI). That satisfies the human/approved-CI packaging gate. **The task nonetheless remains incomplete, by its own rule.** Two things are not evidenced: (1) *launch* — the installer builds and packages, but nobody has installed and started the application; a green build proves compilation and bundling, not that the window opens; (2) *PERF-1* — no cold/warm start measurements exist for the agreed Windows 11 reference device, and figures from CI or a developer machine would not satisfy a target defined against that device. Additionally, three Phase 0 pre-checks were deferred into Phase 1 because `freelancing-solutions/tendersa` cannot be added to this session (cross-owner adds unsupported): the parent auth contract (TASK-0.9), the parent API envelope and `src/lib/api-client.ts` (TASK-0.7), and the parent brand hues in `src/app/globals.css` (TASK-0.8). Also recorded: the packaging runs measured the offline WebView2 installer's real cost at +391 MB rather than the ~127 MB estimated when it was approved, because NSIS and MSI each embed a copy — documentation corrected in commit `6cc3807`.
  - *Update 2026-07-28 (resolved)*: **launch confirmed and PERF-1 met.** The user installed the packaged build, ran it, and confirmed cold start **under 3 seconds** against the 3-second target. An initial first-run launch measured ~5s; that figure carried one-time costs a steady-state cold start does not — WebView2 first-run initialisation and the initial SQLite migration — and is recorded because it will mislead anyone who re-measures on a fresh install. No threshold change was needed. TASK-0.13 and Phase 0 are complete.

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
