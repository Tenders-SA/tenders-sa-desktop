/**
 * Policy-layer tests for `ApiTransport.download()` (Slice 6:
 * desktop-workspace-export-response-package).
 *
 * WHAT THIS FILE TESTS: the binary-download path only — bytes passthrough,
 * `Content-Disposition` filename parsing + fallback + sanitising, JSON error
 * mapping on non-2xx (the parent answers errors in JSON even on binary
 * routes), timeout/cancellation, the session-loss choke point, and the
 * never-retry default for the POST.
 *
 * WHAT IT DOES NOT TEST: `request()`/`get()` (api-transport.test.ts) and the
 * endpoint-level contract (module-endpoints.test.ts).
 */

import { describe, expect, it, vi } from "vitest";
import {
  ApiTransport,
  ALLOWED_DOCUMENT_ORIGINS,
  type DownloadOptions,
} from "../services/api/transport";
import { ApiError } from "../services/api/errors";

function makeTransport(
  fetchImpl: typeof fetch,
  overrides: Partial<ConstructorParameters<typeof ApiTransport>[0]> = {},
) {
  return new ApiTransport({
    baseUrl: "http://localhost:3000",
    fetchImpl,
    // Deterministic: no real backoff waiting in tests.
    sleep: () => Promise.resolve(),
    ...overrides,
  });
}

function binaryResponse(
  bytes: number[],
  headers: Record<string, string> = {},
  status = 200,
): Response {
  return new Response(new Uint8Array(bytes), {
    status,
    headers: {
      "Content-Type": "application/pdf",
      ...headers,
    },
  });
}

function downloadOptions(
  overrides: Partial<DownloadOptions> = {},
): DownloadOptions {
  return {
    method: "POST",
    path: "/api/v1/applications/a1/assist/workspace-export",
    query: { format: "pdf" },
    filenameFallback: "proposal-a1.pdf",
    ...overrides,
  };
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

describe("ApiTransport.download", () => {
  it("passes binary bytes through with the disposition filename", async () => {
    const fetchImpl = vi.fn(async () =>
      binaryResponse([37, 80, 68, 70], {
        "Content-Disposition": 'attachment; filename="proposal-RFQ-001.pdf"',
      }),
    ) as unknown as typeof fetch;

    const result = await makeTransport(fetchImpl).download(downloadOptions());

    expect(result.bytes).toEqual(new Uint8Array([37, 80, 68, 70]));
    expect(result.filename).toBe("proposal-RFQ-001.pdf");
    expect(result.contentType).toBe("application/pdf");
  });

  it("accepts a bare (unquoted) disposition filename", async () => {
    const fetchImpl = vi.fn(async () =>
      binaryResponse([1, 2, 3], {
        "Content-Disposition": "attachment; filename=proposal-X.docx",
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ) as unknown as typeof fetch;

    const result = await makeTransport(fetchImpl).download(downloadOptions());

    expect(result.filename).toBe("proposal-X.docx");
    expect(result.contentType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("falls back to the caller filename when no disposition header is sent", async () => {
    const fetchImpl = vi.fn(async () =>
      binaryResponse([1, 2, 3]),
    ) as unknown as typeof fetch;

    const result = await makeTransport(fetchImpl).download(
      downloadOptions({ filenameFallback: "proposal-a1.pdf" }),
    );

    expect(result.filename).toBe("proposal-a1.pdf");
  });

  it("sanitises a disposition filename that could escape a directory", async () => {
    const fetchImpl = vi.fn(async () =>
      binaryResponse([1, 2, 3], {
        "Content-Disposition": 'attachment; filename="../../evil.pdf"',
      }),
    ) as unknown as typeof fetch;

    const result = await makeTransport(fetchImpl).download(downloadOptions());

    expect(result.filename).not.toContain("/");
    expect(result.filename).toBe(".._.._evil.pdf");
  });

  it("falls back to download.bin when no name survives sanitising", async () => {
    const fetchImpl = vi.fn(async () =>
      binaryResponse([1, 2, 3], {
        "Content-Disposition": 'attachment; filename="//"',
      }),
    ) as unknown as typeof fetch;

    const result = await makeTransport(fetchImpl).download(downloadOptions());

    expect(result.filename).toBe("download.bin");
  });

  it("sends method, query and headers on the request", async () => {
    const fetchImpl = vi.fn(async () => binaryResponse([1]));

    await makeTransport(fetchImpl as unknown as typeof fetch).download(
      downloadOptions({ headers: { Authorization: "Bearer tok" } }),
    );

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/api/v1/applications/a1/assist/workspace-export");
    expect(url).toContain("format=pdf");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer tok",
    );
  });

  it("maps JSON error bodies exactly like request() — 409 → validation", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: "Generate your proposal documents before exporting.",
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          },
        ),
    ) as unknown as typeof fetch;

    const error = await expectApiError(
      makeTransport(fetchImpl).download(downloadOptions()),
    );

    expect(error.kind).toBe("validation");
  });

  it("maps 401/403/404/500 to their kinds", async () => {
    const cases: [number, string][] = [
      [401, "unauthorized"],
      [403, "forbidden"],
      [404, "not-found"],
      [500, "server"],
    ];
    for (const [status, kind] of cases) {
      const fetchImpl = vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "oops" }), {
            status,
            headers: { "Content-Type": "application/json" },
          }),
      ) as unknown as typeof fetch;
      const error = await expectApiError(
        makeTransport(fetchImpl).download(downloadOptions()),
      );
      expect(error.kind).toBe(kind);
    }
  });

  it("fires the session-loss hook on a 401", async () => {
    const onUnauthorized = vi.fn();
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
    ) as unknown as typeof fetch;

    await expectApiError(
      makeTransport(fetchImpl, { onUnauthorized }).download(downloadOptions()),
    );

    expect(onUnauthorized).toHaveBeenCalledWith(
      "/api/v1/applications/a1/assist/workspace-export",
    );
  });

  it("reports a timeout as a timeout error", async () => {
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((_, reject) =>
          setTimeout(
            () => reject(new DOMException("aborted", "AbortError")),
            50,
          ),
        ),
    ) as unknown as typeof fetch;

    const error = await expectApiError(
      makeTransport(fetchImpl, { defaultPolicy: { timeoutMs: 5 } }).download(
        downloadOptions(),
      ),
    );

    expect(error.kind).toBe("timeout");
  });

  it("reports a caller abort as cancelled", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    }) as unknown as typeof fetch;

    const error = await expectApiError(
      makeTransport(fetchImpl).download(
        downloadOptions({ signal: controller.signal }),
      ),
    );

    expect(error.kind).toBe("cancelled");
  });

  it("never retries the download POST on a transient failure", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    await expectApiError(makeTransport(fetchImpl).download(downloadOptions()));

    expect(calls).toBe(1);
  });
});

