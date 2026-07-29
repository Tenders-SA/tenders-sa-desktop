import { appConfigSchema, LOCAL_HOSTNAMES, type AppConfig } from "./schema";

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
 * `development` for a local endpoint, `production` for anything else.
 *
 * Unparseable input yields `production`, which is the stricter of the two —
 * the schema then rejects the URL anyway, and guessing `development` would
 * relax the https requirement on the way to that failure.
 */
function inferEnvironment(apiBaseUrl: string): "development" | "production" {
  try {
    const { hostname } = new URL(apiBaseUrl);
    return LOCAL_HOSTNAMES.has(hostname) ? "development" : "production";
  } catch {
    return "production";
  }
}

/**
 * The scheme-and-host of a URL, or the input unchanged if it will not parse.
 *
 * Returning the raw string on failure keeps the error where it belongs: the
 * schema then reports `allowedOrigins` as invalid, rather than this helper
 * throwing a `TypeError` that nothing catches.
 */
function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
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
 * The live Tenders-SA application origin.
 *
 * **This is the default, and that is deliberate.** `.env` is gitignored, so a
 * fresh clone and every packaged installer have no `VITE_*` values at all.
 * With required-and-no-default fields this function threw at module scope
 * before React mounted, which produced a window that opened and displayed
 * nothing — the app was not "misconfigured", it was dead on arrival, with no
 * message saying why.
 *
 * A desktop application shipped to users must work when double-clicked. So the
 * defaults describe the real product, and `.env` becomes an override for local
 * development rather than a precondition for starting.
 *
 * This origin must also appear in `src-tauri/capabilities/default.json`, or
 * `tauri-plugin-http` denies every request to it regardless of this value.
 */
export const DEFAULT_API_BASE_URL = "https://www.tenders-sa.org";

/**
 * Builds the config candidate from an explicit allowlist of VITE_ keys.
 * Nothing else in `env` can reach the returned object, so an unrelated
 * secret sitting in the same .env file is never forwarded into the
 * client-readable configuration.
 *
 * Every field now has a working default. Validation is unchanged and still
 * strict: an explicitly *supplied* value that is malformed is still rejected,
 * and the production-must-be-https rule still applies. The defaults remove
 * "absent" as a failure mode, not "wrong".
 */
export function loadConfig(env: RawEnv): AppConfig {
  const apiBaseUrl = env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;

  const candidate = {
    // Inferred from the endpoint rather than defaulted to a constant.
    //
    // A packaged build with no `.env` is a release build, so production is the
    // right default — but defaulting *unconditionally* would reject anyone who
    // sets only `VITE_API_BASE_URL=http://localhost:3000`, because production
    // requires https. They would get a hard config failure for doing something
    // entirely reasonable. A localhost endpoint means development by
    // definition, so the two values cannot contradict each other.
    environment: env.VITE_APP_ENV || inferEnvironment(apiBaseUrl),
    apiBaseUrl,
    // Defaults to whatever the API origin is, so the two cannot silently
    // disagree when only one of them is configured.
    allowedOrigins: parseOrigins(env.VITE_ALLOWED_ORIGINS) ?? [
      originOf(apiBaseUrl),
    ],
    featureFlags: {
      desktopAuth: parseBoolean(env.VITE_FEATURE_DESKTOP_AUTH) ?? true,
    },
    telemetry: {
      enabled: parseBoolean(env.VITE_TELEMETRY_ENABLED) ?? false,
      redactionMode: env.VITE_TELEMETRY_REDACTION_MODE || "strict",
    },
    update: {
      channel: env.VITE_UPDATE_CHANNEL || "stable",
      // A placeholder rather than a required value: the updater is not wired
      // up yet, and an unset public key must not stop the app from starting.
      // Nothing verifies an update against this, so it is inert -- when the
      // updater does ship it will need a real key and its own validation.
      publicKey: env.VITE_UPDATE_PUBLIC_KEY || "updater-not-configured",
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
