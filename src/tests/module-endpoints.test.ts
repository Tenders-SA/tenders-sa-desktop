/**
 * Contract tests for the module endpoint clients.
 *
 * Refs: INT-A3, REQ-A12, PERF-3
 *
 * Every shape below was read from parent route source at `8ff2e4c2`, and each
 * test pins something a wrong guess would break silently rather than loudly:
 * the two different pagination shapes, the routes that answer 200 while
 * meaning "not authenticated", the toggle that must never be retried, and the
 * envelopes that differ per route.
 */

import { describe, expect, it, vi } from "vitest";
import { ApiTransport } from "../services/api/transport";
import {
  DashboardEndpoint,
  normaliseActionItems,
} from "../services/api/endpoints/dashboard";
import { RecommendationsEndpoint } from "../services/api/endpoints/recommendations";
import { SavedTendersEndpoint } from "../services/api/endpoints/saved-tenders";
import { ApplicationsEndpoint } from "../services/api/endpoints/applications";
import { CompanyEndpoint } from "../services/api/endpoints/company";
import { DocumentsEndpoint } from "../services/api/endpoints/documents";
import { NotificationsEndpoint } from "../services/api/endpoints/notifications";
import { PlannerEndpoint } from "../services/api/endpoints/planner";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Builds an endpoint over a fake network, capturing the request.
 *
 * `token` uses a `null` sentinel for "no session" rather than `undefined`,
 * because passing `undefined` explicitly re-triggers a default parameter — so
 * the no-token case would silently still send a token and the test would pass
 * for the wrong reason.
 */
function harness<T>(
  Endpoint: new (options: {
    transport: ApiTransport;
    getToken: () => Promise<string | undefined>;
  }) => T,
  respond: () => Response,
  token: string | null = "tok",
) {
  const fetchImpl = vi.fn(async () => respond());
  const endpoint = new Endpoint({
    transport: new ApiTransport({
      baseUrl: "http://localhost:3000",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
    }),
    getToken: async () => token ?? undefined,
  });
  return { endpoint, fetchImpl };
}

function lastCall(fetchImpl: ReturnType<typeof vi.fn>) {
  const calls = fetchImpl.mock.calls;
  return calls[calls.length - 1] as unknown as [string, RequestInit];
}

