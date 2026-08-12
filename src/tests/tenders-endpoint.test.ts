/**
 * Tender discovery endpoint tests.
 *
 * Refs: REQ-A12, INT-A2, INT-A3, PERF-3
 *
 * The list and detail routes disagree in two ways the audit recorded as
 * gap E-11, and these tests pin both so a future refactor cannot
 * accidentally unify them.
 */

import { describe, expect, it, vi } from "vitest";
import {
  daysUntilClosing,
  TendersEndpoint,
} from "../services/api/endpoints/tenders";
import { ApiTransport } from "../services/api/transport";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const tender = {
  id: "t1",
  tender_id: "EXT-1",
  title: "Supply of office furniture",
  referenceNumber: "RFQ-2026-001",
  sourceOrganization: "Department of Public Works",
  description: "Desks and chairs",
  province: "Gauteng",
  closingDate: "2026-08-15T00:00:00.000Z",
  estimatedValue: 1_250_000,
  type: "Request for Quotation",
  publicationType: "TENDER_NOTICE",
  industryCategories: ["Furniture"],
  documentCount: 3,
};

/** The list route wraps; note the `debug` block we deliberately ignore. */
const listBody = {
  tenders: [tender],
  pagination: { page: 1, limit: 20, total: 1, pages: 1 },
  debug: { totalInDb: 9999, activeTenders: 42, cached: false },
};

function makeEndpoint(respond: () => Promise<Response>, token = "tok") {
  const fetchImpl = vi.fn(respond);
  const endpoint = new TendersEndpoint({
    transport: new ApiTransport({
      baseUrl: "http://localhost:3000",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
    }),
    getToken: async () => token,
  });
  return { endpoint, fetchImpl };
}

describe("tender list", () => {
  it("parses the wrapped list response and flattens pagination", async () => {
    const { endpoint } = makeEndpoint(async () => jsonResponse(listBody));
    const result = await endpoint.list();
    expect(result.tenders).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it("ignores the debug block of corpus statistics (gap E-5)", async () => {
    const { endpoint } = makeEndpoint(async () => jsonResponse(listBody));
    const result = await endpoint.list();
    // Parent pipeline state the desktop has no business rendering.
    expect(JSON.stringify(result)).not.toContain("totalInDb");
    expect(JSON.stringify(result)).not.toContain("activeTenders");
  });

  it("always sends an explicit limit, so a default cannot go unbounded (PERF-3)", async () => {
    const { endpoint, fetchImpl } = makeEndpoint(async () =>
      jsonResponse(listBody),
    );
    await endpoint.list();
    const [url] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("limit=20");
    expect(url).toContain("page=1");
  });

  it("uses page/limit, never the Developer API's cursor convention", async () => {
    const { endpoint, fetchImpl } = makeEndpoint(async () =>
      jsonResponse(listBody),
    );
    await endpoint.list({ page: 3 });
    const [url] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("page=3");
    expect(url).not.toContain("cursor");
  });

  it("sends `search`, which is the parameter the route reads — not `q`", async () => {
    // The stale parent OpenAPI fragment documented `q`. Route code wins.
    const { endpoint, fetchImpl } = makeEndpoint(async () =>
      jsonResponse(listBody),
    );
    await endpoint.list({ search: "furniture" });
    const [url] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("search=furniture");
    expect(url).not.toMatch(/[?&]q=/);
  });

  it("omits empty filters rather than sending blank parameters", async () => {
    const { endpoint, fetchImpl } = makeEndpoint(async () =>
      jsonResponse(listBody),
    );
    await endpoint.list({ search: "", province: undefined });
    const [url] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("search=");
    expect(url).not.toContain("province=");
  });

  it("attaches the Bearer token, which is what makes the gated route succeed", async () => {
    const { endpoint, fetchImpl } = makeEndpoint(async () =>
      jsonResponse(listBody),
    );
    await endpoint.list();
    const [, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer tok",
    );
  });

  it("tolerates raw Json-ish fields, which this route does not parse (E-11)", async () => {
    // The list returns these unparsed while detail parses them. Assuming a
    // shape here would fail against real data.
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse({
        ...listBody,
        tenders: [
          {
            ...tender,
            requirements: "raw,comma,string",
            eligibilityCriteria: null,
            bbbeeRequirements: { level: 1 },
          },
        ],
      }),
    );
    await expect(endpoint.list()).resolves.toBeDefined();
  });

  it("surfaces a 401 rather than an empty list", async () => {
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse({ error: "Unauthorized" }, 401),
    );
    await expect(endpoint.list()).rejects.toMatchObject({
      kind: "unauthorized",
    });
  });
});

