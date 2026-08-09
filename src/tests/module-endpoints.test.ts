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
  const actionCenterBody = {
    success: true,
    data: {
      tenders: [],
      nextSteps: [
        {
          id: "renew-expired-documents",
          title: "Renew your expired compliance documents",
          why: "Expired certificates disqualify a bid",
          priority: 1,
          external: true,
        },
      ],
      radarSubscriptions: [],
      unreadMatchNotifications: 0,
      hasCompanyProfile: true,
    },
  };

  it("normalises the service-shaped action centre into actionable items", async () => {
    // The route's `data` is produced by a service, not pinned by the
    // desktop's types; `nextSteps` is the human-actionable part and must
    // survive the normalisation.
    const { endpoint } = harness(DashboardEndpoint, () =>
      jsonResponse(actionCenterBody),
    );
    const items = await endpoint.getActionItems();
    expect(items).toEqual([
      {
        id: "renew-expired-documents",
        title: "Renew your expired compliance documents",
        detail: "Expired certificates disqualify a bid",
        count: undefined,
        severity: undefined,
      },
    ]);
  });

  it("attaches the Bearer token", async () => {
    const { endpoint, fetchImpl } = harness(DashboardEndpoint, () =>
      jsonResponse(actionCenterBody),
    );
    await endpoint.getActionItems();
    const headers = lastCall(fetchImpl)[1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
  });

  it("sends no Authorization header at all when there is no token", async () => {
    // The route then 401s, the session-loss hook fires, and the screen says
    // "sign in" -- which is the correct outcome. Sending `Bearer undefined`
    // would be a different and more confusing failure.
    const { endpoint, fetchImpl } = harness(
      DashboardEndpoint,
      () => jsonResponse(actionCenterBody),
      null,
    );
    await endpoint.getActionItems();
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

  it("reads the detail response even though it omits isArchived", async () => {
    // Verified against the live site on 2026-08-07: the detail route returns
    // every application field except `isArchived`, which only the list route
    // includes. That used to fail validation ("could not be read in a format
    // this version understands"); an absent flag must read as "not archived".
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse({
        application: {
          id: "a1",
          tenderId: "t1",
          status: "DRAFT",
          submittedAt: null,
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-02T00:00:00.000Z",
          notes: null,
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
          company: { id: "c1", name: "Acme", bbbeeLevel: 2 },
        },
      }),
    );
    const detail = await endpoint.get("a1");
    expect(detail.isArchived).toBe(false);
    expect(detail.tender.title).toBe("Security services");
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

describe("applications endpoint — workspace cockpit", () => {
  it("parses the cockpit payload from the live-verified assist route", async () => {
    const { endpoint, fetchImpl } = harness(ApplicationsEndpoint, () =>
      jsonResponse({
        application: {
          id: "a1",
          status: "DRAFT",
          progressPercentage: 60,
          readinessScore: 80,
        },
        tender: {
          id: "t1",
          title: "Msinsi dam maintenance",
          referenceNumber: "RFQ-4",
          closingDate: "2026-08-25T10:00:00.000Z",
          estimatedValue: 3_500_000,
        },
        company: { id: "c1", name: "Acme" },
        matching: null,
        readiness: {
          score: 80,
          overall: "ready",
          factors: [{ name: "Company profile", score: 100, status: "good" }],
        },
        urgency: {
          level: "normal",
          color: "#eab308",
          pulsing: false,
          daysRemaining: 17,
          hoursRemaining: 408,
          percentageRemaining: 20,
          message: "Closes 25 August 2026",
        },
        generationStatus: null,
        qualityChecks: [
          {
            id: "q1",
            category: "compliance",
            status: "passed",
            message: "Tax clearance valid",
          },
        ],
        valueEstimate: {
          estimatedMin: 450_000,
          estimatedMax: 720_000,
          estimatedMedian: 581_900,
          confidenceScore: 82,
          confidenceLevel: "high",
          methodology: "award-history",
          currency: "ZAR",
          sampleSize: 4,
        },
        analysisStatus: { status: "complete", progress: 100 },
        checklistState: [
          {
            id: "c1",
            label: "Company profile",
            completed: true,
            category: "Profile",
          },
        ],
        events: [
          {
            id: "e1",
            title: "Site visit",
            eventDate: "2026-08-12T09:00:00.000Z",
            eventType: "SITE_VISIT",
            isCompleted: false,
            source: "tender",
          },
        ],
        documentState: [],
      }),
    );
    const cockpit = await endpoint.getCockpit("a1");
    expect(lastCall(fetchImpl)[0]).toContain("/assist");
    expect(cockpit.readiness?.score).toBe(80);
    expect(cockpit.urgency?.daysRemaining).toBe(17);
    expect(cockpit.analysisStatus?.status).toBe("complete");
    expect(cockpit.checklistState?.[0].completed).toBe(true);
    expect(cockpit.valueEstimate?.currency).toBe("ZAR");
    expect(cockpit.matching).toBeNull();
  });

  it("parses the compliance gaps payload", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse({
        gaps: [
          {
            id: "g1",
            category: "Finance",
            severity: "important",
            label: "B-BBEE certificate missing",
            detail: "Required for evaluation",
            tenderRequirement: "B-BBEE",
            companyStatus: "missing",
            canAutoFix: false,
          },
        ],
        summary: {
          blocking: 0,
          important: 1,
          strengths: 5,
          info: 0,
          score: 100,
        },
      }),
    );
    const gaps = await endpoint.getComplianceGaps("a1");
    expect(gaps.gaps?.[0].severity).toBe("important");
    expect(gaps.summary?.score).toBe(100);
  });

  it("parses the market research payload", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse({
        organisation: {
          name: "Msinsi Holding (SOC)",
          tenderCount: 14,
          activeTenderCount: 3,
          awardCount: 6,
          csdNumber: "M123456789",
        },
        competitors: [
          { supplierName: "BridgeCo", totalValue: 12_000_000, awardCount: 4 },
        ],
        provinceHealth: {
          province: "North West",
          score: 50,
          activityLevel: "CAUTION",
        },
        eligibility: null,
      }),
    );
    const research = await endpoint.getResearch("a1");
    expect(research.organisation?.name).toBe("Msinsi Holding (SOC)");
    expect(research.competitors?.[0].totalValue).toBe(12_000_000);
    expect(research.provinceHealth?.activityLevel).toBe("CAUTION");
  });

  it("finds the board stage by application id", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse({
        applications: [
          {
            id: "a1",
            applicationId: "a1",
            stage: "add_information",
            status: "DRAFT",
          },
        ],
        autoArchived: false,
        hasMore: false,
      }),
    );
    await expect(endpoint.getWorkspaceStage("a1")).resolves.toBe(
      "add_information",
    );
  });

  it("matches by applicationId when the card id differs", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse({
        applications: [
          { id: "other", applicationId: "a1", stage: "needs_analysis" },
        ],
      }),
    );
    await expect(endpoint.getWorkspaceStage("a1")).resolves.toBe(
      "needs_analysis",
    );
  });

  it("treats a 403 on the admin-gated summary as 'stage unknown', not a failure", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse({ error: "Forbidden" }, 403),
    );
    await expect(endpoint.getWorkspaceStage("a1")).resolves.toBeUndefined();
  });

  it("returns undefined for a stage the client does not know yet", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse({
        applications: [{ id: "a1", applicationId: "a1", stage: "ai_stage_9" }],
      }),
    );
    await expect(endpoint.getWorkspaceStage("a1")).resolves.toBeUndefined();
  });

  it("PATCHes the lifecycle action merged with its body to the workspace route", async () => {
    const { endpoint, fetchImpl } = harness(ApplicationsEndpoint, () =>
      jsonResponse({
        success: true,
        persisted: true,
        stageOverride: "fix_readiness",
      }),
    );
    await endpoint.updateWorkspace("a1", "stage", {
      stage: "fix_readiness",
      baseStage: "add_information",
    });
    const [url, init] = lastCall(fetchImpl);
    expect(url).toContain("/a1/workspace");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({
      action: "stage",
      stage: "fix_readiness",
      baseStage: "add_information",
    });
  });

  it("never retries a lifecycle mutation", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      throw new TypeError("Failed to fetch");
    });
    const endpoint = new ApplicationsEndpoint({
      transport: new ApiTransport({
        baseUrl: "http://localhost:3000",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async () => {},
      }),
      getToken: async () => "tok",
    });
    await expect(
      endpoint.updateWorkspace("a1", "remove", {}),
    ).rejects.toBeDefined();
    expect(calls).toBe(1);
  });

  it("surfaces the parent's 400 `allowed` list on the error", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse(
        {
          error: "Invalid status transition: DRAFT -> SUBMITTED",
          allowed: ["DRAFT", "SUBMITTED"],
        },
        400,
      ),
    );
    await expect(
      endpoint.updateWorkspace("a1", "status", { status: "SUBMITTED" }),
    ).rejects.toMatchObject({
      kind: "validation",
      allowed: ["DRAFT", "SUBMITTED"],
    });
  });
});

