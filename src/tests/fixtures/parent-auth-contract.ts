/**
 * Parent authentication and subscription contract fixtures (TASK-1.3).
 *
 * Every shape here was read from parent source at baseline
 * `8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1` in
 * `freelancing-solutions/tendersa`. Each fixture carries the parent path
 * and line range it came from. The decision record is
 * `docs/audits/auth-subscription-contract.md`.
 *
 * These are fixtures and schemas ONLY. There is deliberately no adapter,
 * no network call, and no keychain wiring: building those is Phase 2
 * implementation and requires a new approved contract. What this file
 * provides is the audited contract in executable form, so the Phase 2
 * adapter is written against schemas that already parse verified shapes.
 *
 * The traps these fixtures exist to pin (prose in an audit document is
 * easy to miss; a failing assertion is not):
 *
 *  - `/api/auth/me` returns HTTP 200 with `user: null` when there is no
 *    session. Session validity is `user !== null`, never the status code.
 *  - A 401 arrives in two different body shapes depending on whether
 *    middleware or the route handler rejected the request, and neither
 *    carries `success: false`.
 *  - `/api/subscription/status` synthesises a `'free'` subscription with
 *    `id: null` for credit-holding users, so `subscription === null` is
 *    not the test for "no entitlement".
 *  - `/api/subscription/feature-access/[feature]` returns
 *    `hasAccess: false` in its HTTP 500 body, so a client that reads the
 *    flag without checking status treats an outage as a hard denial.
 */

import { z } from "zod";

/** Parent commit every shape below was read at. */
export const PARENT_BASELINE_SHA = "8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1";

/* ------------------------------------------------------------------ *
 * Login — src/app/api/auth/login/route.ts
 * ------------------------------------------------------------------ */

/**
 * `toAuthUser` projection — src/lib/auth.ts:73-92.
 *
 * Modelled on the DTO, NOT on the Prisma `User` model. The model declares
 * `password` as a required field; the DTO omits it, along with
 * `emailVerificationToken` and `adminNotes`. A schema generated from the
 * Prisma model would demand a field the desktop must never receive.
 */
export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.string(),
  subscriptionTier: z.string(),
  emailVerified: z.boolean(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  name: z.string().optional(),
  company: z.object({ id: z.string(), name: z.string() }).optional(),
});

/** Success body — login/route.ts:113-122. */
export const loginSuccessSchema = z.object({
  success: z.literal(true),
  data: z.object({
    message: z.string(),
    token: z.string(),
    user: authUserSchema,
    // `company` is duplicated out of `user.company` by the route and is
    // explicitly nullable there, unlike the optional field on the DTO.
    company: z.object({ id: z.string(), name: z.string() }).nullable(),
    // null whenever Redis is unavailable: login/route.ts:102-108 catches
    // the failure and continues. Never block login on this being present.
    csrfToken: z.string().nullable(),
  }),
});

/** Every login failure body — login/route.ts:32-38, 49-79, 134-140. */
export const loginFailureSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

export const loginSuccessFixture = {
  success: true,
  data: {
    message: "Login successful",
    token: "eyJhbGciOiJIUzI1NiJ9.PLACEHOLDER.SIGNATURE",
    user: {
      id: "clx0000000000000000000000",
      email: "buyer@example.co.za",
      role: "USER",
      subscriptionTier: "free",
      emailVerified: true,
      firstName: "Thandi",
      lastName: "Mokoena",
      name: "Thandi Mokoena",
      company: { id: "clx0000000000000000000001", name: "Example Trading" },
    },
    company: { id: "clx0000000000000000000001", name: "Example Trading" },
    csrfToken: "csrf-placeholder",
  },
} as const;

/** Redis down: login still succeeds, csrfToken is null (route.ts:102-108). */
export const loginSuccessNoCsrfFixture = {
  ...loginSuccessFixture,
  data: { ...loginSuccessFixture.data, csrfToken: null, company: null },
} as const;

/**
 * The three 401s are separable ONLY by this string — there is no error
 * code (gap A-1). "Account is not active" is a materially different user
 * state from a wrong password and needs a different affordance.
 */
