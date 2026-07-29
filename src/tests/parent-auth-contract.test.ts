/**
 * Executable form of the TASK-1.3 audited parent auth/subscription
 * contract (`docs/audits/auth-subscription-contract.md`).
 *
 * This does not test the parent — the desktop cannot reach it, and Phase 1
 * is read-only. It pins the *desktop's understanding* of the contract, so
 * that Phase 2's adapter is written against schemas already proven to
 * parse the verified shapes, and so the traps recorded in the audit fail
 * a test rather than only appearing in prose.
 */

import { describe, expect, it } from "vitest";
import {
  AUTH_FAILURES,
  authFailureSchema,
  authUserSchema,
  bearer,
  FEATURE_ACCESS,
  featureAccessSchema,
  GATED_SUBSCRIPTION_ROUTES,
  JWT_EXPIRY_SECONDS,
  loginFailureSchema,
  LOGIN_FAILURES,
  loginSuccessFixture,
  loginSuccessNoCsrfFixture,
  loginSuccessSchema,
  logoutSuccessFixture,
  logoutSuccessSchema,
  meAuthenticatedFixture,
  ME_HTTP_STATUS_ALWAYS,
  meSchema,
  meUnauthenticatedFixture,
  PARENT_BASELINE_SHA,
  PUBLIC_AUTH_ROUTES,
  subscriptionActiveFixture,
  subscriptionNoneFixture,
  subscriptionStatusSchema,
  subscriptionSynthesisedFreeFixture,
} from "./fixtures/parent-auth-contract";

describe("parent auth contract — provenance", () => {
  it("pins the baseline SHA every shape was read at", () => {
    expect(PARENT_BASELINE_SHA).toBe(
      "8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1",
    );
  });
});

describe("login", () => {
  it("parses the success body", () => {
    expect(loginSuccessSchema.parse(loginSuccessFixture)).toBeTruthy();
  });

  it("accepts a null csrfToken, because Redis being down does not fail login", () => {
    expect(loginSuccessSchema.parse(loginSuccessNoCsrfFixture)).toBeTruthy();
    expect(loginSuccessNoCsrfFixture.data.csrfToken).toBeNull();
  });

  it("never exposes credential material beyond the token", () => {
    const user = authUserSchema.parse(loginSuccessFixture.data.user);
    // toAuthUser (src/lib/auth.ts:73-92) omits these; the Prisma model has
    // them. A schema built from the model would demand `password`.
    expect(user).not.toHaveProperty("password");
    expect(user).not.toHaveProperty("emailVerificationToken");
    expect(user).not.toHaveProperty("adminNotes");
  });

  it("parses every failure body", () => {
    for (const failure of Object.values(LOGIN_FAILURES)) {
      expect(loginFailureSchema.parse(failure.body)).toBeTruthy();
    }
  });

  it("cannot distinguish the three 401 causes by status code alone (gap A-1)", () => {
    const unauthorised = [
      LOGIN_FAILURES.invalidCredentials,
      LOGIN_FAILURES.noPasswordSet,
      LOGIN_FAILURES.accountInactive,
    ];
    expect(unauthorised.every((f) => f.status === 401)).toBe(true);

    // Only the error string separates them, which is why an
    // "account inactive" affordance needs a parent-side error code.
    const messages = new Set(unauthorised.map((f) => f.body.error));
    expect(messages.size).toBe(3);
  });

  it("carries Retry-After on 429 and must not be auto-retried", () => {
    expect(LOGIN_FAILURES.rateLimited.status).toBe(429);
    expect(LOGIN_FAILURES.rateLimited.headers["Retry-After"]).toMatch(/^\d+$/);
  });
});

describe("/api/auth/me", () => {
  it("returns 200 even when there is no session", () => {
    expect(ME_HTTP_STATUS_ALWAYS).toBe(200);
    expect(meSchema.parse(meUnauthenticatedFixture)).toBeTruthy();
  });

  it("signals session validity through `user`, not the status code", () => {
    // The trap: a client treating "not 401" as "signed in" never logs out.
    expect(meUnauthenticatedFixture.user).toBeNull();
    expect(meAuthenticatedFixture.user).not.toBeNull();
  });

  it("re-mints a token on every call, which the caller must persist", () => {
    const parsed = meSchema.parse(meAuthenticatedFixture);
    expect(parsed.token).toBeTruthy();
    // Dropping this token turns the sliding 7-day window into a hard expiry.
    expect(parsed.token).not.toBe(loginSuccessFixture.data.token);
  });

  it("is authoritative for subscription tier, overriding login's value", () => {
    expect(loginSuccessFixture.data.user.subscriptionTier).toBe("free");
    expect(meAuthenticatedFixture.user.subscriptionTier).toBe("pro");
  });
});

