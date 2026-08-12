/**
 * Tender filter tests.
 *
 * Refs: INT-A3, PERF-3, A11Y-A1
 *
 * The filter values are not cosmetic choices. `/api/tenders` matches province
 * with Prisma `equals` (case-insensitive), so a value that is not one of the
 * stored names returns an empty page -- which is why province is a fixed list
 * rather than a text box. And an unrecognised `publicationType` silently
 * falls back to open tenders, so offering a value the route does not branch on
 * would produce a control that appears to do nothing.
 *
 * Both facts were read from parent source at `8ff2e4c2`, and the tests below
 * pin the desktop to them.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { TenderList } from "../features/tenders/TenderList";
import {
  PROVINCES,
  PUBLICATION_FILTERS,
} from "../features/tenders/tender-filter-options";
import type {
  TenderListResult,
  TendersEndpoint,
} from "../services/api/endpoints/tenders";
import type { RecommendationsEndpoint } from "../services/api/endpoints/recommendations";

const emptyResult: TenderListResult = {
  tenders: [],
  page: 1,
  limit: 20,
  total: 0,
  pages: 0,
};

function listEndpoint(result: TenderListResult = emptyResult) {
  const list = vi.fn(async () => result);
  return {
    endpoint: { list, get: vi.fn() } as unknown as TendersEndpoint,
    list,
  };
}

/** The query object of the most recent `list` call. */
function lastQuery(list: ReturnType<typeof vi.fn>) {
  const calls = list.mock.calls;
  return calls[calls.length - 1][0] as Record<string, unknown>;
}

describe("filter options", () => {
  it("offers the nine provinces plus National", () => {
    // National is a real province value for tenders that are not
    // province-specific; omitting it would hide them behind a filter that
    // looks exhaustive.
    expect(PROVINCES).toHaveLength(10);
    expect(PROVINCES).toContain("National");
    expect(PROVINCES).toContain("KwaZulu-Natal");
  });

  it("spells KwaZulu-Natal the way the parent normalises it", () => {
    // `equals` matching means a different spelling returns nothing at all.
    expect(PROVINCES).toContain("KwaZulu-Natal");
    expect(PROVINCES).not.toContain("Kwazulu-Natal");
    expect(PROVINCES).not.toContain("KZN");
  });

  it("uses only publicationType values the route actually branches on", () => {
    // Anything else falls through to the default and the control would look
    // broken. CLOSED is a route pseudo-value, not a PublicationType member.
    const values = PUBLICATION_FILTERS.map((f) => f.value);
    expect(values).toEqual([
      undefined,
      "CLOSED",
      "AWARD_NOTICE",
      "CANCELLATION_NOTICE",
      "CORRIGENDUM",
    ]);
  });

  it("defaults to open tenders by sending no publicationType at all", () => {
    // The route's no-parameter branch is ACTIVE + future closing date, which
    // is the right default for someone looking for work to bid on.
    expect(PUBLICATION_FILTERS[0]).toEqual({
      value: undefined,
      label: "Open tenders",
    });
  });
});