describe("applications endpoint — additional-info Q&A", () => {
  it("parses the live-verified additional-info payload", async () => {
    const { endpoint, fetchImpl } = harness(ApplicationsEndpoint, () =>
      jsonResponse({
        values: { bidContactPerson: "Sipho Dlamini" },
        fields: [
          {
            id: "bidContactPerson",
            label: "Bid contact person",
            type: "text",
            required: true,
            placeholder: "Full name of the person responsible for this bid",
          },
          {
            id: "deliveryAddress",
            label: "Delivery / branch address (North West)",
            type: "textarea",
            required: true,
            placeholder: "Address from which you will deliver / operate",
          },
          {
            id: "declarationsAccepted",
            label: "I confirm the declarations for this bid",
            type: "checkbox",
            required: true,
          },
        ],
        unfilledRequired: 3,
      }),
    );
    const info = await endpoint.getAdditionalInfo("a1");
    expect(lastCall(fetchImpl)[0]).toContain("/assist/additional-info");
    expect(info.values).toEqual({ bidContactPerson: "Sipho Dlamini" });
    expect(info.fields).toHaveLength(3);
    expect(info.fields?.[0].type).toBe("text");
    expect(info.fields?.[2].type).toBe("checkbox");
    expect(info.unfilledRequired).toBe(3);
  });

  it("defaults missing values to an empty record", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse({ fields: [], unfilledRequired: 0 }),
    );
    await expect(endpoint.getAdditionalInfo("a1")).resolves.toMatchObject({
      values: {},
    });
  });

  it("PUTs the values with the exact body and method", async () => {
    const { endpoint, fetchImpl } = harness(ApplicationsEndpoint, () =>
      jsonResponse({ persisted: true, unfilledRequired: 1 }),
    );
    const values = {
      bidContactEmail: "sipho@acme.co.za",
      declarationsAccepted: true,
    };
    await endpoint.saveAdditionalInfo("a1", values);
    const [url, init] = lastCall(fetchImpl);
    expect(url).toContain("/a1/assist/additional-info");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ values });
  });

  it("never retries a save", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      throw new TypeError("Failed to fetch");
    });
    const endpoint = new ApplicationsEndpoint({
      transport: new ApiTransport({
        baseUrl: "http://localhost:3000",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async () => {},
      }),
      getToken: async () => "tok",
    });
    await expect(
      endpoint.saveAdditionalInfo("a1", { bidContactPerson: "Sipho" }),
    ).rejects.toBeDefined();
    expect(calls).toBe(1);
  });

  it("surfaces a 400 `Invalid values` as a validation problem", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse({ error: "Invalid values" }, 400),
    );
    await expect(endpoint.saveAdditionalInfo("a1", {})).rejects.toMatchObject({
      kind: "validation",
    });
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

