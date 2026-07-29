/**
 * Parent-API transport wired through `tauri-plugin-http` (TASK-2.3,
 * REQ-A1, REQ-A2).
 *
 * This file is deliberately thin. TASK-0.7 built `ApiTransport` with an
 * injectable `fetchImpl`, and the plugin's `fetch` is signature-compatible
 * with the web one -- `(input, init?) => Promise<Response>` -- so
 * retargeting the transport is an injection, not a rewrite. The timeout,
 * cancellation, bounded-retry, error-normalisation and schema-validation
 * policy is reused untouched (REQ-A2).
 *
 * Why the plugin at all: the parent sets **no CORS headers** on any route
 * the desktop needs, so an ordinary webview `fetch` is blocked on every
 * one of them (`auth-subscription-contract.md` §6). The plugin performs
 * the request in Rust, where browser CORS does not apply.
 *
 * What the plugin does NOT do is assemble headers. It takes them from the
 * caller, so `Authorization` is supplied by TypeScript and the Bearer
 * token is briefly present in webview memory. SEC-A1 confines that (read
 * per request from the keychain, never retained) and SEC-A2 contains it
 * (one-origin allow-list, `script-src 'self'`, local `connect-src`), with
 * `capability-scope.test.ts` failing if either boundary is widened.
 */

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { ApiTransport, type TransportOptions } from "./transport";

export interface ParentApiTransportOptions extends Omit<
  TransportOptions,
  "getApiKey"
> {
  /**
   * Deliberately absent: the parent uses a session JWT supplied per
   * request by the auth adapter, not a long-lived API key. `getApiKey`
   * exists on `TransportOptions` for the public Developer API, which this
   * client does not consume (REQ-A14).
   */
  getApiKey?: never;
}

/**
 * Builds the transport the desktop uses for every parent-internal call.
 *
 * `fetchImpl` defaults to the plugin's `fetch`. It stays injectable so
 * tests can drive the policy layer with a fake without a Tauri runtime --
 * the plugin's `fetch` throws outside one, which would make the transport
 * untestable if it were hard-wired.
 */
export function createParentApiTransport(
  options: ParentApiTransportOptions,
): ApiTransport {
  return new ApiTransport({
    ...options,
    fetchImpl: options.fetchImpl ?? (tauriFetch as typeof fetch),
  });
}

/**
 * Header names the parent contract uses.
 *
 * `x-csrf-token` is sent on mutations even though **no** mutating parent
 * route validates it today: across all 714 handlers the only caller of
 * the CSRF validators is the CSRF endpoint itself
 * (`auth-subscription-contract.md` §7). The machinery is fully built and
 * one import away from being switched on, at which point every desktop
 * mutation would break at once, in the field, on a release the desktop
 * team did not ship. One header per mutation makes that a non-event.
 */
export const AUTHORIZATION_HEADER = "Authorization";
export const CSRF_HEADER = "x-csrf-token";

export function bearerHeader(token: string): Record<string, string> {
  return { [AUTHORIZATION_HEADER]: `Bearer ${token}` };
}
