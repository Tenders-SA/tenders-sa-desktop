/**
 * Subscription endpoint adapter (TASK-2.8).
 *
 * Refs: REQ-A10, REQ-A11, REQ-A12, INT-A2, INT-5, SEC-A4
 * Contract: `docs/audits/auth-subscription-contract.md` §8, read from
 * parent source at `8ff2e4c2` and re-verified by TASK-2.1.
 *
 * `awaiting-contract` (INT-6): these schemas are **hand-authored**. Neither
 * parent OpenAPI document describes the parent-internal API -- the parent's
 * own `v1.yaml` and the published v2.1.0 both cover the public Developer
 * API only -- so nothing here may be generated.
 *
 * Two audited traps are handled explicitly, and both are the kind that
 * produce a plausible-looking wrong answer rather than an error:
 *
 *   1. `/status` **synthesises** a `'free'` plan with `id: null` for a user
 *      who holds application credits but has no subscription row. Branching
 *      on `subscription === null` alone therefore hides features the user
 *      has paid for.
 *   2. `/feature-access/[feature]` returns **`hasAccess: false` inside its
 *      HTTP 500 body**. Reading the flag without checking the status turns
 *      a transient outage into an upgrade prompt.
 */

import { z } from "zod";
import { ApiError } from "../errors";
import { bearerHeader } from "../tauri-http-transport";
import type { ApiTransport } from "../transport";

/* ------------------------------------------------------------------ *
 * Schemas
 * ------------------------------------------------------------------ */

const applicationSlotsSchema = z.object({
  total: z.number(),
  used: z.number(),
  remaining: z.number(),
  preserved: z.number(),
  resetsAt: z.string().nullable(),
});

/**
 * The desktop's subscription projection.
 *
 * Modelled on the **route's response**, not the Prisma model. The model
 * carries Paystack/PayPal/Paddle identifiers; this projection omits them,
 * which is precisely what makes it safe to cache (`model-inventory.md` §4).
 *
 * `id` is nullable because the synthesised free plan has none, and
 * `currentPeriodStart` is `null` in *both* branches of the route -- so no
 * billing start may be rendered from this endpoint.
 */
export const subscriptionSchema = z.object({
  id: z.string().nullable(),
  planName: z.string(),
  tier: z.string(),
  status: z.string(),
  currentPeriodStart: z.null(),
  currentPeriodEnd: z.string().nullable(),
  isTrial: z.boolean(),
  trialEndsAt: z.string().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  applicationSlots: applicationSlotsSchema,
  // Shape not pinned by the audit; kept permissive rather than guessed.
  applicationCredits: z.unknown(),
});

/** Parent shape #4: `{success, <domainKey>}` -- not `{success, data}`. */
export const subscriptionStatusResponseSchema = z.object({
  success: z.literal(true),
  subscription: subscriptionSchema.nullable(),
  message: z.string().optional(),
});

/** Parent shape #7: a bare domain object, no `success` discriminator. */
export const featureAccessResponseSchema = z.object({
  hasAccess: z.boolean(),
  reason: z.string().optional(),
  minimumTier: z.string().optional(),
  upgradeUrl: z.string().optional(),
  source: z.enum(["subscription", "bundle", "none"]),
});

export type Subscription = z.infer<typeof subscriptionSchema>;
export type FeatureAccess = z.infer<typeof featureAccessResponseSchema>;

/* ------------------------------------------------------------------ *
 * Entitlement view model
 * ------------------------------------------------------------------ */

/**
 * What the UI actually needs, with the `subscription === null` trap already
 * resolved.
 *
 * `kind` is a closed union so a caller cannot accidentally treat
 * "credit-holding free user" as "no entitlement".
 */
export type EntitlementSummary =
  | { kind: "subscribed"; subscription: Subscription }
  | { kind: "free-with-credits"; subscription: Subscription }
  | { kind: "none"; message?: string };

/**
 * Interprets a `/status` response.
 *
 * A synthesised free plan is reported as `free-with-credits`, distinct from
 * both a real subscription and from nothing. It is identified by
 * `id === null` -- the route builds it that way -- rather than by
 * `tier === 'free'`, because a genuine free-tier subscription row would
 * also have that tier while having a real id.
 */
export function summariseEntitlement(
  response: z.infer<typeof subscriptionStatusResponseSchema>,
): EntitlementSummary {
  if (response.subscription === null) {
    return { kind: "none", message: response.message };
  }
  if (response.subscription.id === null) {
    return { kind: "free-with-credits", subscription: response.subscription };
  }
  return { kind: "subscribed", subscription: response.subscription };
}

/* ------------------------------------------------------------------ *
 * Adapter
 * ------------------------------------------------------------------ */

export interface SubscriptionEndpointOptions {
  transport: ApiTransport;
  /** Reads the Bearer token from the keychain, per request (SEC-A1). */
  getToken: () => Promise<string | undefined>;
}

export class SubscriptionEndpoint {
  private readonly transport: ApiTransport;
  private readonly getToken: () => Promise<string | undefined>;

  constructor(options: SubscriptionEndpointOptions) {
    this.transport = options.transport;
    this.getToken = options.getToken;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    // No token means no Authorization header. The request will be rejected
    // by middleware, which is the correct outcome -- the client must not
    // pretend to be authorised.
    return token ? bearerHeader(token) : {};
  }

  /** `GET /api/subscription/status` -- middleware-gated, safe to retry. */
  async getStatus(signal?: AbortSignal): Promise<EntitlementSummary> {
    const response = await this.transport.request({
      method: "GET",
      path: "/api/subscription/status",
      schema: subscriptionStatusResponseSchema,
      headers: await this.authHeaders(),
      signal,
    });
    return summariseEntitlement(response);
  }

  /**
   * `GET /api/subscription/feature-access/[feature]`.
   *
   * Returns the server's answer, or throws. It deliberately does **not**
   * fall back to a local decision: access can be granted by a
   * `BundleWallet` the client has no visibility into, so a local
   * computation cannot be correct even in principle (INT-5, SEC-A4).
   *
   * The HTTP 500 body carries `hasAccess: false`. The transport turns any
   * non-2xx into an `ApiError`, so that body never reaches the caller as a
   * denial -- an outage surfaces as an error, not as an upsell.
   */
  async getFeatureAccess(
    feature: string,
    signal?: AbortSignal,
  ): Promise<FeatureAccess> {
    if (!feature) {
      // The route returns 400 for this; failing locally avoids a pointless
      // round trip and keeps the error legible.
      throw new ApiError({
        kind: "validation",
        message: "A feature name is required",
      });
    }
    return this.transport.request({
      method: "GET",
      path: `/api/subscription/feature-access/${encodeURIComponent(feature)}`,
      schema: featureAccessResponseSchema,
      headers: await this.authHeaders(),
      signal,
    });
  }
}