describe("logout", () => {
  it("parses the success body", () => {
    expect(logoutSuccessSchema.parse(logoutSuccessFixture)).toBeTruthy();
  });

  it("does not revoke the token, so local clearing is the real logout", () => {
    // No revocation exists parent-side (gap A-2): jwt-service has no
    // denylist, tokenVersion, or revocation check. A keychain-held token
    // stays valid for the full expiry window after logout.
    expect(JWT_EXPIRY_SECONDS).toBe(604_800);
    expect(logoutSuccessFixture).toEqual({ success: true });
  });
});

describe("authorization failures", () => {
  it("parses both the middleware and route-handler shapes", () => {
    for (const failure of Object.values(AUTH_FAILURES)) {
      expect(authFailureSchema.parse(failure.body)).toBeTruthy();
    }
  });

  it("never carries a `success` discriminator", () => {
    for (const failure of Object.values(AUTH_FAILURES)) {
      expect(failure.body).not.toHaveProperty("success");
    }
  });

  it("distinguishes 401 from 403 by status, not by body", () => {
    expect(AUTH_FAILURES.middlewareNoToken.status).toBe(401);
    expect(AUTH_FAILURES.middlewareBadToken.status).toBe(401);
    expect(AUTH_FAILURES.routeHandler.status).toBe(401);
    expect(AUTH_FAILURES.middlewareForbidden.status).toBe(403);
  });

  it("tolerates a 401 with no `message`, which the route-level shape omits", () => {
    expect(AUTH_FAILURES.routeHandler.body).not.toHaveProperty("message");
    expect(
      authFailureSchema.parse(AUTH_FAILURES.routeHandler.body),
    ).toBeTruthy();
  });
});

describe("subscription status", () => {
  it("parses active, synthesised-free, and none", () => {
    expect(
      subscriptionStatusSchema.parse(subscriptionActiveFixture),
    ).toBeTruthy();
    expect(
      subscriptionStatusSchema.parse(subscriptionSynthesisedFreeFixture),
    ).toBeTruthy();
    expect(
      subscriptionStatusSchema.parse(subscriptionNoneFixture),
    ).toBeTruthy();
  });

  it("returns a synthesised free plan with a null id for credit holders", () => {
    const { subscription } = subscriptionSynthesisedFreeFixture;
    // Branching on `subscription === null` alone would hide paid features.
    expect(subscription).not.toBeNull();
    expect(subscription.id).toBeNull();
    expect(subscription.tier).toBe("free");
    expect(subscription.applicationCredits.totalRemaining).toBeGreaterThan(0);
  });

  it("never leaks payment identifiers into the desktop projection", () => {
    const serialised = JSON.stringify(subscriptionActiveFixture);
    for (const field of [
      "paystackSubscriptionId",
      "paystackEmailToken",
      "paypalSubscriptionId",
      "paddleSubscriptionId",
      "externalSubscriptionId",
    ]) {
      expect(serialised).not.toContain(field);
    }
  });

  it("reports no billing period start, in either branch", () => {
    expect(
      subscriptionActiveFixture.subscription.currentPeriodStart,
    ).toBeNull();
    expect(
      subscriptionSynthesisedFreeFixture.subscription.currentPeriodStart,
    ).toBeNull();
  });
});

describe("feature access", () => {
  it("parses subscription, bundle, and denied outcomes", () => {
    for (const outcome of [
      FEATURE_ACCESS.viaSubscription,
      FEATURE_ACCESS.viaBundle,
      FEATURE_ACCESS.denied,
    ]) {
      expect(featureAccessSchema.parse(outcome.body)).toBeTruthy();
    }
  });

  it("grants access from a bundle wallet independently of any subscription", () => {
    // Entitlement depends on wallet state the client does not hold, which
    // is why the desktop must never compute access locally (INT-5, SEC-3).
    expect(FEATURE_ACCESS.viaBundle.body.source).toBe("bundle");
    expect(FEATURE_ACCESS.viaBundle.body.hasAccess).toBe(true);
  });

  it("returns hasAccess:false in its 500 body, which is not a denial", () => {
    expect(FEATURE_ACCESS.serverError.status).toBe(500);
    expect(FEATURE_ACCESS.serverError.body.hasAccess).toBe(false);
    // Reading the flag without the status turns an outage into an upsell.
    expect(FEATURE_ACCESS.serverError.body).toHaveProperty("error");
  });
});

describe("transport", () => {
  it("formats the Authorization header as Bearer", () => {
    expect(bearer("abc")).toBe("Bearer abc");
  });

  it("keeps the auth routes public and the subscription routes gated", () => {
    // Why /api/auth/me can return 200 with user:null rather than being
    // intercepted by middleware with a 401.
    expect(PUBLIC_AUTH_ROUTES).toContain("/api/auth/me");
    expect(GATED_SUBSCRIPTION_ROUTES).toContain("/api/subscription/status");
    for (const route of GATED_SUBSCRIPTION_ROUTES) {
      expect(PUBLIC_AUTH_ROUTES).not.toContain(route);
    }
  });
});
