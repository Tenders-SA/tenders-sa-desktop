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
import { TenderList } from "../features/tenders/TenderList";
import {
  PROVINCES,
  PUBLICATION_FILTERS,
} from "../features/tenders/tender-filter-options";
import type {
  TenderListResult,
  TendersEndpoint,
} from "../services/api/endpoints/tenders";

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

describe("full tender listing (matched view removed)", () => {
  it("renders the full listing immediately, with no matched/all tabs", async () => {
    const { endpoint, list } = listEndpoint({
      ...emptyResult,
      total: 1,
      pages: 1,
      tenders: [
        {
          id: "tender-1",
          tender_id: "ext-1",
          title: "Supply and delivery of safety equipment",
          referenceNumber: "SAFE-2026",
          sourceOrganization: "Department of Public Works",
          description: "Supply and delivery of safety equipment to depots.",
          province: "Gauteng",
          closingDate: "2026-09-01T10:00:00.000Z",
          estimatedValue: 500_000,
          publicationType: "TENDER_NOTICE",
        },
      ],
    });
    render(<TenderList endpoint={endpoint} />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    // The corpus is fetched on mount — no matched view defers the read.
    expect(list).toHaveBeenCalledTimes(1);
    // No matched/all tab strip and no embedded radar.
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByText("Matched for your company")).toBeNull();
    expect(screen.queryByText("All tenders")).toBeNull();
  });

  it("renders each tender's description as the body of the card", async () => {
    const { endpoint } = listEndpoint({
      ...emptyResult,
      total: 1,
      pages: 1,
      tenders: [
        {
          id: "tender-1",
          tender_id: "ext-1",
          title: "Supply and delivery of safety equipment",
          referenceNumber: "SAFE-2026",
          sourceOrganization: "Department of Public Works",
          description:
            "Supply and delivery of safety equipment to provincial depots.",
          province: "Gauteng",
          closingDate: "2026-09-01T10:00:00.000Z",
        },
      ],
    });
    render(<TenderList endpoint={endpoint} />);
    expect(
      await screen.findByText(
        "Supply and delivery of safety equipment to provincial depots.",
      ),
    ).toBeVisible();
  });

  it("shows the closing date, days remaining, value and supply address prominently", async () => {
    const { endpoint } = listEndpoint({
      ...emptyResult,
      total: 1,
      pages: 1,
      tenders: [
        {
          id: "tender-1",
          tender_id: "ext-1",
          title: "Supply and delivery of safety equipment",
          referenceNumber: "SAFE-2026",
          sourceOrganization: "Department of Public Works",
          description: "Provision of safety equipment.",
          province: "Gauteng",
          closingDate: "2099-01-01T10:00:00.000Z",
          estimatedValue: 500_000,
          delivery: "123 Industrial Road, Johannesburg",
          type: "Request for Quotation",
          publicationType: "TENDER_NOTICE",
        },
      ],
    });
    render(<TenderList endpoint={endpoint} />);
    await screen.findByText("Provision of safety equipment.");
    // Closing date + days remaining, value, and supply address are all visible.
    expect(screen.getByText(/Closes in/)).toBeVisible();
    expect(screen.getByText(/days left/)).toBeVisible();
    expect(screen.getByText(/R\s?500\s?000/)).toBeVisible();
    expect(screen.getByText("Supply address")).toBeVisible();
    expect(screen.getByText("123 Industrial Road, Johannesburg")).toBeVisible();
  });

  it("renders no description paragraph when the tender has no description", async () => {
    const { endpoint } = listEndpoint({
      ...emptyResult,
      total: 1,
      pages: 1,
      tenders: [
        {
          id: "tender-1",
          tender_id: "ext-1",
          title: "Supply and delivery of safety equipment",
          referenceNumber: "SAFE-2026",
          sourceOrganization: "Department of Public Works",
          description: null,
          province: "Gauteng",
          closingDate: "2026-09-01T10:00:00.000Z",
        },
      ],
    });
    render(<TenderList endpoint={endpoint} />);
    await screen.findByText("Supply and delivery of safety equipment");
    // The org line is present; no description body is rendered.
    expect(screen.queryByText(/key requirements/i)).toBeNull();
  });
});