describe("TenderList filters", () => {
  it("sends no province or publicationType until one is chosen", async () => {
    const { endpoint, list } = listEndpoint();
    render(<TenderList endpoint={endpoint} />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    const query = lastQuery(list);
    expect(query.province).toBe("");
    expect(query.publicationType).toBe("");
  });

  it("filters by province when one is selected", async () => {
    const { endpoint, list } = listEndpoint();
    render(<TenderList endpoint={endpoint} />);
    await waitFor(() => expect(list).toHaveBeenCalled());

    await userEvent.selectOptions(
      screen.getByLabelText("Province"),
      "Western Cape",
    );
    await waitFor(() => expect(lastQuery(list).province).toBe("Western Cape"));
  });

  it("filters by publication type when one is selected", async () => {
    const { endpoint, list } = listEndpoint();
    render(<TenderList endpoint={endpoint} />);
    await waitFor(() => expect(list).toHaveBeenCalled());

    await userEvent.selectOptions(
      screen.getByLabelText("Show"),
      "AWARD_NOTICE",
    );
    await waitFor(() =>
      expect(lastQuery(list).publicationType).toBe("AWARD_NOTICE"),
    );
  });

  it("resets to page 1 when a filter changes", async () => {
    // Staying on page 4 of a narrower result set shows an empty page, which
    // reads as "no tenders match" when in fact the user is past the end.
    const { endpoint, list } = listEndpoint({
      ...emptyResult,
      total: 100,
      pages: 5,
      tenders: [],
    });
    render(<TenderList endpoint={endpoint} />);
    await waitFor(() => expect(list).toHaveBeenCalled());

    await userEvent.selectOptions(screen.getByLabelText("Province"), "Gauteng");
    await waitFor(() => expect(lastQuery(list).province).toBe("Gauteng"));
    expect(lastQuery(list).page).toBe(1);
  });

  it("still sends an explicit limit with filters applied (PERF-3)", async () => {
    const { endpoint, list } = listEndpoint();
    render(<TenderList endpoint={endpoint} />);
    await waitFor(() => expect(list).toHaveBeenCalled());

    await userEvent.selectOptions(screen.getByLabelText("Province"), "Limpopo");
    await waitFor(() => expect(lastQuery(list).province).toBe("Limpopo"));
    expect(lastQuery(list).limit).toBe(20);
  });

  it("labels both controls, so they are reachable without sighted guessing", () => {
    const { endpoint } = listEndpoint();
    render(<TenderList endpoint={endpoint} />);
    expect(screen.getByLabelText("Province")).toBeVisible();
    expect(screen.getByLabelText("Show")).toBeVisible();
  });

  it("blames the corpus when nothing is filtered", async () => {
    const { endpoint } = listEndpoint();
    render(<TenderList endpoint={endpoint} />);
    expect(
      await screen.findByText("No open tenders are available right now."),
    ).toBeVisible();
  });

  it("blames the filter, not the platform, when a filter is narrowing", async () => {
    // Saying "none available" while a province filter is active would tell
    // the user the platform is empty when their own selection is.
    const { endpoint } = listEndpoint();
    render(<TenderList endpoint={endpoint} />);
    await userEvent.selectOptions(
      screen.getByLabelText("Province"),
      "Northern Cape",
    );
    expect(
      await screen.findByText("No tenders match the current filters."),
    ).toBeVisible();
  });

  it("mentions both the search term and the filters when both are active", async () => {
    const { endpoint } = listEndpoint();
    render(<TenderList endpoint={endpoint} />);
    await userEvent.type(
      screen.getByLabelText("Search tenders"),
      "roadworks{Enter}",
    );
    await userEvent.selectOptions(screen.getByLabelText("Province"), "Gauteng");
    expect(
      await screen.findByText(/No tenders match “roadworks” with the current/),
    ).toBeVisible();
  });
});

describe("company opportunity desk", () => {
  function recommendationsEndpoint() {
    const list = vi.fn(async () => ({
      state: "ready" as const,
      recommendations: [
        {
          id: "match-1",
          tenderId: "tender-1",
          tender: {
            id: "tender-1",
            title: "Supply and delivery of safety equipment",
            referenceNumber: "SAFE-2026",
            description: null,
            closingDate: "2026-09-01T10:00:00.000Z",
            estimatedValue: 500_000,
            province: "Gauteng",
            sourceOrganization: "Department of Public Works",
            status: "ACTIVE",
          },
          score: 84,
          baseScore: 82,
          reasoning: "Strong industry and province alignment.",
          factors: null,
          improvementAreas: [],
          calculatedAt: "2026-08-12T08:00:00.000Z",
          matchCategory: "highly_qualified" as const,
        },
      ],
      hasMore: false,
      offset: 0,
      limit: 20,
    }));
    return {
      endpoint: {
        list,
        explain: vi.fn(),
        newCount: vi.fn(),
        refresh: vi.fn(async () => undefined),
      } as unknown as RecommendationsEndpoint,
      list,
    };
  }

  it("leads with server-scored company matches and defers the corpus read", async () => {
    const tenders = listEndpoint();
    const matches = recommendationsEndpoint();

    render(
      <MemoryRouter>
        <TenderList
          endpoint={tenders.endpoint}
          recommendations={matches.endpoint}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("84%")).toBeVisible();
    expect(screen.getByText("Strong match")).toBeVisible();
    expect(matches.list).toHaveBeenCalledTimes(1);
    expect(tenders.list).not.toHaveBeenCalled();
  });

  it("loads all tenders only when that view is selected and labels them unscored", async () => {
    const tenders = listEndpoint();
    const matches = recommendationsEndpoint();

    render(
      <MemoryRouter>
        <TenderList
          endpoint={tenders.endpoint}
          recommendations={matches.endpoint}
        />
      </MemoryRouter>,
    );

    await screen.findByText("84%");
    await userEvent.click(screen.getByRole("tab", { name: "All tenders" }));
    await waitFor(() => expect(tenders.list).toHaveBeenCalledTimes(1));
    expect(
      screen.getByText(/not company-scored until they appear in Tender Radar/i),
    ).toBeVisible();
  });
});
