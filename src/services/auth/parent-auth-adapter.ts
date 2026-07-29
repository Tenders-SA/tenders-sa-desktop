/**
 * The audited parent authentication adapter (TASK-2.6).
 *
 * Refs: REQ-A3, REQ-A4, REQ-A7, REQ-A8, INT-A1, SEC-A1
 * Contract: `docs/audits/auth-subscription-contract.md`, read from parent
 * source at `8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1` and re-verified
 * unchanged by TASK-2.1.
 *
 * Every non-obvious behaviour here exists because the audit found the
 * parent does something a reasonable implementation would not expect.
 * The four that matter:
 *
 *   1. `/api/auth/me` returns **HTTP 200** with `user: null` when there is
 *      no session. Session validity is `user !== null`, never the status.
 *   2. `/api/auth/me` **re-mints the token** on every call and is the only
 *      renewal mechanism -- there is no `/api/auth/refresh`. The returned
 *      token must be persisted or the sliding 7-day window silently
 *      becomes a hard expiry.
 *   3. Logout performs **no server-side revocation**. Clearing the
 *      keychain locally is the real logout.
 *   4. Login's three 401 causes are separable **only by the `error`
 *      string** -- there is no machine-readable code (gap A-1).
 *
 * INT-A1: the token is treated as an opaque string. It is never parsed,
 * decoded, verified, or inspected -- the desktop has no access to the
 * signing secret and must not reimplement parent JWT logic.
 */

import { z } from "zod";
import type { ApiTransport } from "../api/transport";
import { ApiError } from "../api/errors";
import { bearerHeader, CSRF_HEADER } from "../api/tauri-http-transport";
import {
  AuthError,
  type AuthFailureKind,
  type AuthPort,
  type Credentials,
  type SessionCredentialStore,
  type SessionSummary,
} from "./ports";

/* ------------------------------------------------------------------ *
 * Response schemas -- hand-authored, `awaiting-contract` per INT-6.
 *
 * Neither parent OpenAPI document describes the parent-internal API, so
 * none of these may be generated. Each validates the WHOLE body: there is
 * no single envelope to unwrap (nine shapes exist across 16 endpoints).
 * ------------------------------------------------------------------ */

const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
  subscriptionTier: z.string(),
  emailVerified: z.boolean(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  name: z.string().optional(),
  company: z.object({ id: z.string(), name: z.string() }).optional(),
});

/** `POST /api/auth/login` -- parent shape #1, `{success, data}`. */
const loginResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    message: z.string(),
    token: z.string(),
    user: authUserSchema,
    company: z.object({ id: z.string(), name: z.string() }).nullable(),
    // null whenever Redis is down: login still succeeds, so this must not
    // be required and its absence must never block anything.
    csrfToken: z.string().nullable(),
  }),
});

/** `GET /api/auth/me` -- parent shape #7, a bare domain object. */
const meResponseSchema = z.object({
  user: authUserSchema.nullable(),
  company: z.object({ id: z.string(), name: z.string() }).nullable(),
  token: z.string().nullable(),
});

/** `POST /api/auth/logout` -- parent shape #3, bare `{success: true}`. */
const logoutResponseSchema = z.object({ success: z.literal(true) });

/* ------------------------------------------------------------------ *
 * Failure mapping
 * ------------------------------------------------------------------ */

/**
 * The exact `error` strings the parent returns for its three 401 causes.
 *
 * Matching on prose is brittle and we know it. It is the only option: the
 * parent emits no error code on these routes and, per the platform-
 * adaptation policy, will not be changed to. Isolating the match here --
 * one function, one place -- means a parent copy edit breaks a test rather
 * than silently degrading a user with an unverified email into "check your
 * password", which is advice no password can satisfy.
 *
 * Pinned by `parent-auth-contract.test.ts` against the audited fixtures.
 */
const ACCOUNT_INACTIVE_ERROR =
  "Account is not active. Please verify your email or contact support.";

/**
 * Maps a transport error onto an auth failure.
 *
 * Note 401 does NOT map to `unauthorized`-as-session-expiry here: on the
 * login route a 401 means the credentials were rejected, which is a
 * different user-facing state from an expired session.
 */
export function classifyLoginFailure(error: ApiError): AuthError {
  if (error.kind === "rate-limited") {
    return new AuthError(
      "rate-limited",
      "Too many login attempts. Please wait before trying again.",
      { retryAfterSeconds: error.retryAfterSeconds },
    );
  }

  if (error.kind === "unauthorized") {
    // The one place the error string is load-bearing (gap A-1).
    if (error.message === ACCOUNT_INACTIVE_ERROR) {
      return new AuthError(
        "account-inactive",
        "This account is not active yet. Please verify your email address.",
      );
    }
    return new AuthError("invalid-credentials", "Incorrect email or password.");
  }

  if (error.kind === "offline" || error.kind === "timeout") {
    return new AuthError(
      "network",
      "Could not reach Tenders-SA. Check your connection and try again.",
    );
  }

  // 5xx, malformed 2xx, unparseable body, validation -- all of these are
  // "not the user's fault and not their problem to fix".
  return new AuthError(
    "server-error",
    "Something went wrong on the server. Please try again shortly.",
  );
}

