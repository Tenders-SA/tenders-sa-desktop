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

  it("defaults to the live Tenders-SA application, not localhost", () => {
    // A packaged build with no .env is a release build. Defaulting to
    // localhost would ship an app that can only talk to a dev server.
    const config = loadConfig({});
    expect(config.apiBaseUrl).toBe("https://www.tenders-sa.org");
    expect(config.environment).toBe("production");
  });

  it("derives allowedOrigins from the API base URL so the two cannot disagree", () => {
    const config = loadConfig({ VITE_API_BASE_URL: "http://localhost:3000" });
    expect(config.allowedOrigins).toEqual(["http://localhost:3000"]);
  });

  it("has authentication on and sane request policy by default", () => {
    const config = loadConfig({});
    expect(config.featureFlags.desktopAuth).toBe(true);
    expect(config.request.timeoutMs).toBe(10_000);
    expect(config.request.maxSafeRetries).toBe(2);
  });

  it("still rejects a value that IS supplied but malformed", () => {
    // Defaults remove "absent" as a failure mode, not "wrong". A typo in a
    // real .env must still fail loudly rather than being silently replaced.
    expect(() => loadConfig({ VITE_API_BASE_URL: "not-a-url" })).toThrow();
  });

  it("still refuses a plaintext production endpoint", () => {
    // The security rule that matters most here survives the defaults: a
    // production build must not put the bearer token on the wire in the clear.
    expect(() =>
      loadConfig({
        VITE_APP_ENV: "production",
        VITE_API_BASE_URL: "http://tenders-sa.example",
      }),
    ).toThrow();
  });
});

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

  it("fills a missing value from a default instead of failing closed", () => {
    // REVERSED DELIBERATELY. This asserted a throw when `VITE_APP_ENV` was
    // absent, which was defensible while the app was a developer-only shell.
    // It is wrong for a shipped desktop application: `.env` is gitignored, so
    // EVERY packaged installer had no env at all and threw at module scope,
    // opening a completely blank window with no message. Failing closed on an
    // absent value made the product unusable rather than safe.
    //
    // "Fails closed" now applies to values that are supplied and wrong — see
    // the two tests below, both of which still throw.
    const env = { ...validEnv };
    delete env.VITE_APP_ENV;
    const config = loadConfig(env);
    // validEnv points at localhost, so the environment is inferred as
    // development rather than being defaulted to production and then rejected
    // for not being https.
    expect(config.environment).toBe("development");
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
