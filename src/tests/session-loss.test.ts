/**
 * Session-loss tests.
 *
 * Refs: REQ-4, SEC-2, INT-1
 *
 * The parent does not revoke tokens and the token is opaque to this client,
 * so the desktop cannot know a session has ended by inspecting anything --
 * it finds out by being refused. `auth.md` §Credential lifecycle therefore
 * requires that **any** 401 on an authenticated route clears the keychain
 * and drops the app to unauthenticated.
 *
 * That reaction lives on the transport rather than in each screen, and these
 * tests pin both halves: it fires where it must, and it stays silent on the
 * auth routes, where a 401 means "wrong password" instead.
 */

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiTransport } from "../services/api/transport";
import { createAuthWiring } from "../app/auth-wiring";
import type { SessionCredentialStore } from "../services/auth/ports";

const schema = z.object({ ok: z.boolean() });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function transportReturning(
  status: number,
  onUnauthorized: (path: string) => void,
) {
  return new ApiTransport({
    baseUrl: "http://localhost:3000",
    fetchImpl: (async () =>
      jsonResponse(
        { error: "Unauthorized" },
        status,
      )) as unknown as typeof fetch,
    sleep: async () => {},
    onUnauthorized,
  });
}

describe("transport session-loss hook", () => {
  it("fires on a 401 from an authenticated route", async () => {
    const onUnauthorized = vi.fn();
    const transport = transportReturning(401, onUnauthorized);
    await expect(
      transport.request({ method: "GET", path: "/api/tenders", schema }),
    ).rejects.toMatchObject({ kind: "unauthorized" });
    expect(onUnauthorized).toHaveBeenCalledWith("/api/tenders");
  });

  it("stays silent when the caller expects an unauthenticated result", async () => {
    // The login route. A mistyped password must not be reported as an
    // expiry, and must not clear a session the user may still have.
    const onUnauthorized = vi.fn();
    const transport = transportReturning(401, onUnauthorized);
    await expect(
      transport.request({
        method: "POST",
        path: "/api/auth/login",
        schema,
        unauthenticatedIsExpected: true,
      }),
    ).rejects.toMatchObject({ kind: "unauthorized" });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("does not fire on a 403, which is entitlement rather than identity", async () => {
    // Forbidden means the session is fine and the plan is not. Signing the
    // user out over it would be both wrong and infuriating.
    const onUnauthorized = vi.fn();
    const transport = transportReturning(403, onUnauthorized);
    await expect(
      transport.request({ method: "GET", path: "/api/tenders", schema }),
    ).rejects.toMatchObject({ kind: "forbidden" });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("does not fire on a 500 or a network failure", async () => {
    const onUnauthorized = vi.fn();
    const transport = new ApiTransport({
      baseUrl: "http://localhost:3000",
      fetchImpl: (async () => {
        throw new TypeError("Failed to fetch");
      }) as unknown as typeof fetch,
      sleep: async () => {},
      onUnauthorized,
    });
    await expect(
      transport.request({ method: "GET", path: "/api/tenders", schema }),
    ).rejects.toBeDefined();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("still rejects, so the calling screen renders its own error state", async () => {
    // The hook is a side effect, not a swallow. A screen that showed a
    // spinner forever because the error was absorbed would be worse than
    // one showing "sign in".
    const transport = transportReturning(401, vi.fn());
    await expect(
      transport.request({ method: "GET", path: "/api/tenders", schema }),
    ).rejects.toThrow();
  });

  it("does not fire when the request succeeds", async () => {
    const onUnauthorized = vi.fn();
    const transport = new ApiTransport({
      baseUrl: "http://localhost:3000",
      fetchImpl: (async () =>
        jsonResponse({ ok: true })) as unknown as typeof fetch,
      sleep: async () => {},
      onUnauthorized,
    });
    await expect(
      transport.request({ method: "GET", path: "/api/tenders", schema }),
    ).resolves.toEqual({ ok: true });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe("auth wiring session-expiry notification", () => {
  function storeWithToken(): SessionCredentialStore & {
    clear: ReturnType<typeof vi.fn>;
  } {
    return {
      save: vi.fn(async () => {}),
      loadAccessToken: vi.fn(async () => "tok"),
      clear: vi.fn(async () => {}),
    };
  }

  /**
   * Reaches the hook the production path installs. `createAuthWiring` only
   * attaches it when it builds the transport itself, so this must not inject
   * one -- injecting would test nothing.
   */
  function wiringWith(store: SessionCredentialStore) {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: "Unauthorized" }, 401),
    );
    const wiring = createAuthWiring({
      desktopAuthEnabled: true,
      apiBaseUrl: "http://localhost:3000",
      credentialStore: store,
      // Not a transport: the plugin's fetch is swapped underneath so the
      // wiring still constructs its own transport, hook included.
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    return { wiring, fetchImpl };
  }

  it("notifies subscribers when an authenticated read is refused", async () => {
    const store = storeWithToken();
    const { wiring } = wiringWith(store);
    const listener = vi.fn();
    wiring.onSessionExpired(listener);

    await expect(wiring.tenders.list()).rejects.toMatchObject({
      kind: "unauthorized",
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clears the keychain even when nobody is subscribed", async () => {
    // A dead token left in the keychain fails every later request. Clearing
    // must not depend on a UI listener being attached.
    const store = storeWithToken();
    const { wiring } = wiringWith(store);

    await expect(wiring.tenders.list()).rejects.toBeDefined();
    expect(store.clear).toHaveBeenCalled();
  });

  it("stops notifying after unsubscribe", async () => {
    const store = storeWithToken();
    const { wiring } = wiringWith(store);
    const listener = vi.fn();
    const unsubscribe = wiring.onSessionExpired(listener);
    unsubscribe();

    await expect(wiring.tenders.list()).rejects.toBeDefined();
    expect(listener).not.toHaveBeenCalled();
  });

  it("notifies every subscriber, not just the first", async () => {
    const store = storeWithToken();
    const { wiring } = wiringWith(store);
    const first = vi.fn();
    const second = vi.fn();
    wiring.onSessionExpired(first);
    wiring.onSessionExpired(second);

    await expect(wiring.tenders.list()).rejects.toBeDefined();
    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });

  it("fires for the subscription endpoint too, not only tenders", async () => {
    // Every endpoint shares the one transport, which is the whole point of
    // putting the hook there.
    const store = storeWithToken();
    const { wiring } = wiringWith(store);
    const listener = vi.fn();
    wiring.onSessionExpired(listener);

    await expect(wiring.subscription.getStatus()).rejects.toBeDefined();
    expect(listener).toHaveBeenCalled();
  });

  it("does not fire when the user simply mistypes a password", async () => {
    const store = storeWithToken();
    const { wiring } = wiringWith(store);
    const listener = vi.fn();
    wiring.onSessionExpired(listener);

    await expect(
      wiring.auth.login({ email: "a@b.co", password: "wrong" }),
    ).rejects.toBeDefined();
    expect(listener).not.toHaveBeenCalled();
  });
});
