# Tenders-SA Desktop Procurement Workspace Design

## Implementation Strategy

- **Approach**: Create a new native client; enhance existing parent capabilities only through separately approved parent work.
- **Justification**: the desktop repository was empty, while the parent repository already owns the domain data and substantial web/API workflows. A Tauri client provides native storage, notifications, filesystem integration, and offline projections without creating a second server authority.
- **Initial slice**: Phase 0 foundation plus Phase 1 audit only. Product Phases 2–13 remain roadmap inputs, not current implementation scope.
- **Primary risks**: native token handling, incomplete/stale API contracts, over-broad Tauri permissions, offline conflict loss, accidental duplication of parent models, and an oversized first implementation.
- **Mitigation**: contract-first auth, least-privilege capabilities, pinned parent audit SHA, runtime validation, local/server ownership columns, idempotent sync operations, and task/phase gates.

## Canonical Ownership

| Concern | Canonical owner | Desktop responsibility |
|---|---|---|
| Users, organisations, companies | Parent backend | Validated projections and commands |
| Tenders, documents, awards, buyers, suppliers | Parent backend/Workers as already defined | Read/cache, never scrape or re-ingest |
| Subscription and feature access | Parent backend | Query and render allowed capabilities |
| AI analyses and application workspaces | Parent backend | Workflow UI, offline projections, conflict-safe mutations |
| Auth signing and authorization | Parent backend | Securely hold client credential/session material and call audited endpoints |
| Local preferences/recent records | Desktop SQLite | Canonical on device, optionally synced only when later specified |
| Offline queue/conflicts | Desktop SQLite | Canonical until accepted/rejected by server |
| Local file references | Desktop SQLite/native filesystem | Store metadata and handles, not server document truth |

## Architecture

```text
React feature UI
    │
    ├── Query/mutation hooks ── TanStack Query cache
    ├── UI/session state ────── Zustand (no raw secrets)
    │
    ▼
Application services
    ├── typed API gateway ───── HTTPS ───── Existing Tenders-SA backend
    ├── auth port ───────────── Tauri command ── OS secure storage
    ├── repository ports ────── Tauri SQL ────── local SQLite projections
    ├── sync engine ─────────── pending operations + conflict records
    └── document port ───────── scoped native filesystem capabilities
```

The webview never receives signing keys or persistent raw credentials. Rust commands expose narrow operations such as `session_store`, `session_load`, `session_clear`, and encrypted-value operations. If the audited parent contract requires a bearer token for fetch, the design review must decide whether requests run in Rust or whether a short-lived token may be returned to memory; persistent storage in JavaScript remains prohibited.

## Proposed Repository Structure

```text
src/
├── app/
│   ├── layouts/
│   ├── providers/
│   └── router/
├── components/
│   ├── common/
│   ├── forms/
│   ├── navigation/
│   └── tables/
├── features/
│   ├── auth/
│   ├── command-centre/
│   └── settings/
├── services/
│   ├── api/
│   ├── auth/
│   ├── documents/
│   ├── storage/
│   └── sync/
├── db/
│   ├── migrations/
│   ├── repositories/
│   └── schema/
├── hooks/
├── lib/
├── tests/
└── types/
src-tauri/
├── capabilities/
├── migrations/
├── src/
│   ├── commands/
│   ├── security/
│   └── lib.rs
└── tauri.conf.json
docs/
├── architecture/
├── audits/
├── prompts/
└── specifications/
```

Only Phase 0 features are initially scaffolded. Later feature folders are created by the specification that implements them, avoiding empty architecture theatre.

## Files to Create During Implementation

| Path | Type | Purpose |
|---|---|---|
| `package.json`, `vite.config.ts`, `tsconfig*.json` | Tooling | Strict TypeScript/Vite scripts and aliases |
| `src/main.tsx`, `src/app/**` | UI foundation | Providers, routing, protected shell, errors |
| `src/components/navigation/**` | UI | Sidebar and command-palette foundation |
| `src/features/auth/**` | Feature | Disabled-by-default audited auth interface shell |
| `src/features/command-centre/**` | Feature | Non-production placeholder default route |
| `src/services/api/**` | Service | Transport, envelope, schemas, errors, test adapter |
| `src/services/auth/**` | Service | Auth ports and session lifecycle |
| `src/services/storage/**` | Service | Local repositories and encryption boundary |
| `src/services/sync/**` | Service | Queue state machine and conflict types |
| `src/db/migrations/**` | Data | Ordered local-only migrations |
| `src-tauri/src/**` | Rust | Narrow native commands and plugin setup |
| `src-tauri/capabilities/**` | Security | Least-privilege window/command permissions |
| `.github/workflows/ci.yml` | CI | Lint, types, tests, Rust checks; controlled Windows packaging |
| `.env.example` | Config | Non-secret configuration names |
| `docs/architecture/*.md` | ADRs | Security, auth, local data, sync decisions |
| `docs/audits/*.md|json` | Audit | Model, endpoint, auth, mappings, gaps, Phase 2 plan |