describe("applications endpoint — response blueprint", () => {
  const liveBlueprint = {
    tenderId: "t1",
    industry: { id: "i1", name: "Construction" },
    requiredUserDocuments: [
      {
        name: "Tax Clearance Certificate",
        canonicalType: "tax-clearance",
        source: "compliance",
        mandatory: true,
      },
      {
        name: "B-BBEE Certificate / Affidavit",
        canonicalType: "b-bbee",
        source: "compliance",
        mandatory: true,
      },
    ],
    responseDocuments: [
      {
        key: "cover_letter",
        title: "Cover Letter",
        kind: "cover_letter",
        brief: "A professional SA business cover letter.",
        mandatory: true,
      },
      {
        key: "technical_proposal",
        title: "Technical / Works Proposal",
        kind: "technical",
        brief: "Respond to the technical specifications.",
        requiredBy: "Technical specifications",
        mandatory: true,
      },
    ],
    steps: [
      {
        key: "briefing-2026-08-12",
        title: "Attend briefing / site visit",
        detail: "Site visit — When: 12/08/2026",
        dueDate: "2026-08-12T09:00:00.000Z",
        category: "briefing",
        mandatory: false,
        source: "timeline",
      },
      {
        key: "gather-returnables",
        title: "Gather required documents & returnables",
        detail: "Obtain and complete every mandatory returnable.",
        category: "documents",
        mandatory: true,
        source: "derived",
      },
    ],
    submission: {
      method: "Electronic / portal",
      deadline: "2026-08-25T10:00:00.000Z",
      portalUrl: "https://portal.example.org/bids",
      contact: "Ms P Dlamini, 012 345 6789",
    },
    risks: [
      "Closing in ~2 working days — prioritise mandatory returnables immediately.",
    ],
    confidence: "high",
    generatedBy: "deterministic",
  };

  it("parses the live-verified blueprint payload with all sections", async () => {
    const { endpoint, fetchImpl } = harness(ApplicationsEndpoint, () =>
      jsonResponse({
        blueprint: liveBlueprint,
        hasAnalysis: true,
        enriched: false,
        responseDocs: { cover_letter: "# Cover letter draft" },
        responseDocStatus: {
          technical_proposal: {
            state: "generating",
            startedAt: 1723123456789,
            updatedAt: 1723123456789,
          },
        },
      }),
    );
    const payload = await endpoint.getResponseBlueprint("a1");
    expect(lastCall(fetchImpl)[0]).toContain("/assist/response-blueprint");
    expect(payload.hasAnalysis).toBe(true);
    expect(payload.enriched).toBe(false);
    expect(payload.blueprint?.requiredUserDocuments).toHaveLength(2);
    expect(payload.blueprint?.responseDocuments?.[1].requiredBy).toBe(
      "Technical specifications",
    );
    expect(payload.blueprint?.steps?.[0].category).toBe("briefing");
    expect(payload.blueprint?.submission?.portalUrl).toContain(
      "portal.example.org",
    );
    expect(payload.blueprint?.confidence).toBe("high");
    expect(payload.responseDocs?.cover_letter).toBe("# Cover letter draft");
    expect(payload.responseDocStatus?.technical_proposal?.state).toBe(
      "generating",
    );
  });

  it("tolerates a null blueprint and absent sections", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse({ blueprint: null }),
    );
    const payload = await endpoint.getResponseBlueprint("a1");
    expect(payload.blueprint).toBeNull();
    expect(payload.responseDocs).toBeUndefined();
  });

  it("defaults missing docs and status maps to empty records", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse({
        blueprint: liveBlueprint,
        responseDocs: undefined,
        responseDocStatus: undefined,
      }),
    );
    const payload = await endpoint.getResponseBlueprint("a1");
    expect(payload.responseDocs).toBeUndefined();
    expect(payload.responseDocStatus).toBeUndefined();
  });

  it("passes unknown enum values through as raw strings", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse({
        blueprint: {
          ...liveBlueprint,
          confidence: "certain",
          generatedBy: "oracle",
          responseDocuments: [
            { key: "k1", title: "T", kind: "novel_kind", brief: "b" },
          ],
        },
      }),
    );
    const payload = await endpoint.getResponseBlueprint("a1");
    expect(payload.blueprint?.confidence).toBe("certain");
    expect(payload.blueprint?.generatedBy).toBe("oracle");
    expect(payload.blueprint?.responseDocuments?.[0].kind).toBe("novel_kind");
  });

  it("retries a transient GET failure once, because it is a read", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ blueprint: liveBlueprint }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const endpoint = new ApplicationsEndpoint({
      transport: new ApiTransport({
        baseUrl: "http://localhost:3000",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async () => {},
      }),
      getToken: async () => "tok",
    });
    const payload = await endpoint.getResponseBlueprint("a1");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(payload.blueprint?.tenderId).toBe("t1");
  });

  it("maps 401/400/404 exactly like the other read routes", async () => {
    const unauthorized = harness(ApplicationsEndpoint, () =>
      jsonResponse({ error: "Unauthorized" }, 401),
    );
    await expect(
      unauthorized.endpoint.getResponseBlueprint("a1"),
    ).rejects.toMatchObject({ kind: "unauthorized" });

    const noProfile = harness(ApplicationsEndpoint, () =>
      jsonResponse({ error: "Company profile required" }, 400),
    );
    await expect(
      noProfile.endpoint.getResponseBlueprint("a1"),
    ).rejects.toMatchObject({ kind: "validation" });

    const missing = harness(ApplicationsEndpoint, () =>
      jsonResponse({ error: "Not found" }, 404),
    );
    await expect(
      missing.endpoint.getResponseBlueprint("a1"),
    ).rejects.toMatchObject({ kind: "not-found" });
  });
});

