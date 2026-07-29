/**
 * Parent-internal transport tests (TASK-2.3, REQ-A2, REQ-A6, REQ-A12,
 * REL-A1, REL-A2).
 *
 * These drive `ApiTransport.request()` -- the parent-internal path -- with
 * a fake `fetchImpl`. A Tauri runtime is not required, which is exactly why
 * `createParentApiTransport` keeps `fetchImpl` injectable rather than
 * hard-wiring the plugin's `fetch`.
 */

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError } from "../services/api/errors";
import { ApiTransport } from "../services/api/transport";
import {
  bearerHeader,
  createParentApiTransport,
  CSRF_HEADER,
} from "../services/api/tauri-http-transport";

const BASE = "http://localhost:3000";
const schema = z.object({ ok: z.boolean() });

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/**
 * A fake `fetch` with an explicit signature, so `mock.calls` is typed as
 * `[string, RequestInit | undefined]` rather than `[]`.
 */
function fakeFetch(
  impl: (url: string, init?: RequestInit) => Promise<Response> = async () =>
    jsonResponse({ ok: true }),
) {
  return vi.fn(impl);
}

function transportWith(
  fetchImpl: typeof fetch,
  sleep = vi.fn(async () => {}),
): ApiTransport {
  return createParentApiTransport({
    baseUrl: BASE,
    fetchImpl,
    sleep,
  });
}