/* ------------------------------------------------------------------ *
 * Adapter
 * ------------------------------------------------------------------ */

export interface ParentAuthAdapterOptions {
  transport: ApiTransport;
  credentialStore: SessionCredentialStore;
  /**
   * Notified whenever the CSRF token changes, so the API layer can attach
   * `x-csrf-token` to mutations. Held in memory only -- it is re-minted at
   * every login and is not a bearer credential.
   */
  onCsrfToken?: (token: string | undefined) => void;
}

function toSessionSummary(
  user: z.infer<typeof authUserSchema>,
): SessionSummary {
  return {
    userId: user.id,
    email: user.email,
    displayName: user.name ?? user.firstName,
    // `expiresAt` is deliberately absent. The contract exposes no expiry
    // the desktop may read without decoding the JWT, which INT-A1
    // forbids. Expiry is discovered by `/me` returning `user: null`, or by
    // a 401 on any gated route.
  };
}

export class ParentAuthAdapter implements AuthPort {
  private readonly transport: ApiTransport;
  private readonly credentialStore: SessionCredentialStore;
  private readonly onCsrfToken?: (token: string | undefined) => void;

  constructor(options: ParentAuthAdapterOptions) {
    this.transport = options.transport;
    this.credentialStore = options.credentialStore;
    this.onCsrfToken = options.onCsrfToken;
  }

  /**
   * Always true for the adapter itself. The *gate* lives in
   * `GatedAuthService`, which additionally requires the `desktopAuth`
   * flag; an adapter that reported its own enablement would let one
   * condition satisfy a two-condition gate.
   */
  isEnabled(): boolean {
    return true;
  }

  async login(credentials: Credentials): Promise<SessionSummary> {
    let response: z.infer<typeof loginResponseSchema>;
    try {
      response = await this.transport.request({
        method: "POST",
        path: "/api/auth/login",
        schema: loginResponseSchema,
        body: { email: credentials.email, password: credentials.password },
        // Explicit, though `request()` already forces this for mutations:
        // a 429 must never be auto-retried (REQ-A6), and a replayed login
        // would spend another attempt from an IP-keyed budget.
        policy: { retry: "never" },
      });
    } catch (error) {
      // The password is in scope here. It is never attached to the thrown
      // error, and `classifyLoginFailure` builds messages from fixed local
      // strings rather than echoing anything we sent (SEC-A3).
      throw error instanceof ApiError
        ? classifyLoginFailure(error)
        : new AuthError("server-error", "Login failed unexpectedly.");
    }

    await this.credentialStore.save(response.data.token);
    this.onCsrfToken?.(response.data.csrfToken ?? undefined);
    return toSessionSummary(response.data.user);
  }

  /**
   * Restores a session, and renews it as a side effect.
   *
   * `/api/auth/me` is a public route: it returns 200 with `user: null`
   * rather than 401, so the status code carries no session information.
   */
  async restoreSession(): Promise<SessionSummary | undefined> {
    const token = await this.credentialStore.loadAccessToken();
    if (!token) {
      return undefined;
    }

    let response: z.infer<typeof meResponseSchema>;
    try {
      response = await this.transport.request({
        method: "GET",
        path: "/api/auth/me",
        schema: meResponseSchema,
        headers: bearerHeader(token),
      });
    } catch (error) {
      if (error instanceof ApiError && error.kind === "unauthorized") {
        // A stored token the server rejects is worthless -- drop it rather
        // than leaving it to fail every subsequent request.
        await this.credentialStore.clear();
        return undefined;
      }
      // A transient failure must NOT discard a possibly-valid token: the
      // user is offline, not logged out.
      throw error;
    }

    if (response.user === null) {
      // 200, but no session. Clear the dead token.
      await this.credentialStore.clear();
      return undefined;
    }

    if (response.token) {
      // Load-bearing: `/me` re-mints on every call and is the only renewal
      // path. Skipping this turns a sliding 7-day window into a hard
      // expiry that logs the user out mid-work, a week after release.
      await this.credentialStore.save(response.token);
    }

    return toSessionSummary(response.user);
  }

  /**
   * Logs out locally, unconditionally.
   *
   * The parent has no revocation primitive -- no denylist, no
   * `tokenVersion`, no revocation check -- so a keychain-held token stays
   * valid for up to 7 days after logout. Deleting it locally is therefore
   * the only thing that actually ends the session, and it must happen
   * whether or not the remote call succeeds.
   */
  async logout(): Promise<void> {
    const token = await this.credentialStore.loadAccessToken();
    try {
      await this.transport.request({
        method: "POST",
        path: "/api/auth/logout",
        schema: logoutResponseSchema,
        headers: token ? bearerHeader(token) : undefined,
        policy: { retry: "never" },
      });
    } catch {
      // Deliberately swallowed. A failed remote logout must not prevent
      // the local clear, which is the part that matters (PRIV-1).
    } finally {
      this.onCsrfToken?.(undefined);
      await this.credentialStore.clear();
    }
  }
}

/** Exported for the contract tests to assert the pinned string. */
export const AUDITED_ERROR_STRINGS = {
  accountInactive: ACCOUNT_INACTIVE_ERROR,
} as const;

export type { AuthFailureKind };
export { CSRF_HEADER };