describe("dashboard endpoint", () => {
  const summaryBody = {
    success: true,
    data: {
      upcomingDeadlines: {
        count: 2,
        soonest: "2026-08-01T00:00:00.000Z",
        applications: [
          {
            id: "a1",
            title: "Roadworks",
            closingDate: "2026-08-01T00:00:00.000Z",
          },
        ],
      },
      documentAlerts: { count: 3 },
      pipelineValue: { total: 18_400_000, applicationCount: 5 },
    },
  };

  it("unwraps the successResponse envelope this route uses", async () => {
    // `/api/tenders` returns a bare domain key; these dashboard routes wrap in
    // {success, data}. Assuming one envelope for both would fail on one.
    const { endpoint } = harness(DashboardEndpoint, () =>
      jsonResponse(summaryBody),
    );
    const summary = await endpoint.getSummary();
    expect(summary.pipelineValue.total).toBe(18_400_000);
    expect(summary.upcomingDeadlines.count).toBe(2);
  });

  it("tolerates an application with no closing date", async () => {
    // The parent explicitly returns null here when the tender has none.
    const { endpoint } = harness(DashboardEndpoint, () =>
      jsonResponse({
        ...summaryBody,
        data: {
          ...summaryBody.data,
          upcomingDeadlines: {
            count: 1,
            soonest: null,
            applications: [{ id: "a1", title: "No date", closingDate: null }],
          },
        },
      }),
    );
    await expect(endpoint.getSummary()).resolves.toBeDefined();
  });

  it("sends an explicit activity limit (PERF-3)", async () => {
    const { endpoint, fetchImpl } = harness(DashboardEndpoint, () =>
      jsonResponse({ success: true, data: { activities: [] } }),
    );
    await endpoint.getActivity();
    expect(lastCall(fetchImpl)[0]).toContain("limit=10");
  });

  it("attaches the Bearer token", async () => {
    const { endpoint, fetchImpl } = harness(DashboardEndpoint, () =>
      jsonResponse(summaryBody),
    );
    await endpoint.getSummary();
    const headers = lastCall(fetchImpl)[1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
  });

  it("sends no Authorization header at all when there is no token", async () => {
    // The route then 401s, the session-loss hook fires, and the screen says
    // "sign in" -- which is the correct outcome. Sending `Bearer undefined`
    // would be a different and more confusing failure.
    const { endpoint, fetchImpl } = harness(
      DashboardEndpoint,
      () => jsonResponse(summaryBody),
      null,
    );
    await endpoint.getSummary();
    const headers = lastCall(fetchImpl)[1].headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("action-centre normalisation", () => {
  it("reads items from the root array", () => {
    expect(
      normaliseActionItems([{ title: "Sign the JV agreement", count: 1 }]),
    ).toEqual([
      {
        id: "action-0",
        title: "Sign the JV agreement",
        count: 1,
        detail: undefined,
        severity: undefined,
      },
    ]);
  });

  it("finds items under any of the keys the service might use", () => {
    for (const key of ["items", "actions", "actionItems", "results", "cards"]) {
      const result = normaliseActionItems({
        [key]: [{ title: "Do the thing" }],
      });
      expect(result, key).toHaveLength(1);
    }
  });

  it("returns nothing for a shape it does not recognise", () => {
    // Deliberate: an empty list renders as "nothing is waiting on you", which
    // is far safer than inventing rows out of an unknown payload.
    expect(normaliseActionItems({ unexpected: true })).toEqual([]);
    expect(normaliseActionItems(null)).toEqual([]);
    expect(normaliseActionItems("nope")).toEqual([]);
  });

  it("skips entries with no readable title rather than rendering a blank row", () => {
    expect(
      normaliseActionItems([{ count: 3 }, { title: "Real" }]),
    ).toHaveLength(1);
  });
});

describe("recommendations endpoint (Tender Radar)", () => {
  const recommendation = {
    id: "r1",
    tenderId: "t1",
    tender: {
      id: "t1",
      title: "Bridge repairs",
      referenceNumber: "RFQ-1",
      description: null,
      closingDate: "2026-09-01T00:00:00.000Z",
      estimatedValue: 500_000,
      province: "Gauteng",
      sourceOrganization: "SANRAL",
      status: "ACTIVE",
    },
    score: 82,
    baseScore: 78,
    reasoning: "Strong industry and province match",
    factors: {
      industry: { score: 20, maxScore: 25 },
      province: { score: 10, maxScore: 10 },
    },
    improvementAreas: ["CIDB grade 6 required"],
    calculatedAt: "2026-07-29T00:00:00.000Z",
    matchCategory: "highly_qualified",
  };

  it("parses a scored recommendation with its factor breakdown", async () => {
    const { endpoint } = harness(RecommendationsEndpoint, () =>
      jsonResponse({
        success: true,
        state: "ready",
        recommendations: [recommendation],
        pagination: { limit: 20, offset: 0, hasMore: false },
      }),
    );
    const result = await endpoint.list();
    expect(result.state).toBe("ready");
    expect(result.recommendations[0].score).toBe(82);
    expect(result.recommendations[0].factors?.province?.score).toBe(10);
  });

  it("surfaces `no_company_profile` as its own state, not as an empty list", async () => {
    // The distinction the whole screen turns on: matching had nothing to
    // compare against, so the fix is a profile rather than a wider search.
    const { endpoint } = harness(RecommendationsEndpoint, () =>
      jsonResponse({
        success: true,
        state: "no_company_profile",
        recommendations: [],
      }),
    );
    const result = await endpoint.list();
    expect(result.state).toBe("no_company_profile");
  });

  it("sends minScore, limit and offset explicitly", async () => {
    const { endpoint, fetchImpl } = harness(RecommendationsEndpoint, () =>
      jsonResponse({ success: true, state: "empty", recommendations: [] }),
    );
    await endpoint.list({ minScore: 80, offset: 40 });
    const url = lastCall(fetchImpl)[0];
    expect(url).toContain("minScore=80");
    expect(url).toContain("offset=40");
    expect(url).toContain("limit=20");
  });

  it("comma-joins province and category filters, which is how the route parses them", async () => {
    const { endpoint, fetchImpl } = harness(RecommendationsEndpoint, () =>
      jsonResponse({ success: true, state: "empty", recommendations: [] }),
    );
    await endpoint.list({ provinces: ["Gauteng", "Limpopo"] });
    expect(decodeURIComponent(lastCall(fetchImpl)[0])).toContain(
      "provinces=Gauteng,Limpopo",
    );
  });

  it("omits filters entirely when none are chosen", async () => {
    const { endpoint, fetchImpl } = harness(RecommendationsEndpoint, () =>
      jsonResponse({ success: true, state: "empty", recommendations: [] }),
    );
    await endpoint.list({ provinces: [] });
    expect(lastCall(fetchImpl)[0]).not.toContain("provinces=");
  });

  it("reads the explanation whether it is wrapped or bare", async () => {
    const explanation = {
      score: 82,
      baseScore: 78,
      aiAdjustment: 4,
      breakdown: [
        {
          factor: "industry",
          points: 20,
          maxPoints: 25,
          description: "Close match",
          passed: true,
        },
      ],
      gaps: ["CIDB 6"],
      actionItems: ["Apply for CIDB 6"],
      estimatedTimeToQualify: "3 months",
    };
    for (const body of [
      explanation,
      { success: true, data: explanation },
      { success: true, explanation },
    ]) {
      const { endpoint } = harness(RecommendationsEndpoint, () =>
        jsonResponse(body),
      );
      await expect(endpoint.explain("t1")).resolves.toMatchObject({
        score: 82,
      });
    }
  });
});

describe("saved tenders endpoint (Opportunities)", () => {
  const savedBody = {
    tenders: [
      {
        savedAt: "2026-07-01T00:00:00.000Z",
        id: "t1",
        title: "Cleaning services",
        referenceNumber: "RFQ-2",
        closingDate: "2026-09-01T00:00:00.000Z",
        status: "ACTIVE",
        province: "Western Cape",
        organization: "City of Cape Town",
        categories: ["Cleaning"],
      },
    ],
    pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
    stats: { closed: 4 },
  };

  it("reads `totalPages`, which is this route's field name", async () => {
    // `/api/tenders` calls the same idea `pages`. Two helpers, two names --
    // reading the wrong one yields undefined and breaks pagination silently.
    const { endpoint } = harness(SavedTendersEndpoint, () =>
      jsonResponse(savedBody),
    );
    const result = await endpoint.list();
    expect(result.totalPages).toBe(1);
    expect(result.closedCount).toBe(4);
  });

  it("filters server-side when asked for open tenders only", async () => {
    const { endpoint, fetchImpl } = harness(SavedTendersEndpoint, () =>
      jsonResponse(savedBody),
    );
    await endpoint.list({ activeOnly: true, futureOnly: true });
    const url = lastCall(fetchImpl)[0];
    expect(url).toContain("activeOnly=true");
    expect(url).toContain("futureOnly=true");
  });

  it("omits the filters rather than sending false", async () => {
    const { endpoint, fetchImpl } = harness(SavedTendersEndpoint, () =>
      jsonResponse(savedBody),
    );
    await endpoint.list({ activeOnly: false });
    expect(lastCall(fetchImpl)[0]).not.toContain("activeOnly");
  });

  it("returns the server's new saved state, since save is a toggle", async () => {
    const { endpoint } = harness(SavedTendersEndpoint, () =>
      jsonResponse({ saved: true }),
    );
    await expect(endpoint.toggleSave("t1")).resolves.toBe(true);
  });

  it("never retries the toggle, because a replay would silently unsave", async () => {
    // The route deletes an existing row rather than setting a flag, so a
    // second delivery is not idempotent -- it undoes the user's action.
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      throw new TypeError("Failed to fetch");
    });
    const endpoint = new SavedTendersEndpoint({
      transport: new ApiTransport({
        baseUrl: "http://localhost:3000",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async () => {},
      }),
      getToken: async () => "tok",
    });
    await expect(endpoint.toggleSave("t1")).rejects.toBeDefined();
    expect(calls).toBe(1);
  });
});

describe("applications endpoint", () => {
  const application = {
    id: "a1",
    tenderId: "t1",
    status: "DRAFT",
    submittedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
    notes: null,
    isArchived: false,
    tender: {
      id: "t1",
      title: "Security services",
      referenceNumber: "RFQ-3",
      sourceOrganization: "Dept of Health",
      closingDate: "2026-09-01T00:00:00.000Z",
      estimatedValue: 900_000,
      province: "Gauteng",
      industryCategories: ["Security"],
    },
  };

  it("reads the offset-style pagination this route uses", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse({
        applications: [application],
        pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
      }),
    );
    const result = await endpoint.list();
    expect(result.total).toBe(1);
    expect(result.hasMore).toBe(false);
  });

  it("reports a missing company profile as a validation problem, not a crash", async () => {
    // The parent answers 400 "Company profile required" here, which is a real
    // state for a new account rather than a fault.
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse({ error: "Company profile required" }, 400),
    );
    await expect(endpoint.list()).rejects.toMatchObject({ kind: "validation" });
  });

  it("unwraps the `{application}` detail envelope", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse({
        application: {
          ...application,
          tender: { ...application.tender, requirements: ["Tax clearance"] },
          company: { id: "c1", name: "Acme", bbbeeLevel: 2 },
        },
      }),
    );
    const detail = await endpoint.get("a1");
    expect(detail.company?.name).toBe("Acme");
    expect(detail.tender.requirements).toEqual(["Tax clearance"]);
  });

  it("is not ready when anything is blocking, whatever the flag says", async () => {
    // A server that reported `valid: true` alongside errors must not be read
    // as submittable. The blocker list wins.
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse({ valid: true, errors: ["Missing tax clearance"] }),
    );
    const readiness = await endpoint.validate("a1");
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers).toEqual(["Missing tax clearance"]);
  });

  it("defaults to not-ready when no readiness flag is present at all", async () => {
    // Absent must never mean submittable.
    const { endpoint } = harness(ApplicationsEndpoint, () => jsonResponse({}));
    await expect(endpoint.validate("a1")).resolves.toMatchObject({
      ready: false,
    });
  });

  it("is ready only when the flag is true and nothing blocks", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse({ valid: true, errors: [], warnings: ["Check pricing"] }),
    );
    const readiness = await endpoint.validate("a1");
    expect(readiness.ready).toBe(true);
    expect(readiness.warnings).toEqual(["Check pricing"]);
  });

  it("reads problem messages out of objects as well as strings", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse({
        ready: false,
        errors: [{ message: "Missing B-BBEE certificate" }],
        missing: [{ requirement: "Company registration" }],
      }),
    );
    const readiness = await endpoint.validate("a1");
    expect(readiness.blockers).toEqual([
      "Missing B-BBEE certificate",
      "Company registration",
    ]);
  });
});

