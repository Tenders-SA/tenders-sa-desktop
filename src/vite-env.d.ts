/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ALLOWED_ORIGINS?: string;
  readonly VITE_FEATURE_DESKTOP_AUTH?: string;
  readonly VITE_TELEMETRY_ENABLED?: string;
  readonly VITE_TELEMETRY_REDACTION_MODE?: string;
  readonly VITE_UPDATE_CHANNEL?: string;
  readonly VITE_UPDATE_PUBLIC_KEY?: string;
  readonly VITE_REQUEST_TIMEOUT_MS?: string;
  readonly VITE_REQUEST_MAX_SAFE_RETRIES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
