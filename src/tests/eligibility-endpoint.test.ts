/**
 * Eligibility endpoint tests.
 *
 * Refs: brief §6.2, §4.3, INT-A3
 *
 * These exist because of a shipped defect that was invisible from the UI:
 * the client issued `GET` against a route that exports `POST` only, Next.js
 * answered a bare 405, and the desktop rendered "Add your company profile to
 * see the eligibility check" — to users whose company profile was complete.
 * The request never reached the profile lookup. The method assertion below is
 * the guard; the 405 test proves the misleading copy really is what a wrong
 * verb produces, so a future reader cannot dismiss the pinning as pedantry.
 */

import { describe, expect, it, vi } from "vitest";
import { EligibilityEndpoint } from "../services/api/endpoints/eligibility";
import { ApiTransport } from "../services/api/transport";
import { describeApiError } from "../services/api/describe-error";
import { ApiError } from "../services/api/errors";

const ELIGIBILITY_BODY = {
  success: true as const,
  data: {
    eligible: "partial" as const,
    score: 71,
    checks: [
      {
        criterion: "B-BBEE Level",
        required: "Level 4 or better",
        user: "Level 2",
        pass: true,
      },
      {
        criterion: "CIDB Grading",
        required: "Grade 5",
        user: "Not set",
        pass: false,
      },
    ],
    blockers: ["CIDB Grade is insufficient (Not set vs required Grade 5)"],
    suggestions: ["Add your CIDB grading to your company profile"],
    matchScore: 68,
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeEndpoint(respond: () => Promise<Response>) {
  const fetchImpl = vi.fn(respond);
  const endpoint = new EligibilityEndpoint({
    transport: new ApiTransport({
      baseUrl: "http://localhost:3000",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
    }),
    getToken: async () => "tok",
  });
  return { endpoint, fetchImpl };
}

function initOf(fetchImpl: ReturnType<typeof vi.fn>, call = 0): RequestInit {
  return (fetchImpl.mock.calls[call] as unknown as [string, RequestInit])[1];
}

describe("eligibility check", () => {
  it("POSTs, because the parent route exports POST only", async () => {
    // THE REGRESSION. A GET here is a 405, and a 405 reads to the user as
    // "add your company profile". Do not relax this to accept any method.
    const { endpoint, fetchImpl } = makeEndpoint(async () =>
      jsonResponse(ELIGIBILITY_BODY),
    );
    await endpoint.check("t1");
    expect(initOf(fetchImpl).method).toBe("POST");
  });

  it("sends no request body, which the route does not read", async () => {
    const { endpoint, fetchImpl } = makeEndpoint(async () =>
      jsonResponse(ELIGIBILITY_BODY),
    );
    await endpoint.check("t1");
    expect(initOf(fetchImpl).body).toBeUndefined();
  });

  it("puts the tender id in the path, encoded", async () => {
    const { endpoint, fetchImpl } = makeEndpoint(async () =>
      jsonResponse(ELIGIBILITY_BODY),
    );
    await endpoint.check("a b/c");
    const [url] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/v1/tenders/a%20b%2Fc/eligibility-check");
  });

  it("sends the Bearer token read per request", async () => {
    const { endpoint, fetchImpl } = makeEndpoint(async () =>
      jsonResponse(ELIGIBILITY_BODY),
    );
    await endpoint.check("t1");
    expect((initOf(fetchImpl).headers as Record<string, string>).Authorization).toBe(
      "Bearer tok",
    );
  });

  it("parses the three-way verdict without collapsing partial", async () => {
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse(ELIGIBILITY_BODY),
    );
    const result = await endpoint.check("t1");
    expect(result.eligible).toBe("partial");
    expect(result.score).toBe(71);
    expect(result.blockers).toHaveLength(1);
    expect(result.matchScore).toBe(68);
  });

  it("is not retried, because it is a POST", async () => {
    // `performRequest` forces retry:"never" for a non-GET. A 500 must reach
    // the caller after one attempt, not three.
    const { endpoint, fetchImpl } = makeEndpoint(async () =>
      jsonResponse({ error: "Internal server error" }, 500),
    );
    await expect(endpoint.check("t1")).rejects.toBeInstanceOf(ApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("shows a 405 as the company-profile message (the defect's signature)", async () => {
    // Proves why the method assertion above matters: nothing in this chain
    // mentions the method, so the only symptom of the wrong verb was copy
    // blaming the user's profile.
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse({ error: "Method Not Allowed" }, 405),
    );
    const error = await endpoint.check("t1").catch((e: unknown) => e);
    const described = describeApiError(error, "the eligibility check");

    expect(described.kind).toBe("validation");
    expect(described.message).toBe(
      "Add your company profile to see the eligibility check.",
    );
  });

  it("still reports a real 401 as sign-in, not as a missing profile", async () => {
    const { endpoint } = makeEndpoint(async () =>
      jsonResponse({ error: "Unauthorized" }, 401),
    );
    const error = await endpoint.check("t1").catch((e: unknown) => e);
    expect(describeApiError(error, "the eligibility check").kind).toBe(
      "unauthorized",
    );
  });
});