describe("company endpoint", () => {
  it("treats a 404 as 'no profile yet' rather than an error", async () => {
    // The normal state for a new account, and the reason Tender Radar is
    // empty. Throwing would send the user hunting for a fault.
    const { endpoint } = harness(CompanyEndpoint, () =>
      jsonResponse({ error: "Company not found" }, 404),
    );
    await expect(endpoint.getProfile()).resolves.toBeUndefined();
  });

  it("still reports a real failure", async () => {
    const { endpoint } = harness(CompanyEndpoint, () =>
      jsonResponse({ error: "boom" }, 500),
    );
    await expect(endpoint.getProfile()).rejects.toMatchObject({
      kind: "server",
    });
  });

  it("parses the JSON-column list fields the route pre-parses", async () => {
    const { endpoint } = harness(CompanyEndpoint, () =>
      jsonResponse({
        id: "c1",
        name: "Acme Construction",
        industryCodes: ["4100", "4210"],
        provincesOperating: ["Gauteng"],
        certifications: [],
      }),
    );
    const profile = await endpoint.getProfile();
    expect(profile?.industryCodes).toEqual(["4100", "4210"]);
    expect(profile?.certifications).toEqual([]);
  });

  it("copes with a JSON column that did not parse into an array", async () => {
    // These are `String` columns in Prisma. A row written by an older path can
    // still yield a bare string, and the screen must not blank out over it.
    const { endpoint } = harness(CompanyEndpoint, () =>
      jsonResponse({
        id: "c1",
        name: "Acme",
        industryCodes: "4100",
        provincesOperating: null,
      }),
    );
    const profile = await endpoint.getProfile();
    expect(profile?.industryCodes).toEqual(["4100"]);
    expect(profile?.provincesOperating).toEqual([]);
  });

  it("reads collections whether wrapped or bare", async () => {
    for (const body of [
      [{ id: "e1", projectName: "Depot" }],
      { experiences: [{ id: "e1", projectName: "Depot" }] },
      { success: true, data: [{ id: "e1", projectName: "Depot" }] },
    ]) {
      const { endpoint } = harness(CompanyEndpoint, () => jsonResponse(body));
      await expect(endpoint.getExperiences()).resolves.toHaveLength(1);
    }
  });
});

