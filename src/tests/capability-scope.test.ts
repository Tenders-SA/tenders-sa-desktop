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

  it("allows exactly the one origin the product runs against", () => {
    // A second origin is a second place the token can be sent, so this can
    // never grow silently. It is exactly ONE, and here is why:
    //
    //   - the runtime API base URL is unusable unless its origin appears here,
    //     so a packaged build with no entry would have every request denied
    //     by the plugin -- the app would install, open, and fail every read
    //     with no way for configuration to fix it;
    //   - and production pointing is unconditional, so no localhost or
    //     third-party origin exists for the plugin to reach.
    //
    // Adding a second means updating this test and stating the reason.
    expect(httpPermission?.allow).toHaveLength(1);
    const urls = (httpPermission?.allow ?? []).map((entry) => entry.url);
    expect(urls).toContain("https://www.tenders-sa.org/api/*");
    expect(urls).not.toContain("http://localhost:3000/api/*");
  });

  it("keeps every origin on https", () => {
    // A plaintext origin would put the bearer token on the wire.
    const urls = httpPermission?.allow ?? [];
    expect(urls.length).toBeGreaterThan(0);
    for (const entry of urls) {
      expect(entry.url.startsWith("https://")).toBe(true);
    }
  });

  it("scopes every entry to the API path, not a bare host", () => {
    // A bare host would let the plugin reach the whole web application, not
    // just its API surface.
    const urls = httpPermission?.allow ?? [];
    expect(urls.length).toBeGreaterThan(0);
    for (const entry of urls) {
      expect(entry.url).toMatch(/\/api\//);
    }
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

  it("keeps every workspace route inside the permitted API origin path", () => {
    // The workspace cockpit added application-scoped routes under /api/v1/.
    // The http-plugin allow-list is `https://www.tenders-sa.org/api/*`, so
    // any future route must stay under /api/ or it will need a new origin
    // entry — which this test forbids silently by asserting the route
    // literals themselves carry no host and no path outside /api/v1/.
    const source = readFileSync(
      resolve(root, "src/services/api/endpoints/applications.ts"),
      "utf8",
    );
    const routeLiterals =
      source.match(
        /"\/api\/v1\/applications[^"]*"|`\/api\/v1\/applications[^`]*`/g,
      ) ?? [];
    expect(routeLiterals.length).toBeGreaterThan(0);
    for (const literal of routeLiterals) {
      expect(literal).toMatch(/^["`]\/api\/v1\/applications/);
      expect(literal).not.toContain("http");
    }
  });

  it("grants fs only as the dialog-scoped write-file command (Slice 6)", () => {
    // Slice 6 export needs to write the downloaded package, and only to the
    // path the user picks: the dialog plugin extends the fs scope at runtime
    // to exactly that path, so the capability holds the write command with
    // no static fs scope at all. Any other fs identifier (reads, recursion,
    // scope grants) would widen this silently — each must state its reason.
    const identifiers = capability.permissions.map((p) =>
      typeof p === "string" ? p : p.identifier,
    );
    const fsIds = identifiers.filter((id) => id.startsWith("fs:"));
    expect(fsIds).toEqual(["fs:allow-write-file"]);
  });

  it("grants dialog only as allow-save (Slice 6)", () => {
    // The export feature needs exactly one dialog: save. `dialog:default`
    // would also grant open/message/confirm/ask — none of which this app
    // uses — so the narrow command is granted instead.
    const identifiers = capability.permissions.map((p) =>
      typeof p === "string" ? p : p.identifier,
    );
    const dialogIds = identifiers.filter((id) => id.startsWith("dialog:"));
    expect(dialogIds).toEqual(["dialog:allow-save"]);
  });

  it("grants no shell or opener capability alongside it", () => {
    const identifiers = capability.permissions.map((p) =>
      typeof p === "string" ? p : p.identifier,
    );
    for (const forbidden of ["shell:", "opener:"]) {
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

  it("keeps a TLS backend enabled for the https-only application origin", () => {
    // Regression: the plugin was declared `default-features = false` with no
    // replacement TLS feature, so reqwest had no TLS backend and EVERY https
    // request to the production API failed at the transport layer -- surfaced
    // to the user as "Could not reach Tenders-SA". Plain-http localhost dev
    // never exercised it. The application origin is https-only (hard-wired),
    // so rustls or native-tls must remain enabled.
    expect(line).toMatch(/rustls-tls|native-tls/);
  });

  it("does not enable dangerous-settings or unsafe-headers", () => {
    // `unsafe-headers` would let the webview set forbidden headers;
    // `dangerous-settings` disables certificate validation. Both stay off.
    expect(line).not.toContain("dangerous-settings");
    expect(line).not.toContain("unsafe-headers");
  });
});
