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
 */
export type AuthFailureKind =
  | "disabled" // production auth is gated off (REQ-4)
  | "invalid-credentials"
  | "network"
  | "contract-unconfirmed"; // the audited contract does not exist yet

export class AuthError extends Error {
  readonly kind: AuthFailureKind;

  constructor(kind: AuthFailureKind, message: string) {
    super(message);
    this.name = "AuthError";
    this.kind = kind;
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