describe("documents endpoint", () => {
  const documentsBody = {
    documents: [
      {
        id: "d1",
        documentType: "TAX_CLEARANCE",
        fileUrl: "/api/v1/documents/d1",
        expiryDate: "2026-08-15T00:00:00.000Z",
        verified: true,
        uploadedAt: "2026-01-01T00:00:00.000Z",
        expiryStatus: "expiring",
        daysUntilExpiry: 17,
      },
    ],
    pagination: { total: 1, page: 1, limit: 25, totalPages: 1 },
  };

  it("keeps the server-computed expiry rather than deriving it", async () => {
    // A client clock that is wrong by a day would tell someone a certificate
    // is valid when the buyer will reject it.
    const { endpoint } = harness(DocumentsEndpoint, () =>
      jsonResponse(documentsBody),
    );
    const result = await endpoint.list();
    expect(result.documents[0].expiryStatus).toBe("expiring");
    expect(result.documents[0].daysUntilExpiry).toBe(17);
  });

  it("asks the list route to skip stats, which have their own route", async () => {
    const { endpoint, fetchImpl } = harness(DocumentsEndpoint, () =>
      jsonResponse(documentsBody),
    );
    await endpoint.list();
    expect(lastCall(fetchImpl)[0]).toContain("includeStats=false");
  });

  it("requires R2 on the download URL (INT-4)", async () => {
    const { endpoint, fetchImpl } = harness(DocumentsEndpoint, () =>
      jsonResponse({ url: "https://r2.example/doc" }),
    );
    await expect(endpoint.getDownloadUrl("d1")).resolves.toBe(
      "https://r2.example/doc",
    );
    expect(lastCall(fetchImpl)[0]).toContain("requireR2=1");
  });
});

