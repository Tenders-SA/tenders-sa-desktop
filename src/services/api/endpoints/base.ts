/**
 * Shared base for authenticated parent-internal endpoint clients.
 *
 * Refs: INT-A3, SEC-A1, REQ-A12
 *
 * Every desktop endpoint client consumes the **same routes the web
 * application uses** (`/api/...`), never the public Developer API. That is
 * enforced mechanically by `src/tests/endpoint-parity.test.ts`.
 *
 * The token is read from the OS keychain per request and retained in no
 * variable (SEC-A1), which is why `getToken` is a function rather than a
 * value. Response validation stays per-endpoint: the parent has no single
 * envelope, and the shapes genuinely differ from route to route -- some
 * return `{success, data}`, some a bare object, some a domain-named key.
 */

import { bearerHeader } from "../tauri-http-transport";
import type { ApiTransport } from "../transport";

export interface AuthenticatedEndpointOptions {
  transport: ApiTransport;
  /** Reads the Bearer token from the keychain, per request (SEC-A1). */
  getToken: () => Promise<string | undefined>;
}

export abstract class AuthenticatedEndpoint {
  protected readonly transport: ApiTransport;
  private readonly getToken: () => Promise<string | undefined>;

  constructor(options: AuthenticatedEndpointOptions) {
    this.transport = options.transport;
    this.getToken = options.getToken;
  }

  /**
   * `Authorization` for one request, or `{}` when there is no session.
   *
   * An empty object rather than a throw: the route answers 401, the
   * transport's session-loss hook fires, and the screen renders a real
   * error. Throwing here would produce a different failure for the same
   * underlying condition.
   */
  protected async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return token ? bearerHeader(token) : {};
  }
}

/**
 * `{total, page, limit, totalPages}` — the parent's `buildPaginationMeta`.
 *
 * Deliberately **not** shared with `/api/tenders`, which returns
 * `{page, limit, total, pages}` from a different helper. Two names for the
 * last field, and unifying them would break one caller silently.
 */
export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** `{total, limit, offset, hasMore}` — the offset-style parent helper. */
export interface OffsetMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