export const LOGIN_FAILURES = {
  invalidCredentials: {
    status: 401,
    body: { success: false, error: "Invalid credentials" },
  },
  noPasswordSet: {
    status: 401,
    body: {
      success: false,
      error: "Invalid credentials or account not set up for password login",
    },
  },
  accountInactive: {
    status: 401,
    body: {
      success: false,
      error:
        "Account is not active. Please verify your email or contact support.",
    },
  },
  rateLimited: {
    status: 429,
    // Retry-After carries the remaining seconds. The limiter is IP-keyed
    // and is deliberately NOT reset on success (route.ts:96-100), so this
    // must never be auto-retried.
    headers: { "Retry-After": "742" },
    body: {
      success: false,
      error: "Too many login attempts. Please try again later.",
    },
  },
  serverError: {
    status: 500,
    body: { success: false, error: "Internal server error" },
  },
} as const;

/* ------------------------------------------------------------------ *
 * Session — src/app/api/auth/me/route.ts
 * ------------------------------------------------------------------ */

/**
 * `/api/auth/me` — ALWAYS HTTP 200, including unauthenticated and caught
 * -error paths (route.ts:17-23, 44-51). It is a public route in
 * middleware's allowlist, so the handler really does run for callers with
 * no token.
 *
 * It also re-mints the JWT on every call (route.ts:25-29). There is no
 * /api/auth/refresh anywhere in the parent: this endpoint IS the renewal
 * mechanism, and the returned token must overwrite the stored one or the
 * sliding 7-day window silently becomes a hard expiry.
 */
export const meSchema = z.object({
  user: authUserSchema.nullable(),
  company: z.object({ id: z.string(), name: z.string() }).nullable(),
  token: z.string().nullable(),
});

export const meAuthenticatedFixture = {
  user: {
    ...loginSuccessFixture.data.user,
    // Overlaid, lower-cased, from getEffectiveSubscriptionForUser
    // (route.ts:31-37). This may differ from login's value — /me wins.
    subscriptionTier: "pro",
  },
  company: { id: "clx0000000000000000000001", name: "Example Trading" },
  token: "eyJhbGciOiJIUzI1NiJ9.REMINTED.SIGNATURE",
} as const;

/** No session — note the 200. Detect via `user === null`. */
export const meUnauthenticatedFixture = {
  user: null,
  company: null,
  token: null,
} as const;

export const ME_HTTP_STATUS_ALWAYS = 200;

/* ------------------------------------------------------------------ *
 * Logout — src/app/api/auth/logout/route.ts
 * ------------------------------------------------------------------ */

/**
 * Clears the cookie only. It does NOT revoke the token: jwt-service has
 * no denylist, no tokenVersion, and no revocation check (gap A-2), so a
 * keychain-held body token stays valid for up to 7 days after logout.
 * Deleting the local token is therefore the real logout.
 */
export const logoutSuccessSchema = z.object({ success: z.literal(true) });
export const logoutSuccessFixture = { success: true } as const;

/** logout/route.ts:25 — bare `{ error }`, no `success` discriminator. */
export const logoutServerErrorFixture = {
  status: 500,
  body: { error: "Internal server error" },
} as const;

/* ------------------------------------------------------------------ *
 * Authorization failures — two shapes
 * ------------------------------------------------------------------ */

/**
 * A 401 body differs by rejecting layer, and NEITHER carries
 * `success: false`. In practice the desktop sees the middleware shape:
 * middleware verifies the same JWT with the same secret before the
 * handler runs, so the route-level form is effectively unreachable on
 * gated routes.
 *
 * `message` is not a stable contract — treat every 401 as
 * "session invalid, clear and re-authenticate".
 */
export const authFailureSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});

export const AUTH_FAILURES = {
  /** src/middleware.ts:274-277 */
  middlewareNoToken: {
    status: 401,
    body: { error: "Unauthorized", message: "Authentication required" },
  },
  /** src/middleware.ts:315-318 */
  middlewareBadToken: {
    status: 401,
    body: { error: "Unauthorized", message: "Invalid or expired token" },
  },
  /** src/middleware.ts:296-299 — admin routes only */
  middlewareForbidden: {
    status: 403,
    body: { error: "Forbidden", message: "Admin access required" },
  },
  /** e.g. subscription/status/route.ts:13-16 — no `message` */
  routeHandler: {
    status: 401,
    body: { error: "Unauthorized" },
  },
} as const;

/* ------------------------------------------------------------------ *
 * Subscription — src/app/api/subscription/status/route.ts
 * ------------------------------------------------------------------ */

const applicationSlotsSchema = z.object({
  total: z.number(),
  used: z.number(),
  remaining: z.number(),
  preserved: z.number(),
  resetsAt: z.string(),
});

