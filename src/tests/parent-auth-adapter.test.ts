/**
 * Audited auth adapter tests (TASK-2.6).
 *
 * Refs: REQ-A3, REQ-A4, REQ-A7, REQ-A8, INT-A1, SEC-A1, SEC-A3
 *
 * These drive the adapter against the **TASK-1.3 contract fixtures** --
 * the same shapes read from parent source -- rather than against
 * hand-rolled bodies, so the adapter is proven to parse what the parent
 * actually returns.
 */

import { describe, expect, it, vi } from "vitest";
import { ApiTransport } from "../services/api/transport";
import {
  AUDITED_ERROR_STRINGS,
  ParentAuthAdapter,
} from "../services/auth/parent-auth-adapter";
import { AuthError, type SessionCredentialStore } from "../services/auth/ports";
import {
  AUTH_FAILURES,
  LOGIN_FAILURES,
  loginSuccessFixture,
  loginSuccessNoCsrfFixture,
  logoutSuccessFixture,
  meAuthenticatedFixture,
  meUnauthenticatedFixture,
} from "./fixtures/parent-auth-contract";

const BASE = "http://localhost:3000";

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** Records every keychain interaction so storage rules can be asserted. */
function recordingStore() {
  const calls: string[] = [];
  let token: string | undefined;
  const store: SessionCredentialStore = {
    async save(accessToken) {
      calls.push(`save:${accessToken}`);
      token = accessToken;
    },
    async loadAccessToken() {
      calls.push("load");
      return token;
    },
    async clear() {
      calls.push("clear");
      token = undefined;
    },
  };
  return {
    store,
    calls,
    get token() {
      return token;
    },
    seed(value: string) {
      token = value;
    },
  };
}

function makeAdapter(
  responses: (() => Promise<Response>)[],
  onCsrfToken?: (t: string | undefined) => void,
) {
  let i = 0;
  const fetchImpl = vi.fn(async () => {
    const next = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return next();
  });
  const keychain = recordingStore();
  const adapter = new ParentAuthAdapter({
    transport: new ApiTransport({
      baseUrl: BASE,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
    }),
    credentialStore: keychain.store,
    onCsrfToken,
  });
  return { adapter, keychain, fetchImpl };
}

