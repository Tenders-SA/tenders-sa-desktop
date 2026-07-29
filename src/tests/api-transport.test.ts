import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiTransport } from "../services/api/transport";
import { ApiError } from "../services/api/errors";

const dataSchema = z.object({ id: z.string(), title: z.string() });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeTransport(
  fetchImpl: typeof fetch,
  overrides: Partial<ConstructorParameters<typeof ApiTransport>[0]> = {},
) {
  return new ApiTransport({
    baseUrl: "https://api.tenders-sa.org",
    getApiKey: () => "tsa_prod_test_key",
    fetchImpl,
    // Deterministic: no real backoff waiting in tests.
    sleep: () => Promise.resolve(),
    ...overrides,
  });
}

/** Awaits a rejection and narrows it to ApiError for assertions. */
async function expectApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) {
      return error;
    }
    throw error;
  }
  throw new Error("expected the request to reject with an ApiError");
}

describe("ApiTransport", () => {
  it("unwraps a valid success envelope", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ success: true, data: { id: "t1", title: "Road works" } }),
    ) as unknown as typeof fetch;

    const result = await makeTransport(fetchImpl).get({
      path: "/v2/tenders/t1",
      schema: dataSchema,
    });

    expect(result).toEqual({ id: "t1", title: "Road works" });
  });

  it("sends the bearer key and builds query parameters", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ success: true, data: { id: "t1", title: "x" } }),
    ) as unknown as typeof fetch;

    await makeTransport(fetchImpl).get({
      path: "/v2/tenders",
      query: { limit: 20, cursor: "abc", omitted: undefined },
      schema: dataSchema,
    });

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe(
      "https://api.tenders-sa.org/v2/tenders?limit=20&cursor=abc",
    );
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer tsa_prod_test_key",
    });
  });

  it("omits the Authorization header when no key is available", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ success: true, data: { id: "t1", title: "x" } }),
    ) as unknown as typeof fetch;

    await makeTransport(fetchImpl, { getApiKey: () => undefined }).get({
      path: "/v2/meta/status",
      schema: dataSchema,
    });

    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect((init as RequestInit).headers).not.toHaveProperty("Authorization");
  });

  it("maps a 401 error envelope to an unauthorized ApiError", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        {
          success: false,
          error: "The provided API key is invalid or has been revoked",
          code: "INVALID_API_KEY",
          requestId: "req_7def27c7",
        },
        401,
      ),
    ) as unknown as typeof fetch;

    const error = await expectApiError(
      makeTransport(fetchImpl).get({ path: "/v2/tenders", schema: dataSchema }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe("unauthorized");
    expect(error.code).toBe("INVALID_API_KEY");
    expect(error.requestId).toBe("req_7def27c7");
    expect(error.isTransient).toBe(false);
  });

  it("distinguishes 403 forbidden from 401 unauthorized", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ success: false, error: "Not entitled" }, 403),
    ) as unknown as typeof fetch;

    const error = await expectApiError(
      makeTransport(fetchImpl).get({ path: "/v2/tenders", schema: dataSchema }),
    );

    expect(error.kind).toBe("forbidden");
  });

  it("never auto-retries a rate limit (REQ-A6)", async () => {
    // CHANGED IN PHASE 2, deliberately. Phase 0 treated 429 as transient
    // and retried it, which is ordinary practice. The Phase 1 audit made
    // that wrong here: the parent's limiter is IP-keyed, allows 10
    // attempts per 15 minutes, and is *deliberately* not reset on success
    // (auth-subscription-contract.md §3, with the reasoning quoted in the
    // route). Retrying therefore spends the user's own budget for nothing,
    // and because the key is an IP it can lock out everyone behind one
    // office NAT. REQ-A6 makes "never auto-retry a 429" a requirement, so
    // `ApiError.isTransient` no longer includes `rate-limited` and the
    // wait is surfaced via `retryAfterSeconds` for the caller to honour.
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ success: false, error: "Too many requests" }, 429),
    ) as unknown as typeof fetch;

    const error = (await makeTransport(fetchImpl)
      .get({ path: "/v2/tenders", schema: dataSchema })
      .catch((e: unknown) => e)) as ApiError;

    expect(error.kind).toBe("rate-limited");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries a 5xx and gives up after the retry budget", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ success: false, error: "Boom" }, 500),
    ) as unknown as typeof fetch;

    const error = await expectApiError(
      makeTransport(fetchImpl).get({ path: "/v2/tenders", schema: dataSchema }),
    );

    expect(error.kind).toBe("server");
    // 1 initial attempt + 2 retries
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("never retries when the policy says never", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ success: false, error: "Boom" }, 500),
    ) as unknown as typeof fetch;

    await makeTransport(fetchImpl)
      .get({
        path: "/v2/tenders",
        schema: dataSchema,
        policy: { retry: "never" },
      })
      .catch(() => undefined);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("never retries a non-transient 4xx", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ success: false, error: "Nope" }, 404),
    ) as unknown as typeof fetch;

    const error = await expectApiError(
      makeTransport(fetchImpl).get({
        path: "/v2/tenders/x",
        schema: dataSchema,
      }),
    );

    expect(error.kind).toBe("not-found");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reports a malformed 2xx body rather than returning bad data", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ success: true, data: { id: "t1" } }),
    ) as unknown as typeof fetch;

    const error = await expectApiError(
      makeTransport(fetchImpl).get({
        path: "/v2/tenders/t1",
        schema: dataSchema,
      }),
    );

    expect(error.kind).toBe("malformed");
  });

  it("handles a non-2xx whose body is not a valid error envelope", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("<html>gateway error</html>", { status: 502 }),
    ) as unknown as typeof fetch;

    const error = await expectApiError(
      makeTransport(fetchImpl).get({ path: "/v2/tenders", schema: dataSchema }),
    );

    expect(error.kind).toBe("server");
    expect(error.message).not.toContain("<html>");
  });

  it("maps a network failure to offline", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const error = await expectApiError(
      makeTransport(fetchImpl).get({
        path: "/v2/tenders",
        schema: dataSchema,
        policy: { retry: "never" },
      }),
    );

    expect(error.kind).toBe("offline");
    expect(error.isTransient).toBe(true);
  });

  it("times out a slow request", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const abortError = new Error("aborted");
            abortError.name = "AbortError";
            reject(abortError);
          });
        }),
    ) as unknown as typeof fetch;

    const error = await expectApiError(
      makeTransport(fetchImpl).get({
        path: "/v2/tenders",
        schema: dataSchema,
        policy: { timeoutMs: 5, retry: "never" },
      }),
    );

    expect(error.kind).toBe("timeout");
  });

  it("propagates caller cancellation without retrying", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const abortError = new Error("aborted");
            abortError.name = "AbortError";
            reject(abortError);
          });
          controller.abort();
        }),
    ) as unknown as typeof fetch;

    const error = await expectApiError(
      makeTransport(fetchImpl).get({
        path: "/v2/tenders",
        schema: dataSchema,
        signal: controller.signal,
      }),
    );

    expect(error.kind).toBe("cancelled");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects immediately if the caller's signal is already aborted", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const controller = new AbortController();
    controller.abort();

    const error = await expectApiError(
      makeTransport(fetchImpl).get({
        path: "/v2/tenders",
        schema: dataSchema,
        signal: controller.signal,
      }),
    );

    expect(error.kind).toBe("cancelled");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never puts the API key into an error message or log fields", async () => {
    const secretKey = "tsa_prod_super_secret_key_value";
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ success: false, error: "Invalid API Key" }, 401),
    ) as unknown as typeof fetch;

    const error = await expectApiError(
      makeTransport(fetchImpl, {
        getApiKey: () => secretKey,
      }).get({ path: "/v2/tenders", schema: dataSchema }),
    );

    const rendered = `${error.message} ${JSON.stringify(error.toLogFields())}`;
    expect(rendered).not.toContain(secretKey);
  });
});
