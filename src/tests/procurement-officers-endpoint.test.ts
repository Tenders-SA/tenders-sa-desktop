/**
 * Procurement Officer Directory endpoint tests (TASK-1.1).
 *
 * Refs: REQ-A12, INT-A2, INT-A3, PERF-3
 *
 * Pins the parent contracts locked in TASK-1.1 against fixture payloads:
 * masked search summaries, masked detail, paginated tenders, the sync feed
 * (unmasked values + suppressed tombstones) and the correction mutation.
 */

import { describe, expect, it, vi } from "vitest";
import { ProcurementOfficersEndpoint } from "../services/api/endpoints/procurement-officers";
import { ApiTransport } from "../services/api/transport";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeEndpoint(respond: () => Promise<Response>, token = "tok") {
  const fetchImpl = vi.fn(respond);
  const endpoint = new ProcurementOfficersEndpoint({
    transport: new ApiTransport({
      baseUrl: "http://localhost:3000",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
    }),
    getToken: async () => token,
  });
  return { endpoint, fetchImpl };
}

/** A fully-shaped sync row with UNMASKED official values. */
const syncRow = {
  id: "o1",
  canonicalName: "thabo mokoena",
  firstName: "Thabo",
  lastName: "Mokoena",
  currentTitle: "Supply Chain Manager",
  currentOrganisationId: "org-1",
  province: "Gauteng",
  kind: "officer",
  status: "verified",
  confidenceScore: 0.85,
  firstSeenAt: "2024-01-15T00:00:00.000Z",
  lastSeenAt: "2025-06-01T00:00:00.000Z",
  verifiedAt: "2025-06-01T00:00:00.000Z",
  suppressed: false,
  updatedAt: "2025-06-01T00:00:00.000Z",
  contactPoints: [
    {
      id: "cp1",
      type: "email",
      value: "thabo.mokoena@dwa.gov.za",
      isRoleBased: false,
      isOfficial: true,
      verificationStatus: "verified",
    },
    {
      id: "cp2",
      type: "telephone",
      value: "0123456789",
      isRoleBased: false,
      isOfficial: true,
      verificationStatus: "verified",
    },
  ],
  assignments: [
    {
      id: "a1",
      organisationId: "org-1",
      organisationName: "Department of Water Affairs",
      title: "Supply Chain Manager",
      validFrom: "2020-03-01T00:00:00.000Z",
      validTo: null,
      isCurrent: true,
      confidenceScore: 0.85,
    },
  ],
};

/** A tombstone: identity + flag only, disputed facts never exported. */
const tombstoneRow = {
  id: "o2",
  canonicalName: "nomsa dlamini",
  firstName: "Nomsa",
  lastName: "Dlamini",
  currentTitle: null,
  currentOrganisationId: null,
  province: null,
  kind: "officer",
  status: "unverified",
  confidenceScore: null,
  firstSeenAt: null,
  lastSeenAt: null,
  verifiedAt: null,
  suppressed: true,
  updatedAt: "2025-06-02T00:00:00.000Z",
  contactPoints: [],
  assignments: [],
};

const syncBody = {
  success: true,
  data: {
    rows: [syncRow, tombstoneRow],
    nextCursor: "cursor-2",
    hasMore: true,
  },
  meta: { page: 1, limit: 200, total: 2, since: "2025-01-01T00:00:00.000Z" },
};

const searchRow = {
  id: "o1",
  canonicalName: "thabo mokoena",
  firstName: "Thabo",
  lastName: "Mokoena",
  currentTitle: "Supply Chain Manager",
  currentOrganisationId: "org-1",
  organisationName: "Department of Water Affairs",
  province: "Gauteng",
  kind: "officer",
  status: "verified",
  confidenceScore: 0.85,
  tendersCount: 7,
  contactSummary: {
    email: "th***@dwa.gov.za",
    telephone: "012****89",
  },
};

describe("procurement officer search", () => {
  it("parses the masked summary row and flattens pagination meta", async () => {
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse({
        success: true,
        data: [searchRow],
        meta: { page: 1, limit: 20, total: 1 },
      }),
    );
    const result = await endpoint.search();
    expect(result.officers).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.officers[0].contactSummary.email).toBe("th***@dwa.gov.za");
    expect(result.officers[0].contactSummary.telephone).toBe("012****89");
  });

  it("sends the parent query parameters and explicit bounds (PERF-3)", async () => {
    const { endpoint, fetchImpl } = makeEndpoint(async () =>
      jsonResponse({
        success: true,
        data: [],
        meta: { page: 2, limit: 20, total: 0 },
      }),
    );
    await endpoint.search({
      q: "mokoena",
      province: "gauteng",
      organisation: "dwa",
      role: "officer",
      verification: "verified",
      page: 2,
      limit: 20,
    });
    const [url] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("q=mokoena");
    expect(url).toContain("province=gauteng");
    expect(url).toContain("organisation=dwa");
    expect(url).toContain("role=officer");
    expect(url).toContain("verification=verified");
    expect(url).toContain("page=2");
    expect(url).toContain("limit=20");
  });

  it("omits empty filters rather than sending blank parameters", async () => {
    const { endpoint, fetchImpl } = makeEndpoint(async () =>
      jsonResponse({
        success: true,
        data: [],
        meta: { page: 1, limit: 20, total: 0 },
      }),
    );
    await endpoint.search({ q: "", province: undefined });
    const [url] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("q=");
    expect(url).not.toContain("province=");
  });
});

