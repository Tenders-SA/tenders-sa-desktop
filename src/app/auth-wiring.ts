/**
 * Composition root for authentication and the parent API (TASK-2.10).
 *
 * Refs: REQ-A9, SEC-A4
 *
 * This is the only place the audited adapter is constructed and handed to
 * the gate. Keeping it in one module rather than inline in `App.tsx` means
 * the wiring is testable: a test can assert that the gate's two conditions
 * behave correctly without rendering the application.
 *
 * **The two-condition gate still stands.** `GatedAuthService.isEnabled()`
 * requires BOTH the `desktopAuth` flag AND an audited adapter
 * (`gated-auth-service.ts`). The adapter exists and the flag now defaults to
 * `true`, so authentication is the normal operating mode; setting the flag to
 * `false` remains a working kill switch for local development against a
 * backend that is down.
 */

import { createParentApiTransport } from "../services/api/tauri-http-transport";
import { SubscriptionEndpoint } from "../services/api/endpoints/subscription";
import { TendersEndpoint } from "../services/api/endpoints/tenders";
import { ApplicationsEndpoint } from "../services/api/endpoints/applications";
import { CompanyEndpoint } from "../services/api/endpoints/company";
import { DashboardEndpoint } from "../services/api/endpoints/dashboard";
import { PulseEndpoint } from "../services/api/endpoints/pulse";
import { DocumentsEndpoint } from "../services/api/endpoints/documents";
import { EligibilityEndpoint } from "../services/api/endpoints/eligibility";
import { NotificationsEndpoint } from "../services/api/endpoints/notifications";
import { PlannerEndpoint } from "../services/api/endpoints/planner";
import { PreferencesEndpoint } from "../services/api/endpoints/preferences";
import { RecommendationsEndpoint } from "../services/api/endpoints/recommendations";
import { SavedTendersEndpoint } from "../services/api/endpoints/saved-tenders";
import { SupplierIntelligenceEndpoint } from "../services/api/endpoints/supplier-intelligence";
import { ProcurementOfficersEndpoint } from "../services/api/endpoints/procurement-officers";
import { GatedAuthService } from "../services/auth/gated-auth-service";
import { nativeCredentialStore } from "../services/auth/native-credential-store";
import { ParentAuthAdapter } from "../services/auth/parent-auth-adapter";
import type { SessionCredentialStore } from "../services/auth/ports";
import type { ApiTransport } from "../services/api/transport";

export interface AuthWiringOptions {
  /** `config.featureFlags.desktopAuth`. */
  desktopAuthEnabled: boolean;
  /** The main-application API origin (never the Developer API). */
  apiBaseUrl: string;
  /** Overridable for tests; defaults to the OS keychain. */
  credentialStore?: SessionCredentialStore;
  /**
   * Overridable for tests; defaults to the HTTP-plugin transport.
   *
   * An injected transport is used exactly as given, so it does **not** get
   * the session-loss hook -- a caller supplying its own transport owns
   * wiring `onUnauthorized` if it wants that behaviour. Stated because the
   * silent alternative would be a test that passes while the production
   * path is what actually carries the hook.
   */
  transport?: ApiTransport;
  /**
   * Swaps the network underneath the transport this function builds, rather
   * than replacing the transport.
   *
   * That distinction is the point: a test using this exercises the real
   * transport with the real `onUnauthorized` hook attached, which a test
   * passing `transport` cannot. Ignored when `transport` is supplied.
   */
  fetchImpl?: typeof fetch;
}

/**
 * Every parent-internal endpoint client the application uses.
 *
 * Grouped into one object so a screen receives exactly the client it needs
 * and the composition root stays the single place a token-reading closure is
 * handed out.
 */
