# Hard-wired production origin — lightweight specification

**Status**: IMPLEMENTED
**Date**: 2026-08-07
**User direction**: "pointing it at production should never be conditional"
**Type**: Scoped change (config hardening, no new capability)

## 1. Problem

The application's API base URL is `https://www.tenders-sa.org` **by default**,
but the runtime could be re-pointed elsewhere through `.env`
(`VITE_API_BASE_URL`, `VITE_ALLOWED_ORIGINS`, `VITE_APP_ENV`), and the HTTP
plugin's capability allow-list in `src-tauri/capabilities/default.json`
permitted a second origin (`http://localhost:3000`).

That override path makes production pointing conditional: a user or installer
that carries a stray `.env` — or a future build step that injects a local
origin — silently redirects the product's traffic away from the live platform.

## 2. Requirements

- REQ-1 The application origin MUST be `https://www.tenders-sa.org`, with no
  runtime, environment, or build-time override.
- REQ-2 The HTTP capability allow-list MUST contain exactly one origin: the
  production application API. No localhost or third-party origin may appear.
- REQ-3 The runtime `environment` value is always `production`.
- REQ-4 Non-origin configuration (feature flags, telemetry, request policy,
  updater placeholder) keeps its existing env-based defaults unchanged.
- REQ-5 Tests pin REQ-1 and REQ-2 so a future edit cannot quietly restore an
  override path.

## 3. Design

- `loadConfig` stops reading `VITE_API_BASE_URL`, `VITE_ALLOWED_ORIGINS` and
  `VITE_APP_ENV` entirely; those keys are removed from `ImportMetaEnv` and the
  allow-list of forwarded values. `apiBaseUrl`, `allowedOrigins` and
  `environment` are constants describing production.
- The schema's https/localhost rules remain for defense in depth, but can no
  longer be reached with a non-production value because the value is constant.
- The capability description and `capability-scope.test.ts` are updated to the
  one-origin boundary.

## 4. Files

- Modify: `src/app/config/load-config.ts`, `src/vite-env.d.ts`,
  `src-tauri/capabilities/default.json`, `src/tests/config.test.ts`,
  `src/tests/capability-scope.test.ts`, `.env.example`, `README.md`,
  `docs/architecture/api.md`
- Create: none

## 5. Acceptance

- A1 `loadConfig({})` and any env input produce
  `apiBaseUrl === "https://www.tenders-sa.org"`, `environment === "production"`,
  `allowedOrigins === ["https://www.tenders-sa.org"]` — asserted by test.
- A2 A supplied `VITE_API_BASE_URL` is ignored, never validated, never
  forwarded — asserted by test.
- A3 The capability allow-list has exactly one entry
  (`https://www.tenders-sa.org/api/*`) — asserted by test.
- A4 No `.env` or build flag can re-point the origin.
- A5 All existing verification gates pass (typecheck, lint, format, tests,
  build).

## 6. Non-goals

- No change to which endpoints or how the transport issues requests.
- No change to the desktopAuth kill switch or telemetry defaults.
- Historical audit documents (`docs/audits/*`) are point-in-time artifacts and
  are not rewritten.