describe("procurement officer detail", () => {
  it("parses masked detail with assignments and evidence summary (no meta)", async () => {
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse({
        success: true,
        data: {
          ...searchRow,
          organisationAddress: "185 Schoeman St, Pretoria",
          firstSeenAt: "2024-01-15T00:00:00.000Z",
          lastSeenAt: "2025-06-01T00:00:00.000Z",
          verifiedAt: "2025-06-01T00:00:00.000Z",
          contactPoints: [
            {
              id: "cp1",
              type: "email",
              value: "th***@dwa.gov.za",
              isRoleBased: false,
              isOfficial: true,
              verificationStatus: "verified",
            },
          ],
          assignments: [
            {
              id: "a1",
              organisationId: "org-1",
              organisationName: "Department of Water Affairs",
              title: "Supply Chain Manager",
              validFrom: "2020-03-01T00:00:00.000Z",
              validTo: null,
              isCurrent: true,
              confidenceScore: 0.85,
            },
          ],
          evidenceSummary: {
            sourceMethods: ["ocds"],
            sourceFieldCount: 3,
            observedRange: {
              earliest: "2024-01-15T00:00:00.000Z",
              latest: "2025-06-01T00:00:00.000Z",
            },
          },
        },
      }),
    );
    const detail = await endpoint.get("o1");
    expect(detail.id).toBe("o1");
    expect(detail.contactPoints[0].value).toBe("th***@dwa.gov.za");
    expect(detail.assignments[0].isCurrent).toBe(true);
    expect(detail.evidenceSummary.sourceFieldCount).toBe(3);
  });
});

describe("procurement officer tenders", () => {
  it("parses paginated related tenders", async () => {
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse({
        success: true,
        data: [
          {
            id: "t1",
            tenderId: "tender-1",
            title: "Supply of office furniture",
            referenceNumber: "RFQ-2026-001",
            province: "Gauteng",
            closingDate: "2026-08-15T00:00:00.000Z",
            sourceUrl: null,
          },
        ],
        meta: { page: 1, limit: 20, total: 1 },
      }),
    );
    const result = await endpoint.getTenders("o1");
    expect(result.tenders).toHaveLength(1);
    expect(result.tenders[0].tenderId).toBe("tender-1");
    expect(result.total).toBe(1);
  });
});

describe("procurement officer sync feed", () => {
  it("parses unmasked rows and preserves tombstones with empty arrays", async () => {
    const { endpoint } = makeEndpoint(async () => jsonResponse(syncBody));
    const result = await endpoint.sync();
    expect(result.rows).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor-2");
    expect(result.hasMore).toBe(true);
    expect(result.meta.since).toBe("2025-01-01T00:00:00.000Z");

    const officer = result.rows[0];
    expect(officer.contactPoints[0].value).toBe("thabo.mokoena@dwa.gov.za");
    expect(officer.contactPoints[1].value).toBe("0123456789");

    const tombstone = result.rows[1];
    expect(tombstone.suppressed).toBe(true);
    expect(tombstone.contactPoints).toEqual([]);
    expect(tombstone.assignments).toEqual([]);
  });

  it("sends cursor and explicit page bounds (PERF-3)", async () => {
    const { endpoint, fetchImpl } = makeEndpoint(async () =>
      jsonResponse(syncBody),
    );
    await endpoint.sync({ cursor: "cursor-2", limit: 200 });
    const [url] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("cursor=cursor-2");
    expect(url).toContain("limit=200");
  });
});

describe("procurement officer corrections", () => {
  it("posts field + reason and parses the pending correction", async () => {
    const { endpoint, fetchImpl } = makeEndpoint(async () =>
      jsonResponse({
        success: true,
        data: { id: "corr-1", status: "pending" },
      }),
    );
    const result = await endpoint.submitCorrection("o1", {
      field: "email",
      reason: "email bounces",
    });
    expect(result).toEqual({ id: "corr-1", status: "pending" });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      field: "email",
      reason: "email bounces",
    });
    expect(init.headers).toMatchObject({ Authorization: "Bearer tok" });
  });
});
