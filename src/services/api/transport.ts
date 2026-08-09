import { z } from "zod";
import {
  apiErrorEnvelopeSchema,
  apiSuccessEnvelope,
  parentErrorSchema,
} from "./envelope";
import {
  ApiError,
  cancelledError,
  fromErrorEnvelope,
  fromParentError,
  fromUnparseableResponse,
  invalidRequestError,
  malformedResponseError,
  offlineError,
  timeoutError,
} from "./errors";

export interface RequestPolicy {
  timeoutMs: number;
  /**
   * Retries are limited to safe idempotent operations. Every endpoint
   * in the v2 API is a GET, but this stays explicit so a future
   * mutation cannot inherit retries by accident (REQ-5).
   */
  retry: "never" | "safe-idempotent";
  maxRetries: number;
}

export interface TransportOptions {
  baseUrl: string;
  /** Returns the bearer key, or undefined for anonymous endpoints. */
  getApiKey?: () => Promise<string | undefined> | string | undefined;
  fetchImpl?: typeof fetch;
  defaultPolicy?: Partial<RequestPolicy>;
  /** Injected for deterministic backoff tests. */
  sleep?: (ms: number) => Promise<void>;
  /**
   * Called when a request to an authenticated parent route fails 401.
   *
   * The parent does not revoke, so the desktop learns a token is dead only
   * by being refused with it -- there is nothing to poll and no `exp` the
   * client is allowed to read (INT-1, the token is opaque). This is how
   * "drop to unauthenticated on any 401" from `auth.md` is implemented in
   * one place instead of in every screen.
   *
   * Not called for requests marked `unauthenticatedIsExpected`.
   */
  onUnauthorized?: (path: string) => void;
}