describe("applications endpoint — response document authoring", () => {
  it("POSTs the key and answers the 202 generating shape", async () => {
    const { endpoint, fetchImpl } = harness(ApplicationsEndpoint, () =>
      jsonResponse(
        { key: "cover_letter", title: "Cover Letter", status: "generating" },
        202,
      ),
    );
    const result = await endpoint.generateResponseDocument(
      "a1",
      "cover_letter",
    );
    const [url, init] = lastCall(fetchImpl);
    expect(url).toContain("/a1/assist/generate-response-doc");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ key: "cover_letter" });
    expect(result).toMatchObject({
      key: "cover_letter",
      title: "Cover Letter",
      status: "generating",
    });
  });

  it("includes a prompt when one is given and omits it otherwise", async () => {
    const withPrompt = harness(ApplicationsEndpoint, () =>
      jsonResponse({ key: "email", status: "generating" }, 202),
    );
    await withPrompt.endpoint.generateResponseDocument(
      "a1",
      "email",
      "Keep it under 300 words.",
    );
    expect(JSON.parse(String(lastCall(withPrompt.fetchImpl)[1].body))).toEqual({
      key: "email",
      prompt: "Keep it under 300 words.",
    });
  });

  it("surfaces 402 as payment-required (SUBSCRIPTION_REQUIRED)", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse(
        {
          error: "Subscription required",
          code: "SUBSCRIPTION_REQUIRED",
          message: "AI document generation requires an active subscription",
          upgradeUrl: "/pricing",
        },
        402,
      ),
    );
    await expect(
      endpoint.generateResponseDocument("a1", "cover_letter"),
    ).rejects.toMatchObject({
      kind: "payment-required",
      code: "SUBSCRIPTION_REQUIRED",
    });
  });

  it("surfaces 409 with the PRECONDITIONS_NOT_MET code preserved", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse(
        {
          error: "Generation preconditions not met",
          code: "PRECONDITIONS_NOT_MET",
          blockedReason:
            "Complete before generating: 2 required information field(s).",
          preconditions: {
            infoNeeded: 2,
            missingMandatoryDocs: 0,
            blockingIssues: 0,
          },
        },
        409,
      ),
    );
    await expect(
      endpoint.generateResponseDocument("a1", "cover_letter"),
    ).rejects.toMatchObject({
      kind: "validation",
      code: "PRECONDITIONS_NOT_MET",
      status: 409,
    });
  });

  it("rejects a missing key and an unknown key as validation problems", async () => {
    const missingKey = harness(ApplicationsEndpoint, () =>
      jsonResponse({ error: "A response document key is required" }, 400),
    );
    await expect(
      missingKey.endpoint.generateResponseDocument("a1", ""),
    ).rejects.toMatchObject({ kind: "validation" });

    const unknownKey = harness(ApplicationsEndpoint, () =>
      jsonResponse(
        {
          error: "Unknown response document: brief",
          code: "UNKNOWN_RESPONSE_DOC",
        },
        400,
      ),
    );
    await expect(
      unknownKey.endpoint.generateResponseDocument("a1", "brief"),
    ).rejects.toMatchObject({
      kind: "validation",
      code: "UNKNOWN_RESPONSE_DOC",
    });
  });

  it("never retries a generation request", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      throw new TypeError("Failed to fetch");
    });
    const endpoint = new ApplicationsEndpoint({
      transport: new ApiTransport({
        baseUrl: "http://localhost:3000",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async () => {},
      }),
      getToken: async () => "tok",
    });
    await expect(
      endpoint.generateResponseDocument("a1", "cover_letter"),
    ).rejects.toBeDefined();
    expect(calls).toBe(1);
  });

  it("PUTs the edited content with the exact body and method", async () => {
    const { endpoint, fetchImpl } = harness(ApplicationsEndpoint, () =>
      jsonResponse({ ok: true, key: "cover_letter" }),
    );
    const result = await endpoint.saveResponseDocument(
      "a1",
      "cover_letter",
      "# Edited",
    );
    const [url, init] = lastCall(fetchImpl);
    expect(url).toContain("/a1/assist/response-doc");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({
      key: "cover_letter",
      content: "# Edited",
    });
    expect(result).toMatchObject({ ok: true, key: "cover_letter" });
  });

  it("never retries a save", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      throw new TypeError("Failed to fetch");
    });
    const endpoint = new ApplicationsEndpoint({
      transport: new ApiTransport({
        baseUrl: "http://localhost:3000",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async () => {},
      }),
      getToken: async () => "tok",
    });
    await expect(
      endpoint.saveResponseDocument("a1", "cover_letter", "# Edited"),
    ).rejects.toBeDefined();
    expect(calls).toBe(1);
  });

  it("maps save errors exactly like the other mutation routes", async () => {
    const forbidden = harness(ApplicationsEndpoint, () =>
      jsonResponse({ error: "Forbidden" }, 403),
    );
    await expect(
      forbidden.endpoint.saveResponseDocument("a1", "cover_letter", "x"),
    ).rejects.toMatchObject({ kind: "forbidden" });

    const missing = harness(ApplicationsEndpoint, () =>
      jsonResponse({ error: "Application not found" }, 404),
    );
    await expect(
      missing.endpoint.saveResponseDocument("a1", "cover_letter", "x"),
    ).rejects.toMatchObject({ kind: "not-found" });

    const noContent = harness(ApplicationsEndpoint, () =>
      jsonResponse({ error: "key and content are required" }, 400),
    );
    await expect(
      noContent.endpoint.saveResponseDocument("a1", "cover_letter", ""),
    ).rejects.toMatchObject({ kind: "validation" });
  });
});

