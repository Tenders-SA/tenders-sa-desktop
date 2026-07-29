/**
 * Supplier Intelligence tests.
 *
 * Refs: brief §4.2 (provenance), §4.4, INT-A3, REQ-A12
 *
 * Two things matter most here. The route uses a **third** response envelope
 * with snake_case meta keys, so pagination is easy to read wrong; and the
 * enrichment description is *derived* data, which brief §4.2 forbids
 * presenting as verified fact.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiTransport } from "../services/api/transport";
import {
  formatAwardValue,
  SupplierIntelligenceEndpoint,
  type IntelligenceCompany,
} from "../services/api/endpoints/supplier-intelligence";
import { SupplierIntelligence } from "../features/intelligence/SupplierIntelligence";

const company: IntelligenceCompany = {
  rank: 1,
  name: "Acme Civils",
  slug: "acme-civils",
  totalAwards: 42,
  totalValue: 18_400_000,
  latestAwardDate: "2026-06-01T00:00:00.000Z",
  lastActiveYear: 2026,
  lastKnownBuyer: "SANRAL",
  provinces: ["Gauteng", "Limpopo"],
  currency: "ZAR",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function endpointOver(body: unknown) {
  const fetchImpl = vi.fn(async () => jsonResponse(body));
  const endpoint = new SupplierIntelligenceEndpoint({
    transport: new ApiTransport({
      baseUrl: "http://localhost:3000",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
    }),
    getToken: async () => "tok",
  });
  return { endpoint, fetchImpl };
}

const oneResult = {
  data: [company],
  meta: {
    total: 1,
    page: 1,
    per_page: 20,
    total_pages: 1,
    mode: "company",
    has_next: false,
    has_prev: false,
  },
};

describe("supplier intelligence endpoint", () => {
  it("reads the snake_case meta this route returns", async () => {
    // A third envelope: `{data, meta}` with per_page/total_pages/has_next,
    // where the dashboard uses `{success, data}` and /api/tenders a bare key.
    const { endpoint } = endpointOver(oneResult);
    const result = await endpoint.search();
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.hasNext).toBe(false);
  });

  it("requests the leaderboard mode whose item shape it validates", async () => {
    const { endpoint, fetchImpl } = endpointOver(oneResult);
    await endpoint.search();
    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(url).toContain("mode=company");
    expect(url).toContain("per_page=20");
  });

  it("omits an empty search rather than sending a blank parameter", async () => {
    const { endpoint, fetchImpl } = endpointOver(oneResult);
    await endpoint.search({ q: "" });
    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(url).not.toContain("q=");
  });

  it("surfaces a schema mismatch rather than rendering nonsense", async () => {
    const { endpoint } = endpointOver({ data: [{ name: "no rank" }] });
    await expect(endpoint.search()).rejects.toMatchObject({
      kind: "malformed",
    });
  });
});

describe("award value formatting", () => {
  /**
   * `Intl` groups en-ZA digits with a NON-BREAKING space, so comparing against
   * a literal typed space silently fails. Normalising all whitespace keeps
   * these assertions about the number rather than about Unicode.
   */
  const digits = (text: string) => text.replace(/\s+/gu, " ");

  it("uses the currency the row declares", () => {
    expect(digits(formatAwardValue(company))).toContain("18 400 000");
    expect(formatAwardValue(company)).toContain("R");
  });

  it("does not throw on an unrecognised currency code", () => {
    // A bad code would otherwise make Intl throw and blank the row; the number
    // is more useful than nothing.
    const odd = { ...company, currency: "NOTACURRENCY" };
    expect(digits(formatAwardValue(odd))).toContain("18 400 000");
    expect(formatAwardValue(odd)).toContain("NOTACURRENCY");
  });

  it("falls back to ZAR when the row has no currency", () => {
    expect(digits(formatAwardValue({ ...company, currency: "" }))).toContain(
      "18 400 000",
    );
  });
});

describe("Supplier Intelligence screen", () => {
  function screenOver(body: unknown) {
    const { endpoint } = endpointOver(body);
    render(<SupplierIntelligence endpoint={endpoint} />);
    return endpoint;
  }

  it("shows award counts and value as evidence", async () => {
    screenOver(oneResult);
    expect(await screen.findByText("Acme Civils")).toBeVisible();
    expect(screen.getByText(/42 awards/)).toBeVisible();
  });

  it("says the last active year is not recorded rather than guessing one", async () => {
    screenOver({
      ...oneResult,
      data: [{ ...company, lastActiveYear: null }],
    });
    expect(await screen.findByText("Last active not recorded")).toBeVisible();
  });

  it("labels a compiled description as derived, not as fact (brief §4.2)", async () => {
    screenOver({
      ...oneResult,
      data: [
        {
          ...company,
          enrichment: {
            description: "A civil engineering contractor based in Midrand.",
            confidenceScore: 0.82,
          },
        },
      ],
    });
    expect(
      await screen.findByText(/civil engineering contractor/i),
    ).toBeVisible();
    expect(screen.getByText(/automatically compiled/i)).toBeVisible();
    expect(screen.getByText(/verify before relying on it/i)).toBeVisible();
  });

  it("shows no provenance note when there is no derived description", async () => {
    screenOver(oneResult);
    await screen.findByText("Acme Civils");
    expect(screen.queryByText(/automatically compiled/i)).toBeNull();
  });

  it("filters by province server-side", async () => {
    const endpoint = screenOver(oneResult);
    const spy = vi.spyOn(endpoint, "search");
    await screen.findByText("Acme Civils");
    await userEvent.selectOptions(screen.getByLabelText("Province"), "Gauteng");
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ province: "Gauteng", page: 1 }),
        expect.anything(),
      ),
    );
  });

  it("says nothing matched rather than implying an empty platform", async () => {
    screenOver({
      data: [],
      meta: {
        total: 0,
        page: 1,
        per_page: 20,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      },
    });
    expect(
      await screen.findByText("No award history is available."),
    ).toBeVisible();
  });
});