describe("ApiTransport.download — absolute document URLs (Slice 7)", () => {
  const DOCS_URL = "https://docs.tenders-sa.org/docs/t1/Advert.pdf";
  const WORKER_URL =
    "https://etenders-api.tenders-sa.org/api/document?id=155529/file.pdf";

  function urlOptions(
    overrides: Partial<DownloadOptions> = {},
  ): DownloadOptions {
    return {
      method: "GET",
      url: DOCS_URL,
      filenameFallback: "document-t1.pdf",
      ...overrides,
    };
  }

  it("fetches the absolute URL verbatim, GET, keyless", async () => {
    const fetchImpl = vi.fn(async () =>
      binaryResponse([37, 80, 68, 70], {
        "Content-Disposition": 'attachment; filename="Advert.pdf"',
      }),
    ) as unknown as typeof fetch & { mock: ReturnType<typeof vi.fn>["mock"] };

    const result = await makeTransport(fetchImpl).download(urlOptions());

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(DOCS_URL);
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
    expect(result.filename).toBe("Advert.pdf");
  });

  it("accepts the worker document origin", async () => {
    const fetchImpl = vi.fn(async () =>
      binaryResponse([1, 2, 3]),
    ) as unknown as typeof fetch & { mock: ReturnType<typeof vi.fn>["mock"] };

    const result = await makeTransport(fetchImpl).download(
      urlOptions({ url: WORKER_URL }),
    );

    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(url).toBe(WORKER_URL);
    expect(result.bytes).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("rejects a non-https document URL before any fetch", async () => {
    const fetchImpl = vi.fn(async () =>
      binaryResponse([1]),
    ) as unknown as typeof fetch;

    const error = await expectApiError(
      makeTransport(fetchImpl).download(
        urlOptions({ url: "http://docs.tenders-sa.org/docs/t1/x.pdf" }),
      ),
    );

    expect(error.kind).toBe("malformed");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a foreign-origin URL before any fetch", async () => {
    const fetchImpl = vi.fn(async () =>
      binaryResponse([1]),
    ) as unknown as typeof fetch;

    const error = await expectApiError(
      makeTransport(fetchImpl).download(
        urlOptions({ url: "https://evil.example.com/tender.pdf" }),
      ),
    );

    expect(error.kind).toBe("malformed");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects an unparsable URL", async () => {
    const fetchImpl = vi.fn(async () =>
      binaryResponse([1]),
    ) as unknown as typeof fetch;

    const error = await expectApiError(
      makeTransport(fetchImpl).download(urlOptions({ url: "not a url" })),
    );

    expect(error.kind).toBe("malformed");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("honours the per-request timeout override on external fetches", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    ) as unknown as typeof fetch;

    const error = await expectApiError(
      makeTransport(fetchImpl).download(
        urlOptions({ policy: { timeoutMs: 5, retry: "never" } }),
      ),
    );

    expect(error.kind).toBe("timeout");
  });

  it("never retries an external fetch on a transient failure", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    await expectApiError(makeTransport(fetchImpl).download(urlOptions()));

    expect(calls).toBe(1);
  });

  it("does not fire session loss on an external 401", async () => {
    const onUnauthorized = vi.fn();
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "denied" }), { status: 401 }),
    ) as unknown as typeof fetch;

    const error = await expectApiError(
      makeTransport(fetchImpl, { onUnauthorized }).download(urlOptions()),
    );

    expect(error.kind).toBe("unauthorized");
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("still fires session loss on an API-path download 401", async () => {
    const onUnauthorized = vi.fn();
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "denied" }), { status: 401 }),
    ) as unknown as typeof fetch;

    await expectApiError(
      makeTransport(fetchImpl, { onUnauthorized }).download(downloadOptions()),
    );

    expect(onUnauthorized).toHaveBeenCalledWith(
      "/api/v1/applications/a1/assist/workspace-export",
    );
  });

  it("exposes the exact origins the capability allow-list must grant", () => {
    expect(ALLOWED_DOCUMENT_ORIGINS).toEqual([
      "https://docs.tenders-sa.org",
      "https://etenders-api.tenders-sa.org",
    ]);
  });
});