describe("tender detail", () => {
  it("parses the BARE object the detail route returns, with no wrapper (E-11)", async () => {
    // A tenth top-level shape. Expecting `{tenders}` or `{success,data}`
    // here would fail on every call. The parent detail projection also omits
    // list-only `tender_id`; requiring it caused every live detail read to be
    // reported as malformed.
    const { tender_id: listOnlyId, ...liveDetail } = tender;
    expect(listOnlyId).toBe("EXT-1");
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse({
        ...liveDetail,
        status: "ACTIVE",
        documentStats: { total: 3, processed: 3, pending: 0, failed: 0 },
      }),
    );
    const result = await endpoint.get("t1");
    expect(result.title).toBe(tender.title);
    expect(result.documentStats?.total).toBe(3);
  });

  it("accepts parsed Json fields on detail, where list returns them raw", async () => {
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse({
        ...tender,
        requirements: ["a", "b"],
        eligibilityCriteria: { minLevel: 2 },
      }),
    );
    await expect(endpoint.get("t1")).resolves.toBeDefined();
  });

  it("projects complete stored analysis without weakening the core tender contract", async () => {
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse({
        ...tender,
        analysisAccess: {
          state: "partial",
          analysedDocuments: 1,
          totalDocuments: 2,
        },
        aiSummary: "A concise bidder briefing",
        documents: [
          {
            id: "d1",
            fileName: "spec.pdf",
            analyses: [
              {
                id: "a1",
                complianceRequirements: "Tax compliant",
                analysisSections: [
                  {
                    sectionType: "health_safety",
                    content: "Submit a safety plan",
                  },
                ],
                confidenceScore: 0.91,
              },
            ],
          },
        ],
      }),
    );
    const result = await endpoint.get("t1");
    expect(result.analysisAccess?.state).toBe("partial");
    expect(
      result.documents?.[0]?.analyses?.[0]?.analysisSections?.[0]?.sectionType,
    ).toBe("health_safety");
  });

  it("encodes the id into the path", async () => {
    const { endpoint, fetchImpl } = makeEndpoint(async () =>
      jsonResponse(tender),
    );
    await endpoint.get("a/b c");
    const [url] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/tenders/a%2Fb%20c");
  });

  it("surfaces a 404 distinctly", async () => {
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse({ error: "Tender not found" }, 404),
    );
    await expect(endpoint.get("missing")).rejects.toMatchObject({
      kind: "not-found",
    });
  });
});

describe("daysUntilClosing", () => {
  const now = new Date("2026-07-29T12:00:00.000Z");

  it("counts whole days ahead", () => {
    expect(daysUntilClosing("2026-08-05T12:00:00.000Z", now)).toBe(7);
  });

  it("returns 0 on the closing day", () => {
    expect(daysUntilClosing("2026-07-29T23:00:00.000Z", now)).toBe(1);
    expect(daysUntilClosing("2026-07-29T12:00:00.000Z", now)).toBe(0);
  });

  it("goes negative once closed", () => {
    expect(daysUntilClosing("2026-07-20T12:00:00.000Z", now)).toBeLessThan(0);
  });

  it("returns null for an unusable date rather than a misleading number", () => {
    // Deadlines drive bid/no-bid decisions. A garbage date must render as
    // "unknown", never as a number someone might act on.
    expect(daysUntilClosing("not-a-date", now)).toBeNull();
    expect(daysUntilClosing("", now)).toBeNull();
  });
});