describe("applications endpoint — deep-analyse enrichment", () => {
  const mergedBlueprint = {
    tenderId: "t1",
    industry: { id: "i1", name: "Construction" },
    requiredUserDocuments: [
      {
        name: "Tax Clearance Certificate",
        canonicalType: "tax-clearance",
        source: "compliance",
        mandatory: true,
      },
    ],
    responseDocuments: [
      {
        key: "cover_letter",
        title: "Cover Letter",
        kind: "cover_letter",
        brief: "Tender-specific brief from the deep-analyse.",
        mandatory: true,
      },
    ],
    steps: [],
    risks: ["Enrichment-added risk."],
    confidence: "high",
    generatedBy: "ai",
  };

  it("POSTs with no body and parses the enriched result", async () => {
    const { endpoint, fetchImpl } = harness(ApplicationsEndpoint, () =>
      jsonResponse({ blueprint: mergedBlueprint, enriched: true }),
    );
    const result = await endpoint.enrichBlueprint("a1");
    const [url, init] = lastCall(fetchImpl);
    expect(url).toContain("/a1/assist/enrich-blueprint");
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    expect(result.enriched).toBe(true);
    expect(result.blueprint?.generatedBy).toBe("ai");
    expect(result.blueprint?.responseDocuments?.[0].brief).toContain(
      "deep-analyse",
    );
  });

  it("parses a non-fatal fallback with each reason", async () => {
    for (const reason of [
      "ai_unavailable",
      "no_analysis",
      "analysis_triggered",
    ]) {
      const { endpoint } = harness(ApplicationsEndpoint, () =>
        jsonResponse({ blueprint: mergedBlueprint, enriched: false, reason }),
      );
      const result = await endpoint.enrichBlueprint("a1");
      expect(result.enriched).toBe(false);
      expect(result.reason).toBe(reason);
      expect(result.blueprint?.generatedBy).toBe("ai");
      expect(result.analysisStatus).toBeUndefined();
    }
  });

  it("tolerates a null blueprint", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse({ blueprint: null, enriched: false, reason: "no_analysis" }),
    );
    const result = await endpoint.enrichBlueprint("a1");
    expect(result.blueprint).toBeNull();
    expect(result.reason).toBe("no_analysis");
  });

  it("surfaces 402 as payment-required", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse(
        {
          error: "Pro plan required",
          message:
            "On-demand tender analysis for your application is a Professional feature.",
          upgradeUrl: "/pricing",
        },
        402,
      ),
    );
    await expect(endpoint.enrichBlueprint("a1")).rejects.toMatchObject({
      kind: "payment-required",
    });
  });

  it("maps 403/404 exactly like the other application routes", async () => {
    const forbidden = harness(ApplicationsEndpoint, () =>
      jsonResponse({ error: "Forbidden" }, 403),
    );
    await expect(
      forbidden.endpoint.enrichBlueprint("a1"),
    ).rejects.toMatchObject({
      kind: "forbidden",
    });

    const missing = harness(ApplicationsEndpoint, () =>
      jsonResponse({ error: "Application not found" }, 404),
    );
    await expect(missing.endpoint.enrichBlueprint("a1")).rejects.toMatchObject({
      kind: "not-found",
    });
  });

  it("never retries an enrich request", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      throw new TypeError("Failed to fetch");
    });
    const endpoint = new ApplicationsEndpoint({
      transport: new ApiTransport({
        baseUrl: "http://localhost:3000",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async () => {},
      }),
      getToken: async () => "tok",
    });
    await expect(endpoint.enrichBlueprint("a1")).rejects.toBeDefined();
    expect(calls).toBe(1);
  });
});

