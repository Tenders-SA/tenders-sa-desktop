/**
 * Subscription endpoint tests (TASK-2.8).
 *
 * Refs: REQ-A10, REQ-A11, REQ-A12, INT-A2, INT-5
 *
 * Driven against the TASK-1.3 contract fixtures, so the adapter is proven
 * to parse the shapes read from parent source.
 */

import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/api/errors";
import {
  SubscriptionEndpoint,
  summariseEntitlement,
  subscriptionStatusResponseSchema,
} from "../services/api/endpoints/subscription";
import { ApiTransport } from "../services/api/transport";
import {
  FEATURE_ACCESS,
  subscriptionActiveFixture,
  subscriptionNoneFixture,
  subscriptionSynthesisedFreeFixture,
} from "./fixtures/parent-auth-contract";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * `token: null` means "nothing in the keychain".
 *
 * It cannot be `undefined`: passing `undefined` to a defaulted parameter
 * triggers the default, so `makeEndpoint(fn, undefined)` would silently
 * still have a token -- which is exactly the bug the first draft of the
 * no-token test hit.
 */
function makeEndpoint(
  respond: () => Promise<Response>,
  token: string | null = "tok",
) {
  const fetchImpl = vi.fn(respond);
  const endpoint = new SubscriptionEndpoint({
    transport: new ApiTransport({
      baseUrl: "http://localhost:3000",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
    }),
    getToken: async () => token ?? undefined,
  });
  return { endpoint, fetchImpl };
}

describe("subscription status", () => {
  it("parses the audited active fixture", async () => {
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse(subscriptionActiveFixture),
    );
    const result = await endpoint.getStatus();
    expect(result.kind).toBe("subscribed");
  });

  it("reports a credit-holding free user as entitled, not as nothing", async () => {
    // THE TRAP. The route synthesises a plan with `id: null` for a user who
    // has application credits but no subscription row. Branching on
    // `subscription === null` would hide features they have paid for.
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse(subscriptionSynthesisedFreeFixture),
    );
    const result = await endpoint.getStatus();

    expect(result.kind).toBe("free-with-credits");
    expect(result.kind).not.toBe("none");
  });

  it("reports a genuinely unentitled user as none, with the server message", async () => {
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse(subscriptionNoneFixture),
    );
    const result = await endpoint.getStatus();

    expect(result.kind).toBe("none");
    if (result.kind === "none") {
      expect(result.message).toBe("No active subscription found");
    }
  });

  it("distinguishes the synthesised plan by id, not by tier", async () => {
    // A real free-tier subscription row would also have tier 'free' but a
    // real id. Keying on tier would misclassify it.
    const realFreeTier = {
      success: true as const,
      subscription: {
        ...subscriptionSynthesisedFreeFixture.subscription,
        id: "clx-real-row",
      },
    };
    expect(
      summariseEntitlement(subscriptionStatusResponseSchema.parse(realFreeTier))
        .kind,
    ).toBe("subscribed");
  });

  it("sends the Bearer token read per request", async () => {
    const { endpoint, fetchImpl } = makeEndpoint(async () =>
      jsonResponse(subscriptionActiveFixture),
    );
    await endpoint.getStatus();
    const [, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer tok",
    );
  });

  it("omits Authorization when no token is stored, rather than faking one", async () => {
    const { endpoint, fetchImpl } = makeEndpoint(
      async () => jsonResponse(subscriptionActiveFixture),
      null,
    );
    await endpoint.getStatus();
    const [, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("surfaces a 401 as an error rather than as 'no entitlement'", async () => {
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse(
        { error: "Unauthorized", message: "Authentication required" },
        401,
      ),
    );
    await expect(endpoint.getStatus()).rejects.toMatchObject({
      kind: "unauthorized",
    });
  });

  it("never exposes payment identifiers, because the projection omits them", async () => {
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse(subscriptionActiveFixture),
    );
    const result = await endpoint.getStatus();
    const serialised = JSON.stringify(result);
    for (const field of [
      "paystackSubscriptionId",
      "paystackEmailToken",
      "paypalSubscriptionId",
      "paddleSubscriptionId",
    ]) {
      expect(serialised).not.toContain(field);
    }
  });

  it("carries no billing period start, which is null in both branches", async () => {
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse(subscriptionActiveFixture),
    );
    const result = await endpoint.getStatus();
    if (result.kind === "subscribed") {
      expect(result.subscription.currentPeriodStart).toBeNull();
    }
  });
});

describe("feature access", () => {
  it("parses access granted by a subscription", async () => {
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse(FEATURE_ACCESS.viaSubscription.body),
    );
    const result = await endpoint.getFeatureAccess("document-analysis");
    expect(result.hasAccess).toBe(true);
    expect(result.source).toBe("subscription");
  });

  it("parses access granted by a bundle wallet the client cannot see", async () => {
    // Why local computation is impossible, not merely discouraged (INT-5).
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse(FEATURE_ACCESS.viaBundle.body),
    );
    const result = await endpoint.getFeatureAccess("document-analysis");
    expect(result.hasAccess).toBe(true);
    expect(result.source).toBe("bundle");
  });

  it("parses a denial with its upgrade metadata", async () => {
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse(FEATURE_ACCESS.denied.body),
    );
    const result = await endpoint.getFeatureAccess("document-analysis");
    expect(result.hasAccess).toBe(false);
    expect(result.source).toBe("none");
    expect(result.upgradeUrl).toBe("/pricing");
  });

  it("turns the HTTP 500 into an error, NOT a denial (REQ-A11)", async () => {
    // THE TRAP. The 500 body contains `hasAccess: false`. A client reading
    // the flag without the status would push the user to a pricing page
    // because of a transient outage.
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse(FEATURE_ACCESS.serverError.body, 500),
    );
    const error = (await endpoint
      .getFeatureAccess("document-analysis")
      .catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe("server");
    // Crucially: the caller never receives an object with hasAccess:false.
    expect(error).not.toHaveProperty("hasAccess");
  });

  it("rejects an empty feature name locally, without a round trip", async () => {
    const { endpoint, fetchImpl } = makeEndpoint(async () =>
      jsonResponse(FEATURE_ACCESS.viaSubscription.body),
    );
    await expect(endpoint.getFeatureAccess("")).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("encodes the feature name into the path", async () => {
    const { endpoint, fetchImpl } = makeEndpoint(async () =>
      jsonResponse(FEATURE_ACCESS.viaSubscription.body),
    );
    await endpoint.getFeatureAccess("a b/c");
    const [url] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/subscription/feature-access/a%20b%2Fc");
  });
});