## Files to Modify During Implementation

| Path | Change | Why |
|---|---|---|
| `README.md` | Add setup and verification | Contributor onboarding |
| `AGENTS.md` | Only if approved workflow changes | Keep standalone governance accurate |
| `docs/specifications/desktop-procurement-workspace/tasks.md` | Check completed tasks | Execution tracking |
| `docs/specifications/desktop-procurement-workspace/SPEC_CONTRACT.md` | Mirror task checks | Machine-readable handoff |
| `docs/specifications/desktop-procurement-workspace/INTEGRATION_EVAL.md` | Record gates and evidence | Phase verification |

No parent-repository source file is modified by this implementation contract.

## Pattern References in Parent Repository

- `src/app/api/auth/login/route.ts` — current login response/cookie/CSRF behavior to audit, not copy.
- `src/app/api/auth/me/route.ts` and `src/app/api/auth/logout/route.ts` — session restoration/logout contracts.
- `src/lib/api-client.ts` — existing response/error behavior reference; desktop must replace `any` with strict validated contracts.
- `src/app/api/v1/company/profile/route.ts` and `extended/route.ts` — company data mapping.
- `src/app/api/tenders/route.ts` and `[id]/route.ts` — tender list/detail mapping and pagination assessment.
- `src/app/api/v1/applications/route.ts` and `[applicationId]/workspace/route.ts` — existing application/workspace ownership.
- `src/components/application/workspace/**` — current user workflow and status semantics.
- `prisma/user-domain.prisma`, `tender-domain.prisma`, `matching-domain.prisma`, `notification-domain.prisma`, and `subscription-domain.prisma` — canonical model evidence.
- `docs/openapi/v1.yaml` — candidate generated-client input after route-level verification.

## Runtime Configuration

Use a Zod-validated public configuration object containing only non-secret values. Environment files are developer inputs and never credential stores. Required configuration should include:

- environment name;
- HTTPS API base URL;
- allowed origin set;
- feature flags, all risky/incomplete modules defaulting off;
- telemetry enabled/disabled and redaction mode;
- update channel and public verification material;
- request timeout and safe retry bounds.

Startup fails closed with a clear local configuration error when required values are invalid.

## API Client Design

```ts
type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string | { code?: string; message: string };
  meta?: Record<string, unknown>;
};

type RequestPolicy = {
  timeoutMs: number;
  retry: 'never' | 'safe-idempotent';
  auth: 'none' | 'session';
  idempotencyKey?: string;
};
```

- Each consumed endpoint has a Zod request/response schema and a typed adapter.
- OpenAPI generation is accepted only for routes whose documentation matches route code at the audit SHA.
- The transport supports cancellation, timeouts, consistent errors, request IDs, and test injection.
- Retries are limited to safe idempotent reads unless a mutation has a server-supported idempotency key.
- 401/403, entitlement failure, validation errors, rate limits, and network/offline failures remain distinct states.

## Authentication Design Gate

Phase 0 implements interfaces and a non-production shell. Phase 1 selects the production design after auditing:

1. login request/response and cookie behavior;
2. whether native bearer usage is explicitly supported;
3. CSRF token requirements by method;
4. expiry, renewal, logout, device revocation, and account switching;
5. subscription/feature access checks;
6. whether requests must be issued by Rust to avoid persistent secrets in the webview.

Production login remains behind `desktopAuth=false` until ADR acceptance and contract tests pass. Desktop code never imports JWT secrets or signs tokens.

## Local SQLite Design

Initial tables are local infrastructure, not copies of parent domain schemas:

