import { describe, expect, it } from "vitest";
import { loadConfig, type RawEnv } from "../app/config/load-config";

const PRODUCTION_ORIGIN = "https://www.tenders-sa.org";

const validEnv: RawEnv = {
  VITE_FEATURE_DESKTOP_AUTH: "false",
  VITE_TELEMETRY_ENABLED: "false",
  VITE_TELEMETRY_REDACTION_MODE: "strict",
  VITE_REQUEST_TIMEOUT_MS: "10000",
  VITE_REQUEST_MAX_SAFE_RETRIES: "2",
};

describe("loadConfig with no environment at all", () => {
  /**
   * THE regression this file exists for now.
   *
   * `.env` is gitignored, so a fresh clone and every packaged installer start
   * with no `VITE_*` values whatsoever. `loadConfig` runs at module scope in
   * `App.tsx`, before React mounts, so when required fields had no defaults it
   * threw and the window opened completely empty -- no message, no error, just
   * a blank frame. That is what "the application is not running" looked like,
   * and it made the shipped installer useless.
   */
  it("starts successfully with a completely empty environment", () => {
    expect(() => loadConfig({})).not.toThrow();
  });

  it("points at the live Tenders-SA application, unconditionally", () => {
    // Production pointing is not a default that an environment can override:
    // the origin is hard-wired, so there is nothing left to condition on.
    const config = loadConfig({});
    expect(config.apiBaseUrl).toBe(PRODUCTION_ORIGIN);
    expect(config.environment).toBe("production");
    expect(config.allowedOrigins).toEqual([PRODUCTION_ORIGIN]);
  });

  it("has authentication on and sane request policy by default", () => {
    const config = loadConfig({});
    expect(config.featureFlags.desktopAuth).toBe(true);
    expect(config.request.timeoutMs).toBe(10_000);
    expect(config.request.maxSafeRetries).toBe(2);
  });
});

describe("loadConfig", () => {
  it("loads a fully valid environment", () => {
    const config = loadConfig(validEnv);
    expect(config.environment).toBe("production");
    expect(config.allowedOrigins).toEqual([PRODUCTION_ORIGIN]);
    expect(config.request).toEqual({ timeoutMs: 10000, maxSafeRetries: 2 });
  });

  it("ignores any supplied API base URL, valid or malformed", () => {
    // Pointing at production is never conditional, so origin env values are
    // not read at all -- neither accepted nor validated nor forwarded.
    const config = loadConfig({
      ...validEnv,
      VITE_API_BASE_URL: "http://localhost:3000",
      VITE_ALLOWED_ORIGINS: "http://localhost:3000, http://localhost:1420",
      VITE_APP_ENV: "development",
    });
    expect(config.apiBaseUrl).toBe(PRODUCTION_ORIGIN);
    expect(config.environment).toBe("production");
    expect(config.allowedOrigins).toEqual([PRODUCTION_ORIGIN]);
  });

  it("ignores a malformed API base URL rather than failing on it", () => {
    expect(() =>
      loadConfig({ ...validEnv, VITE_API_BASE_URL: "not-a-url" }),
    ).not.toThrow();
  });

  it("defaults authentication ON, because it is the normal operating mode", () => {
    // REVERSED DELIBERATELY. This defaulted to `false` while the auth adapter
    // did not exist -- the flag stopped a half-built adapter from touching
    // real credentials. The adapter now exists and is audited, so an app that
    // starts unable to sign in is broken rather than safe. The flag survives
    // only as a kill switch for local work against a backend that is down.
    const env = { ...validEnv };
    delete env.VITE_FEATURE_DESKTOP_AUTH;
    const config = loadConfig(env);
    expect(config.featureFlags.desktopAuth).toBe(true);
  });

  it("still honours an explicit `false`, so the kill switch works", () => {
    const config = loadConfig({
      ...validEnv,
      VITE_FEATURE_DESKTOP_AUTH: "false",
    });
    expect(config.featureFlags.desktopAuth).toBe(false);
  });

  it("never forwards unrelated env values, including secret-shaped ones, into the config", () => {
    const secretValue = "sk_live_do_not_leak_me";
    const env: RawEnv = {
      ...validEnv,
      VITE_SOME_UNEXPECTED_SECRET: secretValue,
      PRODUCTION_DB_PASSWORD: secretValue,
    };
    const config = loadConfig(env);
    expect(JSON.stringify(config)).not.toContain(secretValue);
  });
});
