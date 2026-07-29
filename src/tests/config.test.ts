import { describe, expect, it } from "vitest";
import {
  ConfigError,
  loadConfig,
  type RawEnv,
} from "../app/config/load-config";

const validEnv: RawEnv = {
  VITE_APP_ENV: "development",
  VITE_API_BASE_URL: "http://localhost:3000",
  VITE_ALLOWED_ORIGINS: "http://localhost:3000, http://localhost:1420",
  VITE_FEATURE_DESKTOP_AUTH: "false",
  VITE_TELEMETRY_ENABLED: "false",
  VITE_TELEMETRY_REDACTION_MODE: "strict",
  VITE_UPDATE_CHANNEL: "stable",
  VITE_UPDATE_PUBLIC_KEY: "test-public-key",
  VITE_REQUEST_TIMEOUT_MS: "10000",
  VITE_REQUEST_MAX_SAFE_RETRIES: "2",
};

describe("loadConfig", () => {
  it("loads a fully valid environment", () => {
    const config = loadConfig(validEnv);
    expect(config.environment).toBe("development");
    expect(config.allowedOrigins).toEqual([
      "http://localhost:3000",
      "http://localhost:1420",
    ]);
    expect(config.request).toEqual({ timeoutMs: 10000, maxSafeRetries: 2 });
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

  it("fails closed when a required value is missing", () => {
    const env = { ...validEnv };
    delete env.VITE_APP_ENV;
    expect(() => loadConfig(env)).toThrow(ConfigError);
  });

  it("fails closed when apiBaseUrl is not a valid URL", () => {
    const env = { ...validEnv, VITE_API_BASE_URL: "not-a-url" };
    expect(() => loadConfig(env)).toThrow(ConfigError);
  });

  it("fails closed on a non-https production API base URL", () => {
    const env = {
      ...validEnv,
      VITE_APP_ENV: "production",
      VITE_API_BASE_URL: "http://api.example.com",
    };
    expect(() => loadConfig(env)).toThrow(ConfigError);
  });

  it("accepts a production https API base URL", () => {
    const env = {
      ...validEnv,
      VITE_APP_ENV: "production",
      VITE_API_BASE_URL: "https://api.example.com",
      VITE_ALLOWED_ORIGINS: "https://app.example.com",
    };
    expect(() => loadConfig(env)).not.toThrow();
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
