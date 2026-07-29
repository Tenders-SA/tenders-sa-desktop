/**
 * Authentication ports (REQ-4, REQ-13, INT-1).
 *
 * These are interfaces only. The production implementation cannot be
 * written yet: the supported native login/session/logout contract is
 * whatever TASK-1.3's audit of the parent platform concludes, and that
 * audit has not run. Everything here is deliberately shaped so that
 * swapping in a real adapter later is a new file, not a rewrite.
 *
 * INT-1: the desktop client must never import or reimplement the
 * parent's JWT signing/validation. It calls audited endpoints and
 * stores whatever credential material they return.
 */

/** A session as the webview is allowed to see it: no raw credentials. */
export interface SessionSummary {
  userId: string;
  email: string;
  displayName?: string;
  /** ISO 8601. Absent when the contract does not expose an expiry. */
  expiresAt?: string;
}

export interface Credentials {
  email: string;
  password: string;
}

/**
 * Why a login attempt failed, as a closed union so the UI cannot
 * confuse "wrong password" with "the feature is switched off".
 *
 * Extended by TASK-2.5 (REQ-A5). Phase 0 defined four kinds before the
 * parent contract was audited; the audited contract produces three more,
 * and collapsing them into `invalid-credentials` would walk real users
 * into dead ends. Telling someone with an unverified email address to
 * check their password is the clearest example -- there is no password
 * they can type that will work.
 */
export type AuthFailureKind =
  | "disabled" // production auth is gated off (REQ-4)
  | "invalid-credentials" // wrong password, unknown user, or no password set
  | "account-inactive" // accountStatus !== 'ACTIVE'; needs email verification
  | "rate-limited" // 429; see AuthError.retryAfterSeconds
  | "server-error" // 5xx or an unparseable response
  | "network"
  | "contract-unconfirmed"; // the audited contract does not exist yet

export class AuthError extends Error {
  readonly kind: AuthFailureKind;
  /**
   * Only set for `rate-limited`, from the parent's `Retry-After` header.
   * The limiter is IP-keyed, allows 10 attempts per 15 minutes, and is
   * deliberately not reset on success, so the UI must show the real wait
   * rather than invite an immediate retry (REQ-A6).
   */
  readonly retryAfterSeconds?: number;

  constructor(
    kind: AuthFailureKind,
    message: string,
    options?: { retryAfterSeconds?: number },
  ) {
    super(message);
    this.name = "AuthError";
    this.kind = kind;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

/**
 * The credential store the auth service persists through. Backed in
 * production by the OS keychain via TASK-0.4's native commands --
 * never by SQLite, Zustand, or any webview-persisted state (SEC-2,
 * PRIV-1).
 */
export interface SessionCredentialStore {
  save(accessToken: string, refreshToken?: string): Promise<void>;
  loadAccessToken(): Promise<string | undefined>;
  clear(): Promise<void>;
}

export interface AuthPort {
  /** Whether production authentication is currently permitted at all. */
  isEnabled(): boolean;
  login(credentials: Credentials): Promise<SessionSummary>;
  /** Restores a session from stored credentials, if any. */
  restoreSession(): Promise<SessionSummary | undefined>;
  logout(): Promise<void>;
}