describe("parent transport — request shape", () => {
  it("validates the whole body, with no envelope to unwrap (REQ-A12)", async () => {
    // The parent-internal API has nine top-level shapes; a bare domain
    // object is one of them. `{success, data}` must NOT be assumed.
    const fetchImpl = fakeFetch();
    const result = await transportWith(fetchImpl as never).request({
      method: "GET",
      path: "/api/subscription/status",
      schema,
    });
    expect(result).toEqual({ ok: true });
  });

  it("sends the method, path, and Accept header", async () => {
    const fetchImpl = fakeFetch();
    await transportWith(fetchImpl as never).request({
      method: "GET",
      path: "/api/subscription/status",
      schema,
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${BASE}/api/subscription/status`);
    expect(init!.method).toBe("GET");
    expect((init!.headers as Record<string, string>).Accept).toBe(
      "application/json",
    );
  });

  it("serialises a JSON body and sets Content-Type only when there is one", async () => {
    const fetchImpl = fakeFetch();
    const t = transportWith(fetchImpl as never);

    await t.request({
      method: "POST",
      path: "/api/auth/login",
      schema,
      body: { email: "a@b.co", password: "x" },
    });
    const withBody = fetchImpl.mock.calls[0][1]!;
    expect(withBody.body).toBe('{"email":"a@b.co","password":"x"}');
    expect((withBody.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );

    await t.request({ method: "GET", path: "/api/auth/me", schema });
    const withoutBody = fetchImpl.mock.calls[1][1]!;
    expect(withoutBody.body).toBeUndefined();
    expect(
      (withoutBody.headers as Record<string, string>)["Content-Type"],
    ).toBeUndefined();
  });

  it("passes caller headers through, including Authorization and CSRF", async () => {
    const fetchImpl = fakeFetch();
    await transportWith(fetchImpl as never).request({
      method: "POST",
      path: "/api/auth/logout",
      schema,
      headers: { ...bearerHeader("tok"), [CSRF_HEADER]: "csrf" },
    });
    const headers = fetchImpl.mock.calls[0][1]!.headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBe("Bearer tok");
    expect(headers[CSRF_HEADER]).toBe("csrf");
  });

  it("appends defined query parameters and drops undefined ones", async () => {
    const fetchImpl = fakeFetch();
    await transportWith(fetchImpl as never).request({
      method: "GET",
      path: "/api/v1/notifications",
      schema,
      query: { limit: 20, offset: undefined },
    });
    const [url] = fetchImpl.mock.calls[0];
    expect(url).toContain("limit=20");
    expect(url).not.toContain("offset");
  });
});

describe("parent transport — failure handling", () => {
  it("parses a bare {error} 401, without requiring success:false", async () => {
    // The route-handler form. Requiring `success: false` would reject it.
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: "Unauthorized" }, 401),
    );
    await expect(
      transportWith(fetchImpl as never).request({
        method: "GET",
        path: "/api/subscription/status",
        schema,
      }),
    ).rejects.toMatchObject({ kind: "unauthorized", message: "Unauthorized" });
  });

  it("parses the middleware {error, message} 401 too", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { error: "Unauthorized", message: "Authentication required" },
        401,
      ),
    );
    await expect(
      transportWith(fetchImpl as never).request({
        method: "GET",
        path: "/api/subscription/status",
        schema,
      }),
    ).rejects.toMatchObject({ kind: "unauthorized" });
  });

  it("distinguishes 403 from 401", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { error: "Forbidden", message: "Admin access required" },
        403,
      ),
    );
    await expect(
      transportWith(fetchImpl as never).request({
        method: "GET",
        path: "/api/admin/thing",
        schema,
      }),
    ).rejects.toMatchObject({ kind: "forbidden" });
  });

  it("treats a 2xx body that fails validation as malformed, not a crash (REL-A1)", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ nope: 1 }));
    const error = await transportWith(fetchImpl as never)
      .request({ method: "GET", path: "/api/auth/me", schema })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe("malformed");
  });

  it("does not leak the offending body into the error message (REQ-8)", async () => {
    const secret = "R1,234,567.89-pricing-detail";
    const fetchImpl = vi.fn(async () => jsonResponse({ leaked: secret }));
    const error = (await transportWith(fetchImpl as never)
      .request({ method: "GET", path: "/api/auth/me", schema })
      .catch((e: unknown) => e)) as ApiError;
    expect(error.message).not.toContain(secret);
    expect(JSON.stringify(error.toLogFields())).not.toContain(secret);
  });

  it("falls back safely when a non-2xx body is not JSON at all", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("<html>502 Bad Gateway</html>", {
          status: 502,
          headers: { "Content-Type": "text/html" },
        }),
    );
    const error = (await transportWith(fetchImpl as never)
      .request({ method: "GET", path: "/api/auth/me", schema })
      .catch((e: unknown) => e)) as ApiError;
    expect(error.kind).toBe("server");
    expect(error.message).not.toContain("html");
  });
});

describe("parent transport — retry policy", () => {
  it("never auto-retries a 429, and surfaces Retry-After (REQ-A6)", async () => {
    // The parent's limiter is IP-keyed, 10 per 15 minutes, and is
    // deliberately not reset on success. Retrying spends the user's own
    // budget and can lock out an office NAT.
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { error: "Too many login attempts. Please try again later." },
        429,
        {
          "Retry-After": "742",
        },
      ),
    );
    const error = (await transportWith(fetchImpl as never)
      .request({ method: "POST", path: "/api/auth/login", schema })
      .catch((e: unknown) => e)) as ApiError;

    expect(error.kind).toBe("rate-limited");
    expect(error.retryAfterSeconds).toBe(742);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("never retries a mutation, because no endpoint supports an idempotency key", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "boom" }, 500));
    await expect(
      transportWith(fetchImpl as never).request({
        method: "POST",
        path: "/api/auth/login",
        schema,
      }),
    ).rejects.toMatchObject({ kind: "server" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries a safe GET on 5xx within the bound, then gives up", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "boom" }, 500));
    const sleep = vi.fn(async () => {});
    await expect(
      transportWith(fetchImpl as never, sleep).request({
        method: "GET",
        path: "/api/subscription/status",
        schema,
      }),
    ).rejects.toMatchObject({ kind: "server" });
    // maxRetries 2 -> 3 attempts total.
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 4xx GET", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: "Document not found" }, 404),
    );
    await expect(
      transportWith(fetchImpl as never).request({
        method: "GET",
        path: "/api/v1/documents/x/download-url",
        schema,
      }),
    ).rejects.toMatchObject({ kind: "not-found" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("honours an explicit retry:never override on a GET", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "boom" }, 500));
    await expect(
      transportWith(fetchImpl as never).request({
        method: "GET",
        path: "/api/subscription/status",
        schema,
        policy: { retry: "never" },
      }),
    ).rejects.toMatchObject({ kind: "server" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("parent transport — timeout, cancellation, offline", () => {
  it("reports a network failure as offline", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(
      transportWith(fetchImpl as never).request({
        method: "GET",
        path: "/api/auth/me",
        schema,
      }),
    ).rejects.toMatchObject({ kind: "offline" });
  });

  it("reports a timeout distinctly from a cancellation (REL-A2)", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );
    await expect(
      transportWith(fetchImpl as never).request({
        method: "GET",
        path: "/api/auth/me",
        schema,
        policy: { timeoutMs: 1 },
      }),
    ).rejects.toMatchObject({ kind: "timeout" });
  });

  it("reports caller cancellation as cancelled and never retries it", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
          controller.abort();
        }),
    );
    await expect(
      transportWith(fetchImpl as never).request({
        method: "GET",
        path: "/api/auth/me",
        schema,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ kind: "cancelled" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects immediately on an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = fakeFetch();
    await expect(
      transportWith(fetchImpl as never).request({
        method: "GET",
        path: "/api/auth/me",
        schema,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ kind: "cancelled" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("createParentApiTransport", () => {
  it("returns an ApiTransport, reusing the Phase 0 policy layer (REQ-A2)", () => {
    expect(
      createParentApiTransport({
        baseUrl: BASE,
        fetchImpl: vi.fn() as never,
      }),
    ).toBeInstanceOf(ApiTransport);
  });
});
