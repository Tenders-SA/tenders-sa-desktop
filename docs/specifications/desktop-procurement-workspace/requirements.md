# Tenders-SA Desktop Procurement Workspace Requirements

## Context Note

- **Date**: 2026-07-27
- **Parent repository**: `freelancing-solutions/tendersa`, branch `aws-production-app`, reviewed at `be09f9d51`.
- **Recent related work**: recent commits completed backend route-efficiency and API-pagination work (`be09f9d51`, `72217053e`, `02783dbe5`) and continued application-workspace work. The parent working tree also contains unrelated, uncommitted application-workspace changes, so Phase 1 must audit a named commit and separately disclose worktree drift.
- **Existing integration points**: `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, `/api/tenders`, `/api/tenders/[id]`, `/api/v1/company/profile`, `/api/v1/company/profile/extended`, `/api/v1/applications`, `/api/v1/applications/[applicationId]/workspace`, `/api/v1/notifications`, `/api/subscription/feature-access/[feature]`, company-intelligence routes, internal award query routes, `docs/openapi/v1.yaml`, and the domain schemas under `prisma/`.
- **Existing data reality**: the parent already owns `User`, `Company`, `CompanyProfile`, `Tender`, `TenderDocument`, `TenderAward`, `TenderAwardSupplier`, `SupplierEnrichmentProfile`, `Application`, `ApplicationEvent`, `ApplicationDocumentVersion`, `MatchingScore`, `Notification`, and `Subscription`. The desktop client must not reproduce these as a second server authority.
- **Authentication reality**: login currently returns a JWT in the response and sets an HTTP-only cookie; browser clients normally use cookie transport. Phase 1 must explicitly validate the supported native-client contract, CSRF behavior, refresh/expiry behavior, and device logout before production authentication is implemented.
- **OpenAPI reality**: `docs/openapi/v1.yaml` documents developer-facing tender, award, company, and organisation routes, but it is not assumed to describe all internal application/workspace APIs. Generated desktop types may only use endpoints verified against live route code and the audited OpenAPI document.

## Reality Check and Decision

- **Create New — desktop client**: no desktop implementation exists in the parent repository, and the supplied GitHub repository was empty. A standalone Tauri application is a distinct, durable owner.
- **Enhance Existing — backend capability**: the parent already implements substantial tender discovery, matching, company intelligence, application assistance, subscription gating, and notifications. Phase 0–1 must consume and map these surfaces, then propose separately governed additions only for confirmed gaps.
- **No duplicate implementation discovered**: the existing web workspace is an integration reference and backend consumer, not a native offline desktop client.

## Objective

- **Why**: give South African tender teams a focused native workspace spanning discovery, evaluation, collaboration, proposal preparation, submission validation, and outcome learning.
- **Current goal**: deliver an approved, buildable Phase 0 foundation and an evidence-based Phase 1 parent API/model audit that makes Phase 2 safe to implement.
- **Long-term goal**: deliver the complete connected lifecycle described in the preserved product brief through separately approved vertical-slice specifications.

## Scope

### In scope for this contract

- Tauri 2, React, strict TypeScript, Rust, and Vite project foundation.
- Accessible desktop shell and authentication interface shell.
- Single dark-only design system and token foundation, brand-aligned to the existing Tenders-SA web palette.
- Typed, validated API-client foundation with test adapters.
- Secure runtime configuration and credential-storage abstractions.
- SQLite cache/migration foundation and offline-operation schema boundaries.
- Logging, error boundaries, test tooling, CI, and contributor documentation.
- Complete inventory of relevant parent models and endpoints at a pinned parent commit.
- Authentication, subscription, tender, company, supplier, buyer, award, matching, application-workspace, document, and notification mapping.
- Gap analysis and an implementation plan/spec proposal for Phase 2.

### Explicit non-goals

- No production implementation of Phases 2–13.
- No new backend endpoint, main-app schema change, auth-core change, payment change, or frozen-module change.
- No independent desktop backend and no replicated server source of truth.
- No automatic bid submission, pricing approval, partner commitment, or compliance override.
- No Electron fallback unless a documented and approved Tauri blocker is proven.
- No production credentials, production write operations, or mock endpoint presented as a production contract.
- No macOS or Linux build, packaging, or signing target in this contract. Windows is the only supported platform for v1; cross-platform support is a later, separately approved specification.

## Supported platforms

- **Minimum supported version: Windows 10 version 1709 or later**, including the Windows 10 Enterprise/IoT LTSC editions, and Windows 11. This matches the operating systems Microsoft supports for Edge and therefore the WebView2 runtime Tauri renders with ([Microsoft Edge supported operating systems](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-supported-operating-systems)).
- WebView2 is part of Windows 11 and is already present on the large majority of Windows 10 devices, but not all. The Windows installer therefore embeds the WebView2 offline installer (`bundle.windows.webviewInstallMode = offlineInstaller`) so installation never requires an internet connection. **Measured cost:** the packaged artifact grew from 7.8 MB to 399 MB (runs 30313966903 → 30335441194), because the NSIS and MSI installers each embed the WebView2 runtime. This is a deliberate trade for a product whose users may work from sites with poor connectivity, but it is roughly three times the original estimate and is worth revisiting — dropping one of the two installer formats would remove one copy of the embedded runtime.
- 64-bit (`x86_64`) only. ARM64 Windows is not a target for v1.
- PERF-1's start-up targets are measured on the agreed Windows 11 reference device. They are **not** a guarantee on the minimum supported configuration; start-up figures for older Windows 10 hardware require their own recorded evidence and, if they cannot be met, an approved threshold change.

## Functional Requirements

- [ ] **REQ-1 — Repository foundation**: the repository shall contain a Tauri 2 application using React, strict TypeScript, Rust, Vite, Tailwind CSS, an accessible component foundation, TanStack Query, Zustand, React Hook Form, and Zod, organised by feature.
- [ ] **REQ-2 — Native shell**: the application shall open to a responsive desktop shell with an authentication route, protected application layout, placeholder Command Centre, primary sidebar structure from the product brief, command-palette entry point, error boundary, and visible connectivity/sync indicator.
- [ ] **REQ-3 — Runtime configuration**: API base URLs, environment labels, update configuration, telemetry switches, and feature flags shall be typed, validated at startup, environment-specific, and free of embedded secrets or hard-coded production endpoints.
- [ ] **REQ-4 — Secure authentication boundary**: the foundation shall define a native authentication interface that keeps tokens in OS-backed secure storage, keeps secrets out of the webview state and SQLite, supports session restoration/logout, and remains disabled for production use until the Phase 1 native auth contract is confirmed.
- [ ] **REQ-5 — Typed API foundation**: the client shall provide cancellable requests, timeouts, bounded retries for safe idempotent operations, the parent API response envelope, runtime Zod validation, typed error normalization, correlation IDs where supported, and testable transport adapters.
- [ ] **REQ-6 — Local data boundary**: SQLite shall be used only for cache metadata, selected offline workspace projections, pending mutations, conflict metadata, recent records, local document references, and preferences. Migrations shall be ordered, versioned, reversible where practical, and covered by tests.
- [ ] **REQ-7 — Offline queue safety**: the foundation shall define idempotency keys, mutation states, retry metadata, dependency ordering, conflict detection, and a rule that proposal/pricing conflicts are never silently overwritten.
- [ ] **REQ-8 — Observability and errors**: the app shall use structured, redactable logs, user-safe error messages, crash/error boundaries, and no secret, document-content, pricing, or personal-data logging by default.
- [ ] **REQ-9 — Quality tooling**: the repository shall provide formatting, linting, TypeScript checking, Rust formatting/checking, unit tests, component tests, and CI gates; Windows packaging/signing remains an explicit approved CI or human verification gate.
- [ ] **REQ-10 — Model inventory**: Phase 1 shall produce a machine-readable or tabular inventory of relevant canonical parent models, fields needed by the desktop, relationships, ownership, provenance, access sensitivity, and confirmed gaps, pinned to a parent commit SHA.
- [ ] **REQ-11 — Endpoint inventory**: Phase 1 shall inventory every relevant endpoint with method, route, auth, CSRF/idempotency/pagination behavior, request/response source, desktop use case, availability, stability, and missing capability. Route code outranks stale documentation.
- [ ] **REQ-12 — Domain mappings**: Phase 1 shall map company profile/vault, tender/matching, supplier/company intelligence, buyer/organisation, award, application workspace, document, subscription, and notification needs to existing parent models and APIs.
- [ ] **REQ-13 — Authentication decision record**: Phase 1 shall document the supported native login/session/logout contract, token transport, expiry/renewal, CSRF requirements, device revocation, secure-storage lifecycle, and any required parent change without modifying auth during this contract.
- [ ] **REQ-14 — Gap report**: Phase 1 shall classify each missing desktop capability as client-only, existing-endpoint enhancement, new parent endpoint, additive parent data model, deferred, or rejected duplication, with risk and proposed owner.
- [ ] **REQ-15 — Phase 2 handoff**: the deliverable shall include an ordered Phase 2 plan for secure authentication and desktop shell integration, with acceptance criteria, parent dependencies, feature flags, and separate approval gates for any backend or frozen-module work.
- [ ] **REQ-16 — Brief traceability**: the original prompt shall remain verbatim under `docs/prompts/`, and every Phase 0–1 task shall trace to these requirements without claiming later roadmap phases are implemented.
- [ ] **REQ-17 — Design system and theming**: the repository shall define a single dark-only design system (color tokens, typography, spacing, elevation, and component theming) derived from the existing Tenders-SA web brand palette (emerald primary, gold accent, blue info, and existing success/warning/error semantics in `src/app/globals.css` of the parent repository), implemented as CSS custom properties consumed by Tailwind CSS and the shadcn/ui component layer, and documented in an accepted architecture decision record before TASK-0.9 (auth interface shell) or TASK-0.10 (desktop application shell) consumes it. No light-theme token set is introduced.

## Non-Functional Requirements

- [ ] **PERF-1**: on the agreed Windows 11 reference device, measured cold start to interactive shell shall target 3 seconds or less and warm start 1.5 seconds or less; deviations require recorded evidence and an approved threshold change. See §Supported platforms: these targets are defined against the reference device and are not a guarantee on the minimum supported Windows 10 configuration.
- [ ] **PERF-2**: normal shell interaction shall acknowledge input within 100 ms, and large lists shall use pagination or virtualization rather than loading unbounded records.
- [ ] **PERF-3**: cache and sync queries shall be indexed and bounded; the client shall not issue unbounded parent API requests.
- [ ] **SEC-1**: Tauri capabilities shall follow least privilege. Filesystem, shell, opener, SQL, notification, and updater access shall be granted only to windows and commands that require them.
- [ ] **SEC-2**: credentials and encryption keys shall use OS-backed secure storage; sensitive cached values shall be encrypted with keys unavailable to the webview and excluded from logs/backups where feasible.
- [ ] **SEC-3**: backend authorization and subscription enforcement remain authoritative. Hidden or disabled desktop controls are never treated as access control.
- [ ] **SEC-4**: update artifacts shall require signed update metadata and HTTPS; signing secrets shall exist only in approved CI secret storage.
- [ ] **REL-1**: a failed API call, migration, cache read, or sync replay shall not corrupt local state or lose the last confirmed server projection.
- [ ] **REL-2**: every offline mutation shall be observable and recoverable as pending, syncing, conflicted, failed, or complete.
- [ ] **A11Y-1**: the shell, forms, dialogs, tables, and command palette shall be keyboard operable, expose accessible names, preserve focus, and meet WCAG 2.2 AA contrast targets.
- [ ] **PRIV-1**: local retention shall be explicit and minimal, with logout/device reset able to remove local account data after a clear human confirmation.
- [ ] **OPS-1**: logs and audit documents shall include application version, environment, and correlation context without exposing credentials or sensitive tender content.

## Integration Requirements

- [ ] **INT-1**: authenticate only through an audited parent API contract; do not import or reimplement parent JWT signing or validation logic.
- [ ] **INT-2**: preserve the parent response-envelope contract and validate all consumed responses at the desktop boundary.
- [ ] **INT-3**: treat parent models and APIs as canonical; local identifiers must retain server IDs and sync metadata.
- [ ] **INT-4**: consume tender documents through existing application-facing download flows and never reimplement government/OCDS downloading in the desktop client.
- [ ] **INT-5**: enforce subscription/feature access using parent endpoints before exposing paid operations.
- [ ] **INT-6**: generated types may use `docs/openapi/v1.yaml` only for verified routes; uncovered routes require explicit hand-authored schemas marked `awaiting-contract` until a parent contract is approved.
- [ ] **INT-7**: any parent change discovered in Phase 1 shall be proposed in a separate parent-repository specification with frozen-module and blast-radius analysis.
- [ ] **INT-8**: later AI findings must retain source document, page where available, original excerpt, interpretation, confidence, timestamp, and verification state.

## Impact Map

### Desktop repository files

| Area | Change | Risk |
|---|---|---|
| Tauri/Rust foundation | New native runtime, capabilities, commands, plugins | High — native permissions and update security |
| React application shell | New routes, providers, feature layout | Medium |
| API/auth/storage/sync services | New adapters and contracts | High — secrets and conflict safety |
| SQLite migrations | New local-only cache schema | High — offline data integrity |
| CI and documentation | New validation and audit workflows | Medium |

### Parent repository impact

| Parent surface | Phase 0–1 action | Mutation? | Frozen tier |
|---|---|---:|---|
| Auth routes and helpers | Read/audit contracts | No | Tier 1/2 internals remain untouched |
| API response format | Consume existing envelope | No | Tier 1 |
| Tender/company/application schemas | Read/audit canonical models | No | Tier 3, additive-only if later approved |
| Tender/workspace/intelligence APIs | Read/audit and map | No | Mixed |
| OpenAPI documents | Compare to route code; report drift | No in this contract | N/A |

### Downstream effects

- **Users**: none until a later implementation and release are approved.
- **Production data**: none; Phase 0–1 performs no production writes or migrations.
- **Parent APIs**: audit traffic should use source inspection and tests, not production mutation.
- **Deployment**: new desktop CI and distribution planning only; no main-app deployment.

## Frozen Module Assessment

- This specification modifies no Tier 1, Tier 2, or Tier 3 parent file.
- The desktop client adapts to the frozen auth, API-response, logging, configuration, and feature-gating contracts through network interfaces.
- Any discovered need to change a frozen parent module stops at a written proposal and requires a separate approved impact assessment.

## Success Criteria

- [ ] The five specification files exist, are internally consistent, and the contract remains pending until human approval.
- [ ] After approved implementation, the Tauri shell passes lint, type, Rust check, and automated test gates.
- [ ] A human or approved Windows CI job confirms the application packages and launches on Windows.
- [ ] The shell can call a non-destructive audited test endpoint through the typed transport and render validated data/error states.
- [ ] Login/session code cannot be enabled for production until the native auth decision record is accepted.
- [ ] Local migrations apply cleanly to an empty database and upgrade from each prior migration fixture without losing confirmed cache state.
- [ ] The model and endpoint inventories cover every Phase 2 dependency and identify provenance, auth, pagination, and stability.
- [ ] The gap report contains no duplicate backend proposal where a suitable parent capability already exists.
- [ ] Phase 2 has a reviewable vertical-slice plan and explicit parent-repository approval boundaries.
- [ ] The dark design-system tokens are complete, single-theme only, and pass automated WCAG 2.2 AA contrast checks on every defined surface and interactive state.