export interface RequestOptions<T extends z.ZodTypeAny> {
  path: string;
  query?: Record<string, string | number | undefined>;
  schema: T;
  signal?: AbortSignal;
  policy?: Partial<RequestPolicy>;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * A parent-internal request (TASK-2.3).
 *
 * `schema` validates the **whole** response body, not a `data` field.
 * That is REQ-A12: the parent-internal API has nine distinct top-level
 * shapes, so there is no envelope to unwrap generically and each endpoint
 * declares exactly what it expects.
 */
export interface ParentRequestOptions<T extends z.ZodTypeAny> {
  method: HttpMethod;
  path: string;
  query?: Record<string, string | number | undefined>;
  /** Schema for the entire response body. */
  schema: T;
  /** Serialised as JSON. Omit for GET/DELETE. */
  body?: unknown;
  /** Extra headers, e.g. Authorization and x-csrf-token. */
  headers?: Record<string, string>;
  signal?: AbortSignal;
  policy?: Partial<RequestPolicy>;
  /**
   * Set on the auth routes. A 401 from `/api/auth/login` means "these
   * credentials are wrong", not "your session ended", and must not be
   * reported as session loss -- otherwise a mistyped password would look
   * like an expiry.
   */
  unauthenticatedIsExpected?: boolean;
}

/**
 * The two origins that may serve tender document bytes (Slice 7,
 * R-D2). The parent's `download-url` route resolves documents to either
 * the R2 docs domain or the Cloudflare Worker's `/api/document` path.
 *
 * This must mirror `src-tauri/capabilities/default.json`'s http
 * allow-list: the capability is the real security boundary, this guard is
 * defence in depth for tests and non-Tauri runtimes. Both are pinned by
 * tests (`capability-scope.test.ts` reads the JSON, transport tests use
 * this constant).
 */
export const ALLOWED_DOCUMENT_ORIGINS: readonly string[] = [
  "https://docs.tenders-sa.org",
  "https://etenders-api.tenders-sa.org",
];

/**
 * A binary-download request (Slice 6: workspace-export; Slice 7: tender
 * documents).
 *
 * The response body is not JSON, so there is no `schema`: on success the
 * caller receives raw bytes plus the filename parsed from
 * `Content-Disposition` (the parent's suggested name) and the content type.
 * Non-2xx responses keep the exact JSON error mapping of `request()` --
 * the parent answers those in `{error, message}` JSON even on binary routes.
 *
 * Exactly one of `path` and `url` must be set: `path` is a parent-API route
 * (auth headers, session-loss applies), `url` is an absolute document URL
 * on one of {@link ALLOWED_DOCUMENT_ORIGINS} (keyless, no session-loss).
 */
export interface DownloadOptions {
  method: HttpMethod;
  /** Parent-API route, e.g. `/api/v1/.../workspace-export`. Omit when `url` is set. */
  path?: string;
  /**
   * Absolute external URL on an allowed document origin, e.g.
   * `https://docs.tenders-sa.org/docs/t1/file.pdf`. Omit when `path` is
   * set.
   */
  url?: string;
  query?: Record<string, string | number | undefined>;
  /** Serialised as JSON. Omit for GET/DELETE. */
  body?: unknown;
  /** Extra headers, e.g. Authorization and x-csrf-token. */
  headers?: Record<string, string>;
  /**
   * Used when the response carries no `Content-Disposition` (the parent's
   * suggested filename); the caller supplies a route-appropriate default.
   */
  filenameFallback?: string;
  signal?: AbortSignal;
  policy?: Partial<RequestPolicy>;
  /** Same semantics as `ParentRequestOptions.unauthenticatedIsExpected`. */
  unauthenticatedIsExpected?: boolean;
}

export interface DownloadResult {
  bytes: Uint8Array;
  /** From `Content-Disposition` (sanitised), else `filenameFallback`. */
  filename: string;
  /** `Content-Type` as sent, defaulting to `application/octet-stream`. */
  contentType: string;
}

const DEFAULT_POLICY: RequestPolicy = {
  timeoutMs: 10_000,
  retry: "safe-idempotent",
  maxRetries: 2,
};

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | number | undefined>,
): string {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** `Retry-After` is seconds on the parent's 429 (auth-subscription-contract §3). */
function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number.parseInt(value, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

function backoffMs(attempt: number): number {
  return Math.min(500 * 2 ** (attempt - 1), 8_000);
}

export class ApiTransport {
  private readonly baseUrl: string;
  private readonly getApiKey: TransportOptions["getApiKey"];
  private readonly fetchImpl: typeof fetch;
  private readonly policy: RequestPolicy;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly onUnauthorized: TransportOptions["onUnauthorized"];

  constructor(options: TransportOptions) {
    this.baseUrl = options.baseUrl;
    this.getApiKey = options.getApiKey;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.policy = { ...DEFAULT_POLICY, ...options.defaultPolicy };
    this.onUnauthorized = options.onUnauthorized;
    this.sleep =
      options.sleep ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async get<T extends z.ZodTypeAny>(
    options: RequestOptions<T>,
  ): Promise<z.infer<T>> {
    const policy = { ...this.policy, ...options.policy };
    const url = buildUrl(this.baseUrl, options.path, options.query);
    const maxAttempts =
      policy.retry === "never" ? 1 : Math.max(1, policy.maxRetries + 1);

    let lastError: ApiError | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.attempt(url, options.schema, policy, options.signal);
      } catch (error) {
        if (!(error instanceof ApiError)) {
          throw error;
        }
        // A cancelled request is the caller's decision -- never retried.
        if (error.kind === "cancelled" || !error.isTransient) {
          throw error;
        }
        lastError = error;
        if (attempt < maxAttempts) {
          await this.sleep(backoffMs(attempt));
        }
      }
    }
    throw lastError ?? malformedResponseError();
  }

  /**
   * Issues a parent-internal request, validating the whole response body
   * against `schema` (REQ-A12).
   *
   * This shares the retry, timeout, cancellation and error-normalisation
   * policy with `get()` rather than reimplementing it (REQ-A2) -- only the
   * request shape and the response-parsing rule differ. A mutation gets
   * `retry: "never"` unless the caller explicitly overrides, because the
   * parent supports no idempotency key on any endpoint
   * (`endpoint-inventory.md` §4), so a replayed POST is a real duplicate.
   */
  async request<T extends z.ZodTypeAny>(
    options: ParentRequestOptions<T>,
  ): Promise<z.infer<T>> {
    try {
      return await this.performRequest(options);
    } catch (error) {
      // One choke point for session loss. Per `auth.md` §Credential
      // lifecycle, any 401 on an authenticated route means the stored token
      // is no longer usable and the app must drop to unauthenticated. Doing
      // this per screen would mean every new screen has to remember to --
      // and the one that forgets leaves the user reading "sign in" with no
      // way to act on it, which is precisely what happened before this
      // existed.
      if (
        error instanceof ApiError &&
        error.kind === "unauthorized" &&
        !options.unauthenticatedIsExpected
      ) {
        this.onUnauthorized?.(options.path);
      }
      throw error;
    }
  }

  private async performRequest<T extends z.ZodTypeAny>(
    options: ParentRequestOptions<T>,
  ): Promise<z.infer<T>> {
    const safe = options.method === "GET";
    const policy: RequestPolicy = {
      ...this.policy,
      retry: safe ? this.policy.retry : "never",
      ...options.policy,
    };
    const url = buildUrl(this.baseUrl, options.path, options.query);
    const maxAttempts =
      policy.retry === "never" ? 1 : Math.max(1, policy.maxRetries + 1);

    let lastError: ApiError | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.attemptParent(url, options, policy);
      } catch (error) {
        if (!(error instanceof ApiError)) {
          throw error;
        }
        if (error.kind === "cancelled" || !error.isTransient) {
          throw error;
        }
        lastError = error;
        if (attempt < maxAttempts) {
          await this.sleep(backoffMs(attempt));
        }
      }
    }
    throw lastError ?? malformedResponseError();
  }

  private async attemptParent<T extends z.ZodTypeAny>(
    url: string,
    options: ParentRequestOptions<T>,
    policy: RequestPolicy,
  ): Promise<z.infer<T>> {
    if (options.signal?.aborted) {
      throw cancelledError();
    }

    const controller = new AbortController();
    const onCallerAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onCallerAbort, { once: true });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, policy.timeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        ...options.headers,
      };
      if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
      }

      const response = await this.fetchImpl(url, {
        method: options.method,
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });

      const raw: unknown = await response.json().catch(() => undefined);

      if (!response.ok) {
        const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));
        const parsed = parentErrorSchema.safeParse(raw);
        throw parsed.success
          ? fromParentError(response.status, parsed.data, retryAfter)
          : fromUnparseableResponse(response.status);
      }

      // The whole body is validated -- there is no envelope to unwrap.
      const parsed = options.schema.safeParse(raw);
      if (!parsed.success) {
        // Issues are deliberately dropped: they quote the offending
        // values, which may be tender or proposal content (REQ-8).
        throw malformedResponseError();
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (isAbortError(error)) {
        throw timedOut ? timeoutError(policy.timeoutMs) : cancelledError();
      }
      throw offlineError();
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onCallerAbort);
    }
  }

  /**
   * Issues a binary-download request (Slice 6: `assist/workspace-export`).
   *
   * Shares the retry, timeout, cancellation, error-normalisation and
   * session-loss policy with `request()` rather than reimplementing it
   * (REQ-A2) -- only the response-parsing rule differs: a 2xx body is raw
   * bytes, never JSON. A download is a POST in practice, so `retry`
   * defaults to `"never"` and a caller must override explicitly.
   */
  async download(options: DownloadOptions): Promise<DownloadResult> {
    try {
      return await this.performDownload(options);
    } catch (error) {
      // One choke point for session loss, exactly as in `request()`: any 401
      // on an authenticated route means the stored token is no longer usable.
      // Scoped to `path` requests: an external document fetch is keyless, so
      // a 401 from a docs origin is a server-side signal, not a session one.
      if (
        error instanceof ApiError &&
        error.kind === "unauthorized" &&
        !options.unauthenticatedIsExpected &&
        options.path
      ) {
        this.onUnauthorized?.(options.path);
      }
      throw error;
    }
  }

  private async performDownload(
    options: DownloadOptions,
  ): Promise<DownloadResult> {
    const policy: RequestPolicy = {
      ...this.policy,
      retry: "never",
      ...options.policy,
    };
    const url = this.resolveDownloadUrl(options);
    const maxAttempts =
      policy.retry === "never" ? 1 : Math.max(1, policy.maxRetries + 1);

    let lastError: ApiError | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.attemptDownload(url, options, policy);
      } catch (error) {
        if (!(error instanceof ApiError)) {
          throw error;
        }
        if (error.kind === "cancelled" || !error.isTransient) {
          throw error;
        }
        lastError = error;
        if (attempt < maxAttempts) {
          await this.sleep(backoffMs(attempt));
        }
      }
    }
    throw lastError ?? malformedResponseError();
  }

  private async attemptDownload(
    url: string,
    options: DownloadOptions,
    policy: RequestPolicy,
  ): Promise<DownloadResult> {
    if (options.signal?.aborted) {
      throw cancelledError();
    }

    const controller = new AbortController();
    const onCallerAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onCallerAbort, { once: true });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, policy.timeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        ...options.headers,
      };
      if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
      }

      const response = await this.fetchImpl(url, {
        method: options.method,
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });

      if (!response.ok) {
        // Error responses are JSON even on binary routes.
        const raw: unknown = await response.json().catch(() => undefined);
        const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));
        const parsed = parentErrorSchema.safeParse(raw);
        throw parsed.success
          ? fromParentError(response.status, parsed.data, retryAfter)
          : fromUnparseableResponse(response.status);
      }

      const buffer = await response.arrayBuffer();
      return {
        bytes: new Uint8Array(buffer),
        filename: sanitiseFilename(
          filenameFromDisposition(
            response.headers.get("Content-Disposition"),
          ) ??
            options.filenameFallback ??
            "download.bin",
        ),
        contentType:
          response.headers.get("Content-Type") ?? "application/octet-stream",
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (isAbortError(error)) {
        throw timedOut ? timeoutError(policy.timeoutMs) : cancelledError();
      }
      throw offlineError();
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onCallerAbort);
    }
  }

  private async attempt<T extends z.ZodTypeAny>(
    url: string,
    schema: T,
    policy: RequestPolicy,
    callerSignal?: AbortSignal,
  ): Promise<z.infer<T>> {
    if (callerSignal?.aborted) {
      throw cancelledError();
    }

    const controller = new AbortController();
    const onCallerAbort = () => controller.abort();
    callerSignal?.addEventListener("abort", onCallerAbort, { once: true });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, policy.timeoutMs);

    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      const apiKey = await this.getApiKey?.();
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const response = await this.fetchImpl(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      const body: unknown = await response.json().catch(() => undefined);

      if (!response.ok) {
        const parsedError = apiErrorEnvelopeSchema.safeParse(body);
        throw parsedError.success
          ? fromErrorEnvelope(response.status, parsedError.data)
          : fromUnparseableResponse(response.status);
      }

      const parsed = apiSuccessEnvelope(schema).safeParse(body);
      if (!parsed.success) {
        // The validation issues are deliberately not attached: they
        // quote the offending values, which may be tender content.
        throw malformedResponseError();
      }
      return parsed.data.data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (isAbortError(error)) {
        throw timedOut ? timeoutError(policy.timeoutMs) : cancelledError();
      }
      // fetch() rejects with a TypeError for DNS/connection failures.
      throw offlineError();
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", onCallerAbort);
    }
  }

  /**
   * Resolves the request URL for a download: an absolute document URL when
   * `options.url` is set, else the base-URL build for a parent-API `path`.
   *
   * The absolute form is validated against {@link ALLOWED_DOCUMENT_ORIGINS}
   * before any fetch: the capability layer is the real boundary, but an
   * invalid URL must fail fast as a contract error instead of leaking a
   * request to an unvetted host in any runtime.
   */
  private resolveDownloadUrl(options: DownloadOptions): string {
    if (options.url !== undefined) {
      let parsed: URL;
      try {
        parsed = new URL(options.url);
      } catch {
        throw invalidRequestError();
      }
      if (
        parsed.protocol !== "https:" ||
        !ALLOWED_DOCUMENT_ORIGINS.includes(parsed.origin)
      ) {
        throw invalidRequestError();
      }
      return parsed.toString();
    }
    if (options.path !== undefined) {
      return buildUrl(this.baseUrl, options.path, options.query);
    }
    throw invalidRequestError();
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "AbortError"
  );
}

/**
 * Extracts the suggested filename from a `Content-Disposition` header,
 * e.g. `attachment; filename="proposal-ABC-123.pdf"`. Accepts both the
 * quoted and bare forms; absent → undefined (caller's fallback applies).
 */
function filenameFromDisposition(value: string | null): string | undefined {
  if (!value) return undefined;
  const match =
    value.match(/filename="([^"]+)"/) ?? value.match(/filename=([^;]+)/);
  return match?.[1]?.trim() || undefined;
}

/**
 * Keeps a server-suggested filename safe as a Windows/Unix file name. The
 * parent sanitises its own base (`[^\w.-]` → `_`), but a filename from any
 * route is still checked here -- defence in depth, never a path separator.
 */
function sanitiseFilename(name: string): string {
  const clean = name
    .replace(/[\\/:*?"<>|]/g, "_")
    // Control characters are stripped without a control-char regex (lint).
    .split("")
    .filter((char) => char.charCodeAt(0) >= 32)
    .join("")
    .trim();
  // A "name" with no alphanumeric character (e.g. "//" -> "__") is not a
  // usable file name; fall back rather than save an anonymous file.
  return clean.match(/[a-z0-9]/i) ? clean : "download.bin";
}