describe("login", () => {
  it("parses the audited success fixture and stores the token", async () => {
    const { adapter, keychain } = makeAdapter([
      async () => jsonResponse(loginSuccessFixture),
    ]);

    const session = await adapter.login({
      email: "buyer@example.co.za",
      password: "secret",
    });

    expect(session.userId).toBe(loginSuccessFixture.data.user.id);
    expect(session.email).toBe(loginSuccessFixture.data.user.email);
    expect(keychain.token).toBe(loginSuccessFixture.data.token);
  });

  it("leaves expiresAt absent, because the contract exposes none (INT-A1)", async () => {
    const { adapter } = makeAdapter([
      async () => jsonResponse(loginSuccessFixture),
    ]);
    const session = await adapter.login({ email: "a@b.co", password: "x" });
    // Reading it would mean decoding the JWT, which INT-A1 forbids.
    expect(session.expiresAt).toBeUndefined();
  });

  it("succeeds when csrfToken is null, because Redis being down is not fatal", async () => {
    const seen: (string | undefined)[] = [];
    const { adapter } = makeAdapter(
      [async () => jsonResponse(loginSuccessNoCsrfFixture)],
      (t) => seen.push(t),
    );
    await expect(
      adapter.login({ email: "a@b.co", password: "x" }),
    ).resolves.toBeDefined();
    expect(seen).toEqual([undefined]);
  });

  it("publishes the csrf token in memory for mutations", async () => {
    const seen: (string | undefined)[] = [];
    const { adapter } = makeAdapter(
      [async () => jsonResponse(loginSuccessFixture)],
      (t) => seen.push(t),
    );
    await adapter.login({ email: "a@b.co", password: "x" });
    expect(seen).toEqual([loginSuccessFixture.data.csrfToken]);
  });

  it("maps invalid credentials", async () => {
    const { adapter } = makeAdapter([
      async () => jsonResponse(LOGIN_FAILURES.invalidCredentials.body, 401),
    ]);
    const error = (await adapter
      .login({ email: "a@b.co", password: "x" })
      .catch((e: unknown) => e)) as AuthError;
    expect(error).toBeInstanceOf(AuthError);
    expect(error.kind).toBe("invalid-credentials");
  });

  it("maps a user with no password set to invalid credentials", async () => {
    const { adapter } = makeAdapter([
      async () => jsonResponse(LOGIN_FAILURES.noPasswordSet.body, 401),
    ]);
    const error = (await adapter
      .login({ email: "a@b.co", password: "x" })
      .catch((e: unknown) => e)) as AuthError;
    expect(error.kind).toBe("invalid-credentials");
  });

  it("maps an inactive account distinctly, by its pinned error string (gap A-1)", async () => {
    // The whole point of this case: same 401, materially different user
    // state, separable only by prose. If the parent edits that string this
    // test fails, which is the intended alarm.
    expect(LOGIN_FAILURES.accountInactive.body.error).toBe(
      AUDITED_ERROR_STRINGS.accountInactive,
    );

    const { adapter } = makeAdapter([
      async () => jsonResponse(LOGIN_FAILURES.accountInactive.body, 401),
    ]);
    const error = (await adapter
      .login({ email: "a@b.co", password: "x" })
      .catch((e: unknown) => e)) as AuthError;
    expect(error.kind).toBe("account-inactive");
  });

  it("maps a 429 with Retry-After and does not retry it (REQ-A6)", async () => {
    const { adapter, fetchImpl } = makeAdapter([
      async () =>
        jsonResponse(LOGIN_FAILURES.rateLimited.body, 429, {
          "Retry-After": "742",
        }),
    ]);
    const error = (await adapter
      .login({ email: "a@b.co", password: "x" })
      .catch((e: unknown) => e)) as AuthError;
    expect(error.kind).toBe("rate-limited");
    expect(error.retryAfterSeconds).toBe(742);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("maps a 500 to server-error, not to the user's fault", async () => {
    const { adapter } = makeAdapter([
      async () => jsonResponse(LOGIN_FAILURES.serverError.body, 500),
    ]);
    const error = (await adapter
      .login({ email: "a@b.co", password: "x" })
      .catch((e: unknown) => e)) as AuthError;
    expect(error.kind).toBe("server-error");
  });

  it("maps a transport failure to network", async () => {
    const { adapter } = makeAdapter([
      async () => {
        throw new TypeError("Failed to fetch");
      },
    ]);
    const error = (await adapter
      .login({ email: "a@b.co", password: "x" })
      .catch((e: unknown) => e)) as AuthError;
    expect(error.kind).toBe("network");
  });

  it("never puts the password into the thrown error (SEC-A3)", async () => {
    const password = "S3cret-Bid-Password!";
    const { adapter } = makeAdapter([
      async () => jsonResponse(LOGIN_FAILURES.invalidCredentials.body, 401),
    ]);
    const error = (await adapter
      .login({ email: "a@b.co", password })
      .catch((e: unknown) => e)) as AuthError;
    const rendered = `${error.message} ${error.stack ?? ""} ${JSON.stringify(error)}`;
    expect(rendered).not.toContain(password);
  });

  it("does not store a token when login fails", async () => {
    const { adapter, keychain } = makeAdapter([
      async () => jsonResponse(LOGIN_FAILURES.invalidCredentials.body, 401),
    ]);
    await adapter.login({ email: "a@b.co", password: "x" }).catch(() => {});
    expect(keychain.calls.some((c) => c.startsWith("save:"))).toBe(false);
  });
});

describe("restoreSession", () => {
  it("returns undefined without calling the API when no token is stored", async () => {
    const { adapter, fetchImpl } = makeAdapter([
      async () => jsonResponse(meAuthenticatedFixture),
    ]);
    await expect(adapter.restoreSession()).resolves.toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("restores a session from the audited /me fixture", async () => {
    const { adapter, keychain } = makeAdapter([
      async () => jsonResponse(meAuthenticatedFixture),
    ]);
    keychain.seed("stored-token");

    const session = await adapter.restoreSession();
    expect(session?.userId).toBe(meAuthenticatedFixture.user.id);
  });

  it("persists the re-minted token, preserving the sliding window (REQ-A4)", async () => {
    // The failure this prevents appears a week after release: without it,
    // the sliding 7-day window becomes a hard expiry.
    const { adapter, keychain } = makeAdapter([
      async () => jsonResponse(meAuthenticatedFixture),
    ]);
    keychain.seed("old-token");

    await adapter.restoreSession();
    expect(keychain.token).toBe(meAuthenticatedFixture.token);
    expect(keychain.token).not.toBe("old-token");
  });

  it("treats HTTP 200 with user:null as no session, and clears the token", async () => {
    // The trap: status 200 on an unauthenticated request. A client reading
    // the status would believe it is signed in forever.
    const { adapter, keychain } = makeAdapter([
      async () => jsonResponse(meUnauthenticatedFixture, 200),
    ]);
    keychain.seed("dead-token");

    await expect(adapter.restoreSession()).resolves.toBeUndefined();
    expect(keychain.token).toBeUndefined();
    expect(keychain.calls).toContain("clear");
  });

  it("clears a token the server rejects with 401", async () => {
    const { adapter, keychain } = makeAdapter([
      async () => jsonResponse(AUTH_FAILURES.middlewareBadToken.body, 401),
    ]);
    keychain.seed("rejected-token");

    await expect(adapter.restoreSession()).resolves.toBeUndefined();
    expect(keychain.token).toBeUndefined();
  });

  it("does NOT discard the token on a transient failure", async () => {
    // Offline is not logged out. Dropping the token here would force a
    // re-login every time the user opens the app on a bad connection.
    const { adapter, keychain } = makeAdapter([
      async () => {
        throw new TypeError("Failed to fetch");
      },
    ]);
    keychain.seed("good-token");

    await expect(adapter.restoreSession()).rejects.toBeDefined();
    expect(keychain.token).toBe("good-token");
  });

  it("sends the stored token as a Bearer header", async () => {
    const { adapter, keychain, fetchImpl } = makeAdapter([
      async () => jsonResponse(meAuthenticatedFixture),
    ]);
    keychain.seed("bearer-me");

    await adapter.restoreSession();

    const [, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer bearer-me");
  });
});

describe("logout", () => {
  it("clears the keychain after a successful remote logout", async () => {
    const { adapter, keychain } = makeAdapter([
      async () => jsonResponse(logoutSuccessFixture),
    ]);
    keychain.seed("tok");

    await adapter.logout();
    expect(keychain.token).toBeUndefined();
  });

  it("clears the keychain even when the remote call fails (REQ-A8)", async () => {
    // The parent performs no revocation, so the local clear IS the logout.
    // Refusing to clear because the network failed would leave the user
    // signed in against their explicit instruction.
    const { adapter, keychain } = makeAdapter([
      async () => {
        throw new TypeError("Failed to fetch");
      },
    ]);
    keychain.seed("tok");

    await expect(adapter.logout()).resolves.toBeUndefined();
    expect(keychain.token).toBeUndefined();
  });

  it("clears the keychain even on a 500 from logout", async () => {
    const { adapter, keychain } = makeAdapter([
      async () => jsonResponse({ error: "Internal server error" }, 500),
    ]);
    keychain.seed("tok");

    await adapter.logout();
    expect(keychain.token).toBeUndefined();
  });

  it("drops the csrf token on logout", async () => {
    const seen: (string | undefined)[] = [];
    const { adapter, keychain } = makeAdapter(
      [async () => jsonResponse(logoutSuccessFixture)],
      (t) => seen.push(t),
    );
    keychain.seed("tok");
    await adapter.logout();
    expect(seen).toEqual([undefined]);
  });
});

describe("token handling (SEC-A1)", () => {
  it("reads the token from the keychain per request rather than caching it", async () => {
    // The token must not live in a module-level or instance variable: it
    // is briefly in webview memory for the request and then gone.
    const { adapter, keychain } = makeAdapter([
      async () => jsonResponse(meAuthenticatedFixture),
    ]);
    keychain.seed("t1");

    await adapter.restoreSession();
    await adapter.restoreSession();

    // Two restores -> two loads. A cached token would show only one.
    expect(keychain.calls.filter((c) => c === "load")).toHaveLength(2);
  });

  it("exposes no token property on the adapter instance", async () => {
    const { adapter, keychain } = makeAdapter([
      async () => jsonResponse(loginSuccessFixture),
    ]);
    await adapter.login({ email: "a@b.co", password: "x" });

    expect(JSON.stringify(adapter)).not.toContain(
      loginSuccessFixture.data.token,
    );
    expect(keychain.token).toBe(loginSuccessFixture.data.token);
  });

  it("reports itself enabled, leaving the gate to GatedAuthService", () => {
    const { adapter } = makeAdapter([async () => jsonResponse({})]);
    // An adapter that gated itself would let one condition satisfy the
    // deliberately two-condition gate.
    expect(adapter.isEnabled()).toBe(true);
  });
});
