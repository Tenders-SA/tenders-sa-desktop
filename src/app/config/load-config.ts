import { appConfigSchema, type AppConfig } from "./schema";

export class ConfigError extends Error {
  constructor(issues: string[]) {
    super(
      `Invalid runtime configuration:\n${issues
        .map((issue) => `  - ${issue}`)
        .join("\n")}`,
    );
    this.name = "ConfigError";
  }
}

export type RawEnv = Record<string, string | undefined>;

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * The live Tenders-SA application origin.
 *
 * **Hard-wired, not defaulted.** Production pointing is unconditional: no
 * environment value, `.env` entry or build flag can redirect the application
 * elsewhere. This origin must also appear in
 * `src-tauri/capabilities/default.json`, or `tauri-plugin-http` denies every
 * request to it regardless of this value.
 */
export const API_BASE_URL = "https://www.tenders-sa.org";

/**
 * Builds the config candidate from an explicit allowlist of VITE_ keys.
 * Nothing else in `env` can reach the returned object, so an unrelated
 * secret sitting in the same .env file is never forwarded into the
 * client-readable configuration.
 *
 * The application origin and environment are constant (production only);
 * every remaining field has a working default, and an explicitly *supplied*
 * malformed value is still rejected. The defaults remove "absent" as a
 * failure mode, not "wrong".
 */
export function loadConfig(env: RawEnv): AppConfig {
  const candidate = {
    // The application origin is hard-wired to the live platform and is never
    // configurable, so the environment is always production. There is no
    // localhost or staging runtime to infer.
    environment: "production" as const,
    apiBaseUrl: API_BASE_URL,
    // Same single origin the HTTP capability allow-list grants in
    // `src-tauri/capabilities/default.json`; the two cannot disagree because
    // neither is read from the environment.
    allowedOrigins: [API_BASE_URL],
    featureFlags: {
      desktopAuth: parseBoolean(env.VITE_FEATURE_DESKTOP_AUTH) ?? true,
    },
    telemetry: {
      enabled: parseBoolean(env.VITE_TELEMETRY_ENABLED) ?? false,
      redactionMode: env.VITE_TELEMETRY_REDACTION_MODE || "strict",
    },
    request: {
      timeoutMs: parseNumber(env.VITE_REQUEST_TIMEOUT_MS) ?? 10_000,
      maxSafeRetries: parseNumber(env.VITE_REQUEST_MAX_SAFE_RETRIES) ?? 2,
    },
  };

  const result = appConfigSchema.safeParse(candidate);
  if (!result.success) {
    throw new ConfigError(
      result.error.issues.map(
        (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      ),
    );
  }
  return result.data;
}
