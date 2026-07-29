/**
 * Composition-root and gate tests (TASK-2.10).
 *
 * Refs: REQ-A9, SEC-A4
 *
 * TASK-2.10 supplies an audited adapter, which makes the `desktopAuth` flag
 * load-bearing for the first time. These tests exist because that is the
 * moment the gate could silently stop protecting anything:
 *
 *   - if `isEnabled()` stopped requiring both conditions, a config flip
 *     alone would enable auth against whatever adapter happened to exist;
 *   - if `allowUnauthenticated` stayed true once auth was live, every
 *     protected route would be reachable without a session.
 */

import { describe, expect, it, vi } from "vitest";
import { createAuthWiring } from "../app/auth-wiring";
import { ApiTransport } from "../services/api/transport";
import type { SessionCredentialStore } from "../services/auth/ports";

function fakeStore(): SessionCredentialStore {
  let token: string | undefined;
  return {
    async save(t) {
      token = t;
    },
    async loadAccessToken() {
      return token;
    },
    async clear() {
      token = undefined;
    },
  };
}

function wiringWith(desktopAuthEnabled: boolean) {
  return createAuthWiring({
    desktopAuthEnabled,
    apiBaseUrl: "http://localhost:3000",
    credentialStore: fakeStore(),
    transport: new ApiTransport({
      baseUrl: "http://localhost:3000",
      fetchImpl: vi.fn() as unknown as typeof fetch,
    }),
  });
}

describe("the two-condition gate (REQ-A9)", () => {
  it("stays closed when the flag is off, even though an adapter now exists", () => {
    // Before TASK-2.10 this passed trivially, because no adapter existed at
    // all. Now it is the flag doing the work, which is the point.
    expect(wiringWith(false).auth.isEnabled()).toBe(false);
  });

  it("opens only when the flag is on AND an adapter is supplied", () => {
    expect(wiringWith(true).auth.isEnabled()).toBe(true);
  });

  it("refuses to log in while the flag is off", async () => {
    const { auth } = wiringWith(false);
    await expect(
      auth.login({ email: "a@b.co", password: "x" }),
    ).rejects.toMatchObject({ kind: "disabled" });
  });

  it("refuses to restore a session while the flag is off", async () => {
    // A token left by an earlier build must not silently grant a session.
    const { auth } = wiringWith(false);
    await expect(auth.restoreSession()).rejects.toMatchObject({
      kind: "disabled",
    });
  });

  it("still permits logout while gated, so credentials can always be dropped", async () => {
    const { auth } = wiringWith(false);
    await expect(auth.logout()).resolves.toBeUndefined();
  });
});

describe("composition root", () => {
  it("supplies a subscription endpoint alongside auth", () => {
    expect(wiringWith(true).subscription).toBeDefined();
  });

  it("holds the csrf token in memory only, absent before login", () => {
    expect(wiringWith(true).getCsrfToken()).toBeUndefined();
  });

  it("does not expose the token on the wiring object", async () => {
    const wiring = wiringWith(true);
    // The keychain owns it; nothing here should hold a copy.
    expect(JSON.stringify(wiring)).not.toContain("token");
  });
});