| Table | Purpose | Server authority? |
|---|---|---:|
| `schema_migrations` | Applied migration ledger | No |
| `cache_entries` | Key, entity type/id, ETag/version, expiry, encrypted payload flag | Parent owns payload truth |
| `recent_records` | User/device recent navigation | No |
| `local_preferences` | UI preferences | No unless later synced |
| `local_file_references` | Scoped path/handle metadata and linkage | Parent owns uploaded document truth |
| `sync_operations` | Pending mutation, idempotency key, dependencies, attempts, status | Local until server result |
| `sync_conflicts` | Local/remote versions, field policy, resolution state | Joint resolution record |

Payloads containing sensitive workspace information are encrypted through the native security boundary. Auth tokens are never stored in these tables.

## Sync State Machine

```text
PENDING → SYNCING → COMPLETE
   │          │
   │          ├── transient → PENDING (bounded backoff)
   │          ├── conflict ─→ CONFLICTED
   │          └── terminal ─→ FAILED
   └── cancelled by user ───→ CANCELLED
```

Every mutation records operation ID, account ID, entity ID, base server version, idempotency key, dependencies, safe redacted payload metadata, attempt count, and timestamps. Proposal and pricing conflicts require explicit resolution and preserve both versions.

## Tauri Security Design

- Default-deny capabilities, split by application window and command.
- No generic shell execution capability.
- Filesystem access is selected-directory or explicit-file scoped.
- SQL access is restricted to the application database and parameterized repositories.
- External URL opening uses an allowlist.
- Update verification is signed; private signing material is CI-only.
- Native commands validate all arguments and return typed, redacted errors.
- Content Security Policy forbids unapproved remote script sources.

Reference implementations must use current official Tauri 2 security, SQL, secure-storage, and updater documentation during implementation; package versions are pinned by the lockfiles rather than this specification.

## Phase 1 Audit Outputs

| File | Required content |
|---|---|
| `docs/audits/parent-baseline.md` | Parent URL, branch, commit, dirty-tree disclosure, audit commands |
| `docs/audits/model-inventory.md` | Models, fields, relationships, ownership, provenance, sensitivity, gaps |
| `docs/audits/endpoint-inventory.md` | Route/method/auth/schemas/pagination/use/gap/stability |
| `docs/audits/auth-subscription-contract.md` | Native session and feature-access decision record |
| `docs/audits/domain-mappings.md` | Company, tender, supplier, buyer, award, workspace, documents, notifications |
| `docs/audits/workspace-gap-report.md` | Gap classification, risk, owner, no-duplication evidence |
| `docs/audits/phase-2-plan.md` | First vertical slice, dependencies, flags, acceptance criteria |

Each assertion cites a parent path and, where relevant, line/handler/model evidence. Unknowns are labelled `UNCONFIRMED`, never inferred into a production contract.

## Testing and Validation Plan

- Unit-test configuration, envelope parsing, error normalization, migration ordering, sync transitions, redaction, and auth-store adapters.
- Component-test login shell, protected routing, keyboard navigation, error states, and connectivity/sync status.
- Integration-test SQLite migrations/repositories and API transport using local mock servers/fixtures, never production writes.
- Run lint, formatting check, TypeScript check, Rust formatting/check, and automated tests in CI.
- A human or approved Windows CI job performs package/build/launch verification and records the artifact/version. Coding agents do not run prohibited parent build commands.
- Audit validation compares inventories to `rg --files src/app/api`, route exports, Prisma domain model declarations, OpenAPI paths, and representative tests at the pinned SHA.

## Migration, Rollback, and Compatibility

- The first local database version starts at 1 and records checksums. Later migrations are forward-only in production, with tested backup/restore or compensating migrations for destructive cases.
- Phase 0 can be rolled back by reverting the desktop commit; it changes no parent runtime.
- Incomplete modules are feature-flagged off. The application shell remains useful for audit/dev validation without production auth.
- Parent API incompatibility fails visibly and leaves cached confirmed data intact.
- Original prompt and historical audits are preserved; superseded specifications receive pointers rather than silent deletion.

## Future Roadmap Boundary

After Phase 0–1 acceptance, each major vertical slice receives its own approved spec. Recommended order remains: authentication/shell, company profile/vault, award-supplier-buyer intelligence, tender radar, opportunity assessment, workspace core, JV/supplier workflow, proposals, pricing/returnables, validation/packaging, calendar/offline sync, and post-submission reporting.
