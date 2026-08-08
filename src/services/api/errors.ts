import type { ApiErrorEnvelope } from "./envelope";

/**
 * Distinct failure states the UI and sync queue must tell apart
 * (REQ-5). Kept as a closed union so a caller cannot silently treat
 * an auth failure as a retryable network blip.
 */
export type ApiErrorKind =
  | "unauthorized" // 401 -- missing/invalid/revoked key
  | "forbidden" // 403 -- authenticated but not entitled
  | "not-found" // 404
  | "rate-limited" // 429
  | "validation" // 4xx with a request-shaped problem
  | "server" // 5xx
  | "offline" // no network / DNS / connection refused
  | "timeout" // client-side deadline exceeded
  | "cancelled" // caller aborted
  | "malformed"; // 2xx whose body failed schema validation

const REDACTED = "[redacted]";

/**
 * A typed, already-redacted transport error.
 *
 * `message` is safe to log and to show a user: it is drawn from the
 * server's own `error` string or a fixed local string, never from the
 * request body, headers, or query values, which can carry credentials
 * or tender content (REQ-8, PRIV-1, OPS-1).
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly requestId?: string;
  /** Seconds from a `Retry-After` header, so the UI can show a real wait. */
  readonly retryAfterSeconds?: number;
  /**
   * From the workspace lifecycle route's 400: the status transitions the
   * parent would accept, so the UI can offer only legal moves.
   */
  readonly allowed?: string[];

  constructor(init: {
    kind: ApiErrorKind;
    message: string;
    status?: number;
    code?: string;
    requestId?: string;
    retryAfterSeconds?: number;
    allowed?: string[];
  }) {
    super(init.message);
    this.name = "ApiError";
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.requestId = init.requestId;
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.allowed = init.allowed;
  }

  /**
   * Safe-idempotent retry is only ever attempted for these.
   *
   * `rate-limited` is deliberately NOT transient (REQ-A6), which is a
   * change from the Phase 0 behaviour. The Phase 1 audit found the
   * parent's limiter is IP-keyed, allows 10 attempts per 15 minutes, and
   * is deliberately not reset on success
   * (`auth-subscription-contract.md` §3). Auto-retrying therefore spends
   * the user's own budget to no benefit, and because the key is an IP it
   * can lock out everyone behind one office NAT. A 429 is surfaced with
   * `retryAfterSeconds` instead, and the caller decides.
   */
  get isTransient(): boolean {
    return (
      this.kind === "offline" ||
      this.kind === "timeout" ||
      this.kind === "server"
    );
  }

  /** Structured form for logs -- carries no payload content. */
  toLogFields(): Record<string, string | number | undefined> {
    return {
      kind: this.kind,
      status: this.status,
      code: this.code,
      requestId: this.requestId,
      retryAfterSeconds: this.retryAfterSeconds,
    };
  }
}

function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limited";
  if (status >= 500) return "server";
  return "validation";
}

/**
 * Builds an ApiError from a parsed error envelope. The server's
 * `error` string is used as the message: it is server-authored prose
 * (e.g. "The provided API key is invalid or has been revoked"), not an
 * echo of what the client sent.
 */
export function fromErrorEnvelope(
  status: number,
  envelope: ApiErrorEnvelope,
): ApiError {
  return new ApiError({
    kind: kindForStatus(status),
    message: envelope.error,
    status,
    code: envelope.code,
    requestId: envelope.requestId,
  });
}

/**
 * Fallback for a non-2xx response whose body is not a valid error
 * envelope. Deliberately does NOT include the raw body: an
 * unrecognised body could be an HTML error page or proxy output
 * containing arbitrary content.
 */
export function fromUnparseableResponse(status: number): ApiError {
  return new ApiError({
    kind: kindForStatus(status),
    message: `Request failed with status ${status}`,
    status,
  });
}

/**
 * Builds an ApiError from a parent-internal failure body (REQ-A12).
 *
 * The parent emits no machine-readable error code on the routes this
 * client consumes, so `code` is almost always absent and the HTTP status
 * plus the `error` string are the only signals. `message` (present only
 * on the middleware form) is *not* used as the user-facing message: it is
 * an implementation detail of which layer rejected the request, not a
 * stable contract, and "Authentication required" is less useful to a user
 * than the status-derived text.
 */
export function fromParentError(
  status: number,
  body: { error: string; message?: string; code?: string; allowed?: string[] },
  retryAfterSeconds?: number,
): ApiError {
  return new ApiError({
    kind: kindForStatus(status),
    message: body.error,
    status,
    code: body.code,
    retryAfterSeconds,
    allowed: body.allowed,
  });
}

export function malformedResponseError(): ApiError {
  return new ApiError({
    kind: "malformed",
    message: "The server returned a response in an unexpected format",
  });
}

export function offlineError(): ApiError {
  return new ApiError({
    kind: "offline",
    message: "No network connection is available",
  });
}

export function timeoutError(timeoutMs: number): ApiError {
  return new ApiError({
    kind: "timeout",
    message: `The request timed out after ${timeoutMs}ms`,
  });
}

export function cancelledError(): ApiError {
  return new ApiError({
    kind: "cancelled",
    message: "The request was cancelled",
  });
}

/** Masks a bearer token for the rare case a header must be logged. */
export function redactAuthorization(value: string | undefined): string {
  return value ? REDACTED : "";
}
