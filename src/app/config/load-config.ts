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

function parseOrigins(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : undefined;
}

/**
 * Builds the config candidate from an explicit allowlist of VITE_ keys.
 * Nothing else in `env` can reach the returned object, so an unrelated
 * secret sitting in the same .env file is never forwarded into the
 * client-readable configuration.
 */
export function loadConfig(env: RawEnv): AppConfig {
  const candidate = {
    environment: env.VITE_APP_ENV,
    apiBaseUrl: env.VITE_API_BASE_URL,
    allowedOrigins: parseOrigins(env.VITE_ALLOWED_ORIGINS),
    featureFlags: {
      desktopAuth: parseBoolean(env.VITE_FEATURE_DESKTOP_AUTH) ?? false,
    },
    telemetry: {
      enabled: parseBoolean(env.VITE_TELEMETRY_ENABLED) ?? false,
      redactionMode: env.VITE_TELEMETRY_REDACTION_MODE,
    },
    update: {
      channel: env.VITE_UPDATE_CHANNEL,
      publicKey: env.VITE_UPDATE_PUBLIC_KEY,
    },
    request: {
      timeoutMs: parseNumber(env.VITE_REQUEST_TIMEOUT_MS),
      maxSafeRetries: parseNumber(env.VITE_REQUEST_MAX_SAFE_RETRIES),
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