describe("notifications endpoint", () => {
  const body = {
    notifications: [
      {
        id: "n1",
        type: "TENDER_CLOSING_SOON",
        title: null,
        message: "Closes in 2 days",
        read: false,
        createdAt: "2026-07-28T00:00:00.000Z",
      },
    ],
    pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
    unreadCount: 1,
  };

  it("parses the list and its unread count", async () => {
    const { endpoint } = harness(NotificationsEndpoint, () =>
      jsonResponse(body),
    );
    const result = await endpoint.list();
    expect(result.unreadCount).toBe(1);
    expect(result.notifications[0].read).toBe(false);
  });

  it("marks read on the UNVERSIONED path, which is where that route lives", async () => {
    // The list is /api/v1/notifications but the mutation is
    // /api/notifications/[id]/read. Following the v1 pattern here would 404.
    const { endpoint, fetchImpl } = harness(NotificationsEndpoint, () =>
      jsonResponse({ success: true }),
    );
    await endpoint.markRead("n1");
    expect(lastCall(fetchImpl)[0]).toContain("/api/notifications/n1/read");
    expect(lastCall(fetchImpl)[0]).not.toContain("/api/v1/notifications/n1");
  });

  it("marks all read on its unversioned path too", async () => {
    const { endpoint, fetchImpl } = harness(NotificationsEndpoint, () =>
      jsonResponse({ success: true }),
    );
    await endpoint.markAllRead();
    expect(lastCall(fetchImpl)[0]).toContain(
      "/api/notifications/mark-all-read",
    );
  });
});

describe("planner endpoint (Calendar)", () => {
  it("treats a 200 with `authenticated: false` as a session problem", async () => {
    // This route does NOT 401. An empty array with a falsy flag is
    // indistinguishable from "no events" unless the flag is read, and
    // rendering "nothing scheduled" at a signed-out user hides the real
    // problem.
    const { endpoint } = harness(PlannerEndpoint, () =>
      jsonResponse({ events: [], authenticated: false }),
    );
    await expect(endpoint.listEvents()).rejects.toMatchObject({
      kind: "unauthorized",
    });
  });

  it("returns an empty list when authenticated and genuinely empty", async () => {
    const { endpoint } = harness(PlannerEndpoint, () =>
      jsonResponse({ events: [] }),
    );
    await expect(endpoint.listEvents()).resolves.toEqual([]);
  });

  it("parses events and keeps their provenance flag", async () => {
    const { endpoint } = harness(PlannerEndpoint, () =>
      jsonResponse({
        events: [
          {
            id: "e1",
            title: "Site visit",
            description: null,
            eventDate: "2026-08-05T09:00:00.000Z",
            eventType: "SITE_VISIT",
            isCompleted: false,
            isAutoGenerated: true,
            source: "tender",
          },
        ],
      }),
    );
    const events = await endpoint.listEvents();
    expect(events[0].isAutoGenerated).toBe(true);
  });

  it("scopes to one tender when asked", async () => {
    const { endpoint, fetchImpl } = harness(PlannerEndpoint, () =>
      jsonResponse({ events: [] }),
    );
    await endpoint.listEvents("t1");
    expect(lastCall(fetchImpl)[0]).toContain("tenderId=t1");
  });
});
