/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FEATURE_DESKTOP_AUTH?: string;
  readonly VITE_TELEMETRY_ENABLED?: string;
  readonly VITE_TELEMETRY_REDACTION_MODE?: string;
  readonly VITE_REQUEST_TIMEOUT_MS?: string;
  readonly VITE_REQUEST_MAX_SAFE_RETRIES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * The application version, injected from `package.json` at build time by
 * `vite.config.ts` (Slice 8, R-V5).
 *
 * A build-time constant rather than a runtime read: the sign-in screen shows
 * it before anything is loaded, and a literal in the component would drift
 * from the version the installer actually shipped.
 */
declare const __APP_VERSION__: string;