/**
 * The projection deliberately excludes every payment identifier on the
 * Prisma model (paystack*, paypal*, paddle*, external*). That is what
 * makes this response safe for the desktop to cache — consume this, never
 * the model.
 *
 * `id` is nullable because the synthesised free plan has none, and
 * `currentPeriodStart` is hard-coded null in BOTH branches of the route.
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
  applicationCredits: z.unknown(),
});

export const subscriptionStatusSchema = z.object({
  success: z.literal(true),
  subscription: subscriptionSchema.nullable(),
  message: z.string().optional(),
});

export const subscriptionActiveFixture = {
  success: true,
  subscription: {
    id: "clx0000000000000000000002",
    planName: "Professional",
    tier: "pro",
    status: "ACTIVE",
    currentPeriodStart: null,
    currentPeriodEnd: "2026-08-27T00:00:00.000Z",
    isTrial: false,
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    applicationSlots: {
      total: 50,
      used: 12,
      remaining: 38,
      preserved: 0,
      resetsAt: "2026-08-27T00:00:00.000Z",
    },
    applicationCredits: { totalRemaining: 0 },
  },
} as const;

/**
 * TRAP (status/route.ts:22-46): a user with no subscription but with
 * remaining application credits gets a SYNTHESISED free plan, with
 * `id: null`. Branching on `subscription === null` alone misclassifies
 * these users as unentitled and hides features they have paid for.
 */
export const subscriptionSynthesisedFreeFixture = {
  success: true,
  subscription: {
    id: null,
    planName: "free",
    tier: "free",
    status: "ACTIVE",
    currentPeriodStart: null,
    currentPeriodEnd: null,
    isTrial: false,
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    applicationSlots: {
      total: 0,
      used: 0,
      remaining: 0,
      preserved: 0,
      resetsAt: "2026-07-28T00:00:00.000Z",
    },
    applicationCredits: { totalRemaining: 3 },
  },
} as const;

/** Genuinely no entitlement — status/route.ts:48-52. */
export const subscriptionNoneFixture = {
  success: true,
  subscription: null,
  message: "No active subscription found",
} as const;

/* ------------------------------------------------------------------ *
 * Feature access — feature-access/[feature]/route.ts
 * ------------------------------------------------------------------ */

/**
 * `checkFeatureAccess`'s result (feature-gating-service.ts:33-41) spread
 * with the route's added `source` discriminator.
 */
export const featureAccessSchema = z.object({
  hasAccess: z.boolean(),
  reason: z.string().optional(),
  minimumTier: z.string().optional(),
  upgradeUrl: z.string().optional(),
  source: z.enum(["subscription", "bundle", "none"]),
});

export const FEATURE_ACCESS = {
  viaSubscription: {
    status: 200,
    body: { hasAccess: true, source: "subscription" },
  },
  /** Any ACTIVE BundleWallet with credits counts as paid access. */
  viaBundle: {
    status: 200,
    body: {
      hasAccess: true,
      source: "bundle",
      reason: "Active bundle wallet (Action Pack) grants access.",
    },
  },
  denied: {
    status: 200,
    body: {
      hasAccess: false,
      source: "none",
      reason: "No active subscription found",
      minimumTier: "pro",
      upgradeUrl: "/pricing",
    },
  },
  missingFeatureName: {
    status: 400,
    body: { error: "Feature name is required" },
  },
  /**
   * TRAP (route.ts:88-96): the 500 body contains `hasAccess: false`.
   * Fail-closed is right, but a client that reads the flag without
   * checking status will push the user to a pricing page because of a
   * transient outage. Report this as an error, not as a denial.
   */
  serverError: {
    status: 500,
    body: {
      hasAccess: false,
      source: "none",
      error: "Failed to check feature access",
      details: "An unexpected error occurred",
    },
  },
} as const;

/* ------------------------------------------------------------------ *
 * Transport constants
 * ------------------------------------------------------------------ */

export const AUTH_HEADER = "Authorization";
export const bearer = (token: string): string => `Bearer ${token}`;

/** src/lib/csrf.ts. Sent on mutations even though no route validates it. */
export const CSRF_HEADER = "x-csrf-token";

/** src/lib/auth-constants.ts — 7 days. */
export const JWT_EXPIRY_SECONDS = 604_800;

/**
 * Public routes reachable without a token (src/middleware.ts
 * PUBLIC_API_ROUTES, 45 entries — the auth subset the desktop uses).
 * Everything else under /api is middleware-gated.
 */
export const PUBLIC_AUTH_ROUTES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
] as const;

export const GATED_SUBSCRIPTION_ROUTES = [
  "/api/subscription/status",
  "/api/subscription/feature-access/[feature]",
] as const;