export interface ApiClients {
  subscription: SubscriptionEndpoint;
  tenders: TendersEndpoint;
  dashboard: DashboardEndpoint;
  /** Market-level activity for the Command Centre charts (Slice 8). */
  pulse: PulseEndpoint;
  recommendations: RecommendationsEndpoint;
  savedTenders: SavedTendersEndpoint;
  applications: ApplicationsEndpoint;
  company: CompanyEndpoint;
  documents: DocumentsEndpoint;
  eligibility: EligibilityEndpoint;
  notifications: NotificationsEndpoint;
  planner: PlannerEndpoint;
  preferences: PreferencesEndpoint;
  supplierIntelligence: SupplierIntelligenceEndpoint;
  procurementOfficers: ProcurementOfficersEndpoint;
}

export interface AuthWiring extends ApiClients {
  auth: GatedAuthService;
  /** The CSRF token captured at login, in memory only. */
  getCsrfToken: () => string | undefined;
  /**
   * Registers the app's reaction to session loss, returning an unsubscribe.
   *
   * A subscription rather than a constructor argument because the wiring is
   * built at module scope, before any React state setter exists. The
   * keychain is cleared by the wiring itself regardless of whether anyone
   * has subscribed, so a missing listener cannot leave a dead token behind.
   */
  onSessionExpired: (listener: () => void) => () => void;
}

export function createAuthWiring(options: AuthWiringOptions): AuthWiring {
  const credentialStore = options.credentialStore ?? nativeCredentialStore;

  const sessionExpiredListeners = new Set<() => void>();

  /**
   * A 401 on an authenticated route means the stored token is dead. The
   * parent does not revoke and the token is opaque to this client (INT-1),
   * so being refused is the only way to find out.
   *
   * The keychain is cleared first and unconditionally: a token the server
   * rejects is worthless, and keeping it only means failing every
   * subsequent request with it.
   */
  const handleUnauthorized = () => {
    void credentialStore.clear().catch(() => undefined);
    for (const listener of sessionExpiredListeners) {
      listener();
    }
  };

  const transport =
    options.transport ??
    createParentApiTransport({
      baseUrl: options.apiBaseUrl,
      onUnauthorized: handleUnauthorized,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });

  // Memory only, never persisted: it is re-minted at every login and is not
  // a bearer credential.
  let csrfToken: string | undefined;

  const auditedAdapter = new ParentAuthAdapter({
    transport,
    credentialStore,
    onCsrfToken: (token) => {
      csrfToken = token;
    },
  });

  const auth = new GatedAuthService({
    enabled: options.desktopAuthEnabled,
    credentialStore,
    auditedAdapter,
  });

  // Read per request from the keychain (SEC-A1) -- never captured into a
  // variable here, and never cached at module scope. Shared by every client
  // below so there is exactly one way a token is obtained.
  const endpointOptions = {
    transport,
    getToken: () => credentialStore.loadAccessToken(),
  };

  const clients: ApiClients = {
    subscription: new SubscriptionEndpoint(endpointOptions),
    tenders: new TendersEndpoint(endpointOptions),
    dashboard: new DashboardEndpoint(endpointOptions),
    recommendations: new RecommendationsEndpoint(endpointOptions),
    savedTenders: new SavedTendersEndpoint(endpointOptions),
    applications: new ApplicationsEndpoint(endpointOptions),
    company: new CompanyEndpoint(endpointOptions),
    documents: new DocumentsEndpoint(endpointOptions),
    eligibility: new EligibilityEndpoint(endpointOptions),
    notifications: new NotificationsEndpoint(endpointOptions),
    planner: new PlannerEndpoint(endpointOptions),
    preferences: new PreferencesEndpoint(endpointOptions),
    pulse: new PulseEndpoint(endpointOptions),
    supplierIntelligence: new SupplierIntelligenceEndpoint(endpointOptions),
    procurementOfficers: new ProcurementOfficersEndpoint(endpointOptions),
  };

  return {
    auth,
    ...clients,
    getCsrfToken: () => csrfToken,
    onSessionExpired: (listener) => {
      sessionExpiredListeners.add(listener);
      return () => sessionExpiredListeners.delete(listener);
    },
  };
}
