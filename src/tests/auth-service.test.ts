import { describe, expect, it, vi } from "vitest";
import { GatedAuthService } from "../services/auth/gated-auth-service";
import {
  AuthError,
  type AuthFailureKind,
  type AuthPort,
  type SessionCredentialStore,
  type SessionSummary,
} from "../services/auth/ports";

const session: SessionSummary = {
  userId: "u1",
  email: "buyer@example.com",
};

function fakeStore(): SessionCredentialStore & {
  saved: Array<[string, string | undefined]>;
  cleared: number;
} {
  const saved: Array<[string, string | undefined]> = [];
  let cleared = 0;
  return {
    saved,
    get cleared() {
      return cleared;
    },
    async save(accessToken, refreshToken) {
      saved.push([accessToken, refreshToken]);
    },
    async loadAccessToken() {
      return saved[saved.length - 1]?.[0];
    },
    async clear() {
      cleared += 1;
    },
  };
}

/** Awaits a rejection and narrows it to AuthError for assertions. */
async function expectAuthError(promise: Promise<unknown>): Promise<AuthError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AuthError) {
      return error;
    }
    throw error;
  }
  throw new Error("expected the call to reject with an AuthError");
}

function fakeAdapter(): AuthPort {
  return {
    isEnabled: () => true,
    login: vi.fn(async () => session),
    restoreSession: vi.fn(async () => session),
    logout: vi.fn(async () => undefined),
  };
}

describe("GatedAuthService", () => {
  it("is disabled when the feature flag is off", () => {
    const service = new GatedAuthService({
      enabled: false,
      credentialStore: fakeStore(),
      auditedAdapter: fakeAdapter(),
    });
    expect(service.isEnabled()).toBe(false);
  });

  it("is disabled when no audited adapter exists, even with the flag on", () => {
    // This is the case that ships today.
    const service = new GatedAuthService({
      enabled: true,
      credentialStore: fakeStore(),
    });
    expect(service.isEnabled()).toBe(false);
  });

  it("refuses to log in while the flag is off", async () => {
    const service = new GatedAuthService({
      enabled: false,
      credentialStore: fakeStore(),
      auditedAdapter: fakeAdapter(),
    });

    const error = await expectAuthError(
      service.login({ email: "a@b.c", password: "pw" }),
    );

    expect(error).toBeInstanceOf(AuthError);
    expect(error.kind).toBe("disabled");
  });

  it("refuses to log in when the contract is unconfirmed, even with the flag on", async () => {
    // A config change alone must not defeat the security gate.
    const service = new GatedAuthService({
      enabled: true,
      credentialStore: fakeStore(),
    });

    const error = await expectAuthError(
      service.login({ email: "a@b.c", password: "pw" }),
    );

    expect(error.kind).toBe("contract-unconfirmed");
  });

  it("never calls the adapter while gated", async () => {
    const adapter = fakeAdapter();
    const service = new GatedAuthService({
      enabled: false,
      credentialStore: fakeStore(),
      auditedAdapter: adapter,
    });

    await service
      .login({ email: "a@b.c", password: "pw" })
      .catch(() => undefined);
    await service.restoreSession().catch(() => undefined);

    expect(adapter.login).not.toHaveBeenCalled();
    expect(adapter.restoreSession).not.toHaveBeenCalled();
  });

  it("gates session restoration too, so a stale token cannot grant a session", async () => {
    const store = fakeStore();
    await store.save("left-over-token-from-an-earlier-build");

    const service = new GatedAuthService({
      enabled: true,
      credentialStore: store,
    });

    const error = await expectAuthError(service.restoreSession());
    expect(error.kind).toBe("contract-unconfirmed");
  });

  it("always allows logout to clear credentials, even while gated", async () => {
    const store = fakeStore();
    const service = new GatedAuthService({
      enabled: false,
      credentialStore: store,
    });

    await expect(service.logout()).resolves.toBeUndefined();
    expect(store.cleared).toBe(1);
  });

  it("still clears local credentials when the adapter's logout fails", async () => {
    const store = fakeStore();
    const adapter = fakeAdapter();
    adapter.logout = vi.fn(async () => {
      throw new Error("network down");
    });

    const service = new GatedAuthService({
      enabled: true,
      credentialStore: store,
      auditedAdapter: adapter,
    });

    await expect(service.logout()).resolves.toBeUndefined();
    expect(store.cleared).toBe(1);
  });

  it("delegates to the adapter once enabled and audited", async () => {
    const adapter = fakeAdapter();
    const service = new GatedAuthService({
      enabled: true,
      credentialStore: fakeStore(),
      auditedAdapter: adapter,
    });

    expect(service.isEnabled()).toBe(true);
    await expect(
      service.login({ email: "a@b.c", password: "pw" }),
    ).resolves.toEqual(session);
    expect(adapter.login).toHaveBeenCalledOnce();
  });
});

describe("credential handling", () => {
  it("keeps credentials out of any webview-persisted store", async () => {
    // The service must never touch localStorage/sessionStorage: tokens
    // belong in the OS keychain via the native commands (SEC-2).
    const localSpy = vi.spyOn(Storage.prototype, "setItem");
    const store = fakeStore();
    const service = new GatedAuthService({
      enabled: true,
      credentialStore: store,
      auditedAdapter: fakeAdapter(),
    });

    await service.login({ email: "a@b.c", password: "hunter2" });
    await service.logout();

    expect(localSpy).not.toHaveBeenCalled();
    localSpy.mockRestore();
  });

  it("does not put the password into the thrown error", async () => {
    const password = "correct-horse-battery-staple";
    const service = new GatedAuthService({
      enabled: false,
      credentialStore: fakeStore(),
    });

    const error = await expectAuthError(
      service.login({ email: "a@b.c", password }),
    );

    expect(`${error.message} ${error.stack ?? ""}`).not.toContain(password);
  });
});

describe("AuthFailureKind (TASK-2.5, REQ-A5)", () => {
  it("expresses every failure state the audited contract produces", () => {
    // The audit found five distinct login outcomes plus transport and gate
    // failures. Before TASK-2.5 the union could express only three of
    // them, so "account inactive" and "rate limited" would have surfaced
    // as "invalid credentials" -- actively misleading in both cases.
    const kinds: AuthFailureKind[] = [
      "disabled",
      "invalid-credentials",
      "account-inactive",
      "rate-limited",
      "server-error",
      "network",
      "contract-unconfirmed",
    ];
    for (const kind of kinds) {
      expect(new AuthError(kind, "x").kind).toBe(kind);
    }
  });

  it("carries Retry-After only on rate-limited", () => {
    const limited = new AuthError("rate-limited", "Too many attempts", {
      retryAfterSeconds: 742,
    });
    expect(limited.retryAfterSeconds).toBe(742);
    expect(new AuthError("invalid-credentials", "x").retryAfterSeconds).toBe(
      undefined,
    );
  });

  it("keeps account-inactive distinct from invalid-credentials", () => {
    // Both arrive as HTTP 401 and are separable only by the error string
    // (gap A-1), which is exactly why they need distinct kinds here.
    expect(new AuthError("account-inactive", "x").kind).not.toBe(
      "invalid-credentials",
    );
  });
});
