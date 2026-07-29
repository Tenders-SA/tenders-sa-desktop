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
 * **The gate is not weakened here.** `GatedAuthService.isEnabled()` still
 * requires BOTH the `desktopAuth` flag AND an audited adapter
 * (`gated-auth-service.ts`). TASK-2.10 supplies the adapter, which means
 * the flag becomes load-bearing for the first time -- so flipping it is now
 * a real decision (gate G3), not a no-op.
 */

import { createParentApiTransport } from "../services/api/tauri-http-transport";
import { SubscriptionEndpoint } from "../services/api/endpoints/subscription";
import { TendersEndpoint } from "../services/api/endpoints/tenders";
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
  /** Overridable for tests; defaults to the HTTP-plugin transport. */
  transport?: ApiTransport;
}

export interface AuthWiring {
  auth: GatedAuthService;
  subscription: SubscriptionEndpoint;
  tenders: TendersEndpoint;
  /** The CSRF token captured at login, in memory only. */
  getCsrfToken: () => string | undefined;
}

export function createAuthWiring(options: AuthWiringOptions): AuthWiring {
  const credentialStore = options.credentialStore ?? nativeCredentialStore;
  const transport =
    options.transport ??
    createParentApiTransport({ baseUrl: options.apiBaseUrl });

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

  const subscription = new SubscriptionEndpoint({
    transport,
    // Read per request from the keychain (SEC-A1) -- not captured here, and
    // not cached in a module variable.
    getToken: () => credentialStore.loadAccessToken(),
  });

  const tenders = new TendersEndpoint({
    transport,
    getToken: () => credentialStore.loadAccessToken(),
  });

  return { auth, subscription, tenders, getCsrfToken: () => csrfToken };
}