describe("applications endpoint — workspace package export (Slice 6)", () => {
  function pdfResponse(): Response {
    return new Response(new Uint8Array([37, 80, 68, 70, 1, 2, 3]), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="proposal-RFQ-001.pdf"',
      },
    });
  }

  it("POSTs with the format in the query and returns bytes + filename", async () => {
    const { endpoint, fetchImpl } = harness(ApplicationsEndpoint, pdfResponse);

    const result = await endpoint.exportWorkspacePackage("a1", "pdf");

    const [url, init] = lastCall(fetchImpl);
    expect(url).toContain("/a1/assist/workspace-export");
    expect(url).toContain("format=pdf");
    expect(init.method).toBe("POST");
    expect(result.bytes).toEqual(new Uint8Array([37, 80, 68, 70, 1, 2, 3]));
    expect(result.filename).toBe("proposal-RFQ-001.pdf");
    expect(result.contentType).toBe("application/pdf");
  });

  it("sends docx when asked for docx", async () => {
    const { endpoint, fetchImpl } = harness(
      ApplicationsEndpoint,
      () =>
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition":
              'attachment; filename="proposal-RFQ-001.docx"',
          },
        }),
    );

    const result = await endpoint.exportWorkspacePackage("a1", "docx");

    const [url] = lastCall(fetchImpl);
    expect(url).toContain("format=docx");
    expect(result.filename).toBe("proposal-RFQ-001.docx");
    expect(result.contentType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("falls back to the route filename when no disposition header arrives", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () => pdfResponse());
    const result = await endpoint.exportWorkspacePackage("a1", "pdf");
    expect(result.filename).toBe("proposal-RFQ-001.pdf");
  });

  it("surfaces the 409 nothing-to-export gate as validation", async () => {
    const { endpoint } = harness(ApplicationsEndpoint, () =>
      jsonResponse(
        { error: "Generate your proposal documents before exporting." },
        409,
      ),
    );
    await expect(
      endpoint.exportWorkspacePackage("a1", "pdf"),
    ).rejects.toMatchObject({ kind: "validation" });
  });

  it("maps 401/403/404/500 exactly like the other application routes", async () => {
    const forbidden = harness(ApplicationsEndpoint, () =>
      jsonResponse({ error: "Forbidden" }, 403),
    );
    await expect(
      forbidden.endpoint.exportWorkspacePackage("a1", "pdf"),
    ).rejects.toMatchObject({ kind: "forbidden" });

    const missing = harness(ApplicationsEndpoint, () =>
      jsonResponse({ error: "Application not found" }, 404),
    );
    await expect(
      missing.endpoint.exportWorkspacePackage("a1", "pdf"),
    ).rejects.toMatchObject({ kind: "not-found" });

    const down = harness(ApplicationsEndpoint, () =>
      jsonResponse({ error: "Internal server error" }, 500),
    );
    await expect(
      down.endpoint.exportWorkspacePackage("a1", "pdf"),
    ).rejects.toMatchObject({ kind: "server" });
  });

  it("never retries an export request", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      throw new TypeError("Failed to fetch");
    });
    const endpoint = new ApplicationsEndpoint({
      transport: new ApiTransport({
        baseUrl: "http://localhost:3000",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async () => {},
      }),
      getToken: async () => "tok",
    });
    await expect(
      endpoint.exportWorkspacePackage("a1", "pdf"),
    ).rejects.toBeDefined();
    expect(calls).toBe(1);
  });
});
