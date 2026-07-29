/**
 * Capability and CSP boundary tests (TASK-2.2, REQ-A1, SEC-A2).
 *
 * The Bearer token is briefly present in webview memory, because
 * `tauri-plugin-http` takes request headers from the caller
 * (`design.md` §Transport decision). That tradeoff is only acceptable while
 * the paths by which a compromised webview could *send* the token anywhere
 * stay closed. Those paths are:
 *
 *   1. the HTTP plugin's URL allow-list  -> must contain only the API origin
 *   2. CSP `script-src`                  -> must forbid remote scripts
 *   3. CSP `connect-src`                 -> must forbid external fetch/XHR
 *
 * All three are configuration, so all three can be widened by an unrelated
 * future change with no compiler to object. These tests are the objection.
 * They parse the shipped files rather than restating their values, so an
 * edit that loosens any boundary fails CI instead of silently removing a
 * containment guarantee.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");

function readJson(relative: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(root, relative), "utf8"));
}

const capability = readJson("src-tauri/capabilities/default.json") as {
  permissions: (string | { identifier: string; allow?: { url: string }[] })[];
};

const tauriConf = readJson("src-tauri/tauri.conf.json") as {
  app?: { security?: { csp?: string } };
};

const httpPermission = capability.permissions.find(
  (p): p is { identifier: string; allow?: { url: string }[] } =>
    typeof p === "object" && p.identifier === "http:default",
);

const csp = tauriConf.app?.security?.csp ?? "";

function directive(name: string): string {
  const match = csp.split(";").find((d) => d.trim().startsWith(name));
  return match ? match.trim() : "";
}

describe("http plugin scope", () => {
  it("is granted at all, so the transport can reach the API", () => {
    expect(httpPermission).toBeDefined();
  });

  it("carries an explicit allow-list", () => {
    // The plugin grants NO origin by default -- permissions/default.toml:
    // "does not allow explicitly any origins to be fetched. This needs to be
    // manually configured before usage." An absent allow list means a broken
    // transport, not an open one, but we assert presence so the failure is legible.
    expect(httpPermission?.allow).toBeDefined();
    expect(Array.isArray(httpPermission?.allow)).toBe(true);
  });

  it("allows exactly one origin", () => {
    // More than one entry is not automatically wrong, but it is never something
    // that should happen silently: a second origin is a second place the token
    // can be sent. Adding one deliberately means updating this test and saying why.
    expect(httpPermission?.allow).toHaveLength(1);
  });

  it("scopes the allow-list to the API path, not a bare host", () => {
    const url = httpPermission?.allow?.[0]?.url ?? "";
    expect(url).toMatch(/\/api\//);
  });

  it("never allows a wildcard host or a wildcard scheme", () => {
    for (const entry of httpPermission?.allow ?? []) {
      expect(entry.url).not.toMatch(/^\*/);
      expect(entry.url).not.toMatch(/^https?:\/\/\*/);
      expect(entry.url).not.toBe("http://**");
      expect(entry.url).not.toBe("https://**");
    }
  });

  it("does not reach the public Developer API (REQ-A14)", () => {
    // The desktop consumes the main application's parent-internal API only.
    for (const entry of httpPermission?.allow ?? []) {
      expect(entry.url).not.toContain("api.tenders-sa.org");
    }
  });

  it("grants no filesystem, shell, or opener capability alongside it", () => {
    const identifiers = capability.permissions.map((p) =>
      typeof p === "string" ? p : p.identifier,
    );
    for (const forbidden of ["fs:", "shell:", "opener:"]) {
      expect(identifiers.some((id) => id.startsWith(forbidden))).toBe(false);
    }
  });
});

describe("CSP exfiltration containment", () => {
  it("defines a CSP at all", () => {
    expect(csp).not.toBe("");
  });

  it("forbids remote script sources", () => {
    // The primary XSS vector. If this widens, the token-in-memory tradeoff
    // stops being contained.
    const scriptSrc = directive("script-src");
    expect(scriptSrc).toBe("script-src 'self'");
  });

  it("keeps connect-src local, so ordinary fetch cannot reach an external host", () => {
    // Load-bearing, and counter-intuitive: the API is reached through the
    // plugin, which does NOT use the webview network stack. So connect-src
    // needs no allowance for it -- and must not be given one. A future task
    // "letting the API through" here would delete a containment guarantee
    // without gaining anything.
    const connectSrc = directive("connect-src");
    expect(connectSrc).toContain("'self'");
    expect(connectSrc).not.toContain("http://localhost:3000");
    expect(connectSrc).not.toContain("api.tenders-sa.org");
    expect(connectSrc).not.toContain("*");
  });

  it("keeps object-src none and base-uri self", () => {
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("base-uri")).toBe("base-uri 'self'");
  });
});

describe("plugin feature flags", () => {
  const cargo = readFileSync(resolve(root, "src-tauri/Cargo.toml"), "utf8");
  const line =
    cargo.split("\n").find((l) => l.startsWith("tauri-plugin-http")) ?? "";

  it("declares the http plugin", () => {
    expect(line).not.toBe("");
  });

  it("does not enable dangerous-settings or unsafe-headers", () => {
    // `unsafe-headers` would let the webview set forbidden headers;
    // `dangerous-settings` disables certificate validation. Both stay off.
    expect(line).not.toContain("dangerous-settings");
    expect(line).not.toContain("unsafe-headers");
  });
});
