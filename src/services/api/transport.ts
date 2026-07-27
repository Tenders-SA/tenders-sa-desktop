import { z } from "zod";
import { apiErrorEnvelopeSchema, apiSuccessEnvelope } from "./envelope";
import {
  ApiError,
  cancelledError,
  fromErrorEnvelope,
  fromUnparseableResponse,
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
}

export interface RequestOptions<T extends z.ZodTypeAny> {
  path: string;
  query?: Record<string, string | number | undefined>;
  schema: T;
  signal?: AbortSignal;
  policy?: Partial<RequestPolicy>;
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

function backoffMs(attempt: number): number {
  return Math.min(500 * 2 ** (attempt - 1), 8_000);
}

export class ApiTransport {
  private readonly baseUrl: string;
  private readonly getApiKey: TransportOptions["getApiKey"];
  private readonly fetchImpl: typeof fetch;
  private readonly policy: RequestPolicy;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: TransportOptions) {
    this.baseUrl = options.baseUrl;
    this.getApiKey = options.getApiKey;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.policy = { ...DEFAULT_POLICY, ...options.defaultPolicy };
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
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "AbortError"
  );
}
