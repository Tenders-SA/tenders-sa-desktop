import {
  AuthError,
  type AuthPort,
  type Credentials,
  type SessionCredentialStore,
  type SessionSummary,
} from "./ports";

export interface GatedAuthServiceOptions {
  /** `config.featureFlags.desktopAuth`. Defaults off (TASK-0.3). */
  enabled: boolean;
  credentialStore: SessionCredentialStore;
  /**
   * The audited production adapter. Intentionally optional and
   * intentionally absent today: TASK-1.3 has not audited the parent
   * login/session/logout contract, so no correct implementation can
   * exist yet. Supplying one without that audit would be guessing at a
   * security contract.
   */
  auditedAdapter?: AuthPort;
}

/**
 * Enforces REQ-4's gate: production authentication stays unavailable
 * until BOTH the feature flag is on AND an audited adapter exists.
 *
 * The two conditions are deliberately separate. A flag flipped on by
 * itself must not be enough to authenticate against an unaudited
 * contract -- that would let a config change defeat a security gate.
 */
export class GatedAuthService implements AuthPort {
  private readonly enabled: boolean;
  private readonly credentialStore: SessionCredentialStore;
  private readonly auditedAdapter?: AuthPort;

  constructor(options: GatedAuthServiceOptions) {
    this.enabled = options.enabled;
    this.credentialStore = options.credentialStore;
    this.auditedAdapter = options.auditedAdapter;
  }

  isEnabled(): boolean {
    return this.enabled && this.auditedAdapter !== undefined;
  }

  private assertUsable(): AuthPort {
    if (!this.enabled) {
      throw new AuthError(
        "disabled",
        "Desktop authentication is disabled in this build.",
      );
    }
    if (!this.auditedAdapter) {
      throw new AuthError(
        "contract-unconfirmed",
        "Desktop authentication is not available until the native authentication contract is confirmed.",
      );
    }
    return this.auditedAdapter;
  }

  async login(credentials: Credentials): Promise<SessionSummary> {
    return this.assertUsable().login(credentials);
  }

  async restoreSession(): Promise<SessionSummary | undefined> {
    // Restoring is gated identically to logging in: a stored token
    // from some earlier build must not silently grant a session while
    // the contract is unconfirmed.
    return this.assertUsable().restoreSession();
  }

  /**
   * Logout is the one operation that works while gated. Clearing
   * local credentials must always be possible -- refusing to let a
   * user drop stored tokens because a feature flag is off would be
   * backwards (PRIV-1).
   */
  async logout(): Promise<void> {
    await this.auditedAdapter?.logout().catch(() => undefined);
    await this.credentialStore.clear();
  }
}
