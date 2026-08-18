/**
 * Supplier Profile — endpoint and screen tests (Slice 12).
 *
 * Spec: desktop-supplier-profile (R-S1..R-S17, H1..H14)
 *
 * All of this slice's tests live in this file rather than in
 * `module-endpoints.test.ts` / `module-screens.test.tsx`, which are held by
 * the in-flight company-profile slice (SPEC_CONTRACT.md "Collision note").
 *
 * Every parent shape below was read from parent source on 2026-08-16 and is
 * cited in `INTEGRATION_EVAL.md`. The things pinned hardest are the ones a
 * plausible guess gets wrong: the corrected route path for contract C (H1),
 * its lossy slug round-trip (H2), the `x-pro-access` header the desktop must
 * never send (H3), and the two different meta casings (H4).
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiTransport } from "../services/api/transport";
import { AppRoutes } from "../app/router/routes";
import { stubApiClients } from "./fixtures/api-clients";
import { SupplierIntelligence } from "../features/intelligence/SupplierIntelligence";
import { SupplierProfile } from "../features/intelligence/SupplierProfile";
import { ApiError } from "../services/api/errors";
import {
  awardsPerYear,
  describeEvidence,
  summariseBuyers,
} from "../features/intelligence/supplier-profile-model";
import type { AuthPort } from "../services/auth/ports";
import type { SupplierIntelligenceEndpoint as ListEndpoint } from "../services/api/endpoints/supplier-intelligence";
import { createAuthWiring } from "../app/auth-wiring";
import {
  CAPS,
  EYEBROW,
  FLAG_HEADINGS,
  RISK_DISCLAIMER,
  SEVERITY_LABELS,
  TIER,
  VERDICT,
  VERDICT_DETAIL,
  flagHeading,
  severityLabel,
} from "../features/intelligence/supplier-profile-copy";
import { SupplierIntelligenceEndpoint } from "../services/api/endpoints/supplier-intelligence";
import {
  awardSlugFromName,
  deslugForSearch,
  slugComparableName,
  slugSearchTerms,
  SupplierProfileEndpoint,
} from "../services/api/endpoints/supplier-profile";

/** `capabilities` for a subscriber / a free account. */
function access(subscriber: boolean) {
  return {
    isSubscriber: subscriber,
    isAdmin: false,
    planTier: subscriber ? "professional" : null,
    capabilities: {
      fullRows: subscriber,
      advancedFilters: subscriber,
      compareEntities: subscriber,
      buyerSearch: subscriber,
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Builds the endpoint over a fake network, capturing every request.
 *
 * `respond` is keyed on the request path so one harness can serve the six
 * different upstreams a single screen render touches.
 */
function harness(respond: (url: string) => Response) {
  const fetchImpl = vi.fn(async (url: string) => respond(url));
  const endpoint = new SupplierProfileEndpoint({
    transport: new ApiTransport({
      baseUrl: "http://localhost:3000",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
    }),
    getToken: async () => "tok",
  });
  return { endpoint, fetchImpl };
}

function calls(fetchImpl: ReturnType<typeof vi.fn>) {
  return fetchImpl.mock.calls as unknown as [string, RequestInit][];
}

/* ------------------------------------------------------------------ *
 * Fixtures — parent shapes, read 2026-08-16
 * ------------------------------------------------------------------ */

const acme = {
  rank: 3,
  name: "Acme Civils (Pty) Ltd",
  slug: "acme-civils-pty-ltd",
  totalAwards: 42,
  totalValue: 18_400_000,
  latestAwardDate: "2026-06-01T00:00:00.000Z",
  lastActiveYear: 2026,
  lastKnownBuyer: "SANRAL",
  provinces: ["Gauteng", "Limpopo"],
  currency: "ZAR",
  enrichment: {
    website: "https://acmecivils.example",
    description: "A civil engineering contractor based in Midrand.",
    headquartersAddress: "12 Kruger Road, Midrand",
    confidenceScore: 0.82,
    lastEnrichedAt: "2026-05-02T00:00:00.000Z",
  },
};

/** A near miss: matches the search term, is not the requested slug. */
const acmeHoldings = {
  ...acme,
  rank: 1,
  name: "Acme Civils Holdings",
  slug: "acme-civils-holdings",
  totalValue: 99_000_000,
  enrichment: undefined,
};

const acmeForensicRow = {
  id: "supplier:acme-civils-pty-ltd",
  mode: "supplier",
  name: "Acme Civils (Pty) Ltd",
  slug: "acme-civils-pty-ltd",
  href: "/tools/forensic-analysis/supplier/acme-civils-pty-ltd",
  totalAwards: 42,
  totalValue: 18_400_000,
  latestAwardDate: "2026-06-01T00:00:00.000Z",
  lastCounterpart: "SANRAL",
  provinces: ["Gauteng"],
  buyerType: null,
  enterpriseType: "EME",
  beeLevel: "Level 1",
  forensicRiskScore: 34,
  forensicFlagCount: 2,
  forensicFlags: [
    {
      type: "NEW_ENTRANT_LARGE_AWARD",
      severity: "high",
      description: "A R12m award was recorded 4 months after registration.",
    },
  ],
  ocpo: {
    status: "none",
    activeCount: 0,
    historyCount: 0,
    lastSyncAt: "2026-08-01T00:00:00.000Z",
  },
  intelligence: null,
  competitive: null,
  provinceHealth: [],
  previewLocked: false,
};

function forensicSearch(rows: unknown[], preview = false, subscriber = true) {
  return {
    data: rows,
    meta: {
      total: rows.length,
      page: 1,
      perPage: preview ? 8 : 50,
      totalPages: 1,
      mode: "supplier",
      hasNext: false,
      hasPrev: false,
      preview,
      postFiltered: false,
      access: access(subscriber),
    },
  };
}

const publicRecord = {
  supplierName: "Acme Civils Pty Ltd",
  cipcData: {
    registrationNumber: "2014/123456/07",
    status: "In Business",
    companyType: "Private Company",
    registrationDate: "2014-03-11T00:00:00.000Z",
    complianceScore: 71,
    physicalAddress: "12 Kruger Road, Midrand",
    directorCount: 3,
  },
  forensicRiskScore: 34,
  forensicFlags: [
    {
      type: "NEW_ENTRANT_LARGE_AWARD",
      severity: "high",
      description: "A R12m award was recorded 4 months after registration.",
    },
  ],
  flagCount: 4,
  awardTimeline: [
    {
      amount: 12_000_000,
      awardDate: "2026-06-01T00:00:00.000Z",
      tenderTitle: "N1 resurfacing, section 12",
      department: "SANRAL",
    },
    {
      amount: 3_400_000,
      awardDate: "2025-11-14T00:00:00.000Z",
      tenderTitle: "Stormwater upgrade",
      department: "City of Tshwane",
    },
  ],
};

const entityContext = {
  data: {
    mode: "supplier",
    name: "Acme Civils (Pty) Ltd",
    provinces: ["Gauteng", "Limpopo"],
    categories: ["Civil engineering", "Roads"],
    competitive: null,
    intelligence: {
      total: 2,
      criticalCount: 0,
      highCount: 1,
      latestPublishedAt: "2026-07-20T00:00:00.000Z",
      topHeadline: "Roads agency reviews contractor panel",
      topUrgency: "HIGH",
      topSummary: "The agency has begun a routine panel review.",
      riskFlags: ["panel-review"],
    },
    provinceHealth: [
      {
        code: "GP",
        name: "Gauteng",
        healthScore: 62,
        status: "Moderate",
        scoreDate: "2026-03-31T00:00:00.000Z",
      },
    ],
    ocpo: null,
    restriction: {
      state: "none",
      restricted: false,
      activeCount: 0,
      historyCount: 0,
      overlapCount: 0,
      confidence: "high",
      periods: [],
      lastSyncAt: "2026-08-10T00:00:00.000Z",
      label: "No restricted supplier records in source data",
    },
  },
  meta: { access: access(true) },
};

const contacts = {
  directors: [
    { fullName: "N. Dlamini", email: "n.dlamini@acmecivils.example" },
    { fullName: "P. van Wyk", email: null },
  ],
  contactEmail: "info@acmecivils.example",
};

const showcaseEntry = {
  id: "show-1",
  slug: "acme-civils-pty-ltd",
  displayName: "Acme Civils",
  shortDescription: "Roads and stormwater.",
  logoUrl: null,
  websiteUrl: "https://acmecivils.example",
  industriesServed: ["Construction"],
  provincesServed: ["Gauteng"],
  companyType: "PTY_LTD",
  bbbeeLevel: 1,
  certifications: ["CIDB 7CE"],
};

function leaderboard(rows: unknown[]) {
  return {
    data: rows,
    meta: {
      total: rows.length,
      page: 1,
      per_page: 50,
      total_pages: 1,
      mode: "company",
      has_next: false,
      has_prev: false,
    },
  };
}

/* ------------------------------------------------------------------ *
 * T1 — identity resolution (R-S4)
 * ------------------------------------------------------------------ */

describe("slugComparableName", () => {
  /**
   * The examples come from the parent's own doc comment at
   * `src/lib/utils/company-name.ts:5-6` and from the `(Pty) Ltd` case that
   * makes H2 bite in production.
   */
  it("ignores the punctuation the parent's slug generator deletes", () => {
    expect(slugComparableName("Acme Civils (Pty) Ltd")).toBe(
      slugComparableName("Acme Civils Pty Ltd"),
    );
    expect(slugComparableName("- (Nkululeko Trust) -")).toBe("nkululeko trust");
    expect(slugComparableName("ABC  Trading   CC")).toBe("abc trading cc");
  });

  it("does not collapse two genuinely different names", () => {
    expect(slugComparableName("Acme Civils")).not.toBe(
      slugComparableName("Acme Civil Works"),
    );
  });
});

describe("deslugForSearch", () => {
  it("turns a slug back into a search term", () => {
    expect(deslugForSearch("acme-civils-pty-ltd")).toBe("acme civils pty ltd");
  });

  it("collapses runs of hyphens rather than emitting blank words", () => {
    expect(deslugForSearch("abc--trading")).toBe("abc trading");
  });
});

describe("awardSlugFromName", () => {
  /**
   * The two surfaces slug a supplier from different strings: the leaderboard
   * from `normalizeCompanyName` output, the workbench from the raw
   * `supplier_name`. Reproducing the leaderboard's spelling is the only way a
   * workbench row can be matched to a company on the list.
   */
  it("spells '&' the way the normalised name does", () => {
    expect(awardSlugFromName("ABC & Sons")).toBe("abc-and-sons");
    // Which is exactly what the workbench's raw-name slug does not do.
    expect(
      "ABC & Sons"
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    ).toBe("abc-sons");
  });

  it("treats brackets, slashes and dashes as separators, and drops the rest", () => {
    expect(awardSlugFromName("Acme Civils (Pty) Ltd")).toBe(
      "acme-civils-pty-ltd",
    );
    expect(awardSlugFromName("Bo/Kaap Works")).toBe("bo-kaap-works");
    expect(awardSlugFromName("R.M. Trading")).toBe("rm-trading");
  });
});

describe("slugSearchTerms", () => {
  /**
   * A slug is not a substring of the name it came from: `q` is matched
   * against the raw `supplier_name` while the slug is built from the
   * normalised one, so `acme civils pty ltd` finds `ACME CIVILS (PTY) LTD`
   * nowhere. The fallbacks stop before the first legal-form token.
   */
  it("falls back to the words before the first legal-form token", () => {
    expect(slugSearchTerms("acme-civils-pty-ltd")).toEqual([
      "acme civils pty ltd",
      "acme civils",
      "acme",
    ]);
  });

  it("stops before an 'and' that only the slug spells out", () => {
    expect(slugSearchTerms("abc-and-sons")).toEqual([
      "abc and sons",
      "abc",
      "abc and",
    ]);
  });

  it("returns the name itself when nothing in it is slug-only", () => {
    expect(slugSearchTerms("beta-roadworks")).toEqual([
      "beta roadworks",
      "beta",
    ]);
  });

  it("returns nothing for an empty slug rather than a blank term", () => {
    expect(slugSearchTerms("")).toEqual([]);
  });
});

describe("supplier profile — identity resolution", () => {
  it("selects the row whose slug matches exactly, not the first row", async () => {
    // The near miss ranks first because it has more award value. Picking it
    // would render the wrong company's record under the requested slug.
    const { endpoint } = harness(() =>
      jsonResponse(leaderboard([acmeHoldings, acme])),
    );
    const identity = await endpoint.resolveSupplier("acme-civils-pty-ltd");
    expect(identity.name).toBe("Acme Civils (Pty) Ltd");
    expect(identity.slug).toBe("acme-civils-pty-ltd");
    expect(identity.company.totalAwards).toBe(42);
  });

  it("raises not-found rather than guessing when nothing matches", async () => {
    const { endpoint } = harness(() =>
      jsonResponse(leaderboard([acmeHoldings])),
    );
    await expect(
      endpoint.resolveSupplier("acme-civils-pty-ltd"),
    ).rejects.toMatchObject({ kind: "not-found" });
  });

  it("searches the leaderboard mode with the de-hyphenated slug", async () => {
    const { endpoint, fetchImpl } = harness(() =>
      jsonResponse(leaderboard([acme])),
    );
    await endpoint.resolveSupplier("acme-civils-pty-ltd");
    const [url] = calls(fetchImpl)[0];
    expect(url).toContain("mode=company");
    expect(url).toContain("q=acme+civils+pty+ltd");
    // The route clamps per_page to 50; asking for less would let a common
    // search term push the requested company off the scanned page.
    expect(url).toContain("per_page=50");
  });

  /**
   * A leaderboard that filters the way the parent does.
   *
   * `q` is substring-matched against the **raw** `tender_awards.supplier_name`
   * (`company-intelligence.ts:99`), while the row's `name` and `slug` are
   * built from the normalised name (`company-intelligence.ts:426-434`). Every
   * other fixture in this file answers every search with the same rows, which
   * is why the mismatch between those two strings went unnoticed.
   */
  function parentLeaderboard(entries: { raw: string; row: unknown }[]) {
    return (url: string) => {
      const q = new URL(url).searchParams.get("q") ?? "";
      return jsonResponse(
        leaderboard(
          entries
            .filter((entry) =>
              entry.raw.toLowerCase().includes(q.toLowerCase()),
            )
            .map((entry) => entry.row),
        ),
      );
    };
  }

  it("resolves a (Pty) Ltd company, whose slug matches no substring of its stored name", async () => {
    // The commonest South African legal form. The stored award row says
    // "Acme Civils (Pty) Ltd"; the slug says "acme-civils-pty-ltd"; searching
    // for "acme civils pty ltd" matches nothing at all.
    const { endpoint, fetchImpl } = harness(
      parentLeaderboard([
        {
          raw: "Acme Civils (Pty) Ltd",
          row: { ...acme, name: "ACME CIVILS PTY LTD" },
        },
      ]),
    );
    const identity = await endpoint.resolveSupplier("acme-civils-pty-ltd");
    expect(identity.name).toBe("ACME CIVILS PTY LTD");
    // The full deslug is still tried first, so the narrowest search that can
    // work is the one used when it does work.
    expect(calls(fetchImpl)).toHaveLength(2);
    expect(calls(fetchImpl)[0][0]).toContain("q=acme+civils+pty+ltd");
    expect(calls(fetchImpl)[1][0]).toContain("q=acme+civils");
  });

  it("resolves a company whose name holds '&', which the slug spells 'and'", async () => {
    const abc = {
      ...acme,
      name: "ABC AND SONS",
      slug: "abc-and-sons",
      enrichment: undefined,
    };
    const { endpoint } = harness(
      parentLeaderboard([{ raw: "ABC & Sons", row: abc }]),
    );
    const identity = await endpoint.resolveSupplier("abc-and-sons");
    expect(identity.slug).toBe("abc-and-sons");
    expect(identity.name).toBe("ABC AND SONS");
  });

  it("still requires an exact slug match on the broadened search", async () => {
    // A shorter term returns more companies, so the guard that matters is the
    // one that was already there: the near miss must not be picked up.
    const { endpoint } = harness(
      parentLeaderboard([
        { raw: "Acme Civils Holdings", row: acmeHoldings },
        { raw: "Acme Civil Works", row: { ...acme, slug: "acme-civil-works" } },
      ]),
    );
    await expect(
      endpoint.resolveSupplier("acme-civils-pty-ltd"),
    ).rejects.toMatchObject({ kind: "not-found" });
  });

  it("reads the snake_case meta this route returns, not camelCase (H4)", async () => {
    // A camelCase meta would mean the schema silently accepted the wrong
    // route's envelope. `.passthrough()` on meta must not hide a missing key.
    const { endpoint } = harness(() =>
      jsonResponse({
        data: [acme],
        meta: {
          total: 1,
          page: 1,
          perPage: 50,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      }),
    );
    await expect(
      endpoint.resolveSupplier("acme-civils-pty-ltd"),
    ).rejects.toMatchObject({ kind: "malformed" });
  });
});

/* ------------------------------------------------------------------ *
 * T2 — the five remaining reads
 * ------------------------------------------------------------------ */

describe("supplier profile — forensic workbench row (contract B)", () => {
  it("reads the camelCase meta this route returns (H4)", async () => {
    // Contract A's meta is snake_case for the same concepts. Reading one
    // shape on both routes would produce `undefined` on one of them.
    const { endpoint, fetchImpl } = harness(() =>
      jsonResponse(forensicSearch([acmeForensicRow])),
    );
    const result = await endpoint.getForensicRow(
      "Acme Civils (Pty) Ltd",
      "acme-civils-pty-ltd",
    );
    expect(result.preview).toBe(false);
    expect(result.access.capabilities.advancedFilters).toBe(true);
    expect(result.row?.beeLevel).toBe("Level 1");
    const [url] = calls(fetchImpl)[0];
    expect(url).toContain("mode=supplier");
  });

  it("reports preview and a missing row separately (H6)", async () => {
    // Under preview the route returns at most 8 rows on page 1, so an absent
    // row is a plan limit rather than an absence of records. Collapsing the
    // two would let the screen say "not recorded" about a paywall.
    const { endpoint } = harness(() =>
      jsonResponse(forensicSearch([], true, false)),
    );
    const result = await endpoint.getForensicRow("Acme Civils", "acme-civils");
    expect(result.row).toBeNull();
    expect(result.preview).toBe(true);
    expect(result.access.capabilities.advancedFilters).toBe(false);
  });

  it("does not return another company's row just because it came back", async () => {
    // The near miss is a real, different supplier: both its own slug and the
    // leaderboard spelling of its name differ from the one asked for.
    const { endpoint } = harness(() =>
      jsonResponse(
        forensicSearch([
          {
            ...acmeForensicRow,
            name: "Acme Civils Holdings",
            slug: "acme-civils-holdings",
          },
        ]),
      ),
    );
    const result = await endpoint.getForensicRow(
      "Acme Civils (Pty) Ltd",
      "acme-civils-pty-ltd",
    );
    expect(result.row).toBeNull();
  });

  it("matches a row whose slug spells '&' differently from the leaderboard's", async () => {
    // The workbench slugs the raw `supplier_name` (`forensic-search.ts:643`)
    // and the leaderboard the normalised one, so the same company is
    // `abc-sons` on one route and `abc-and-sons` on the other. Comparing only
    // `row.slug` means the forensic panel is empty for every supplier whose
    // name holds an ampersand.
    const { endpoint } = harness(() =>
      jsonResponse(
        forensicSearch([
          {
            ...acmeForensicRow,
            id: "supplier:abc-sons",
            name: "ABC & Sons",
            slug: "abc-sons",
          },
        ]),
      ),
    );
    const result = await endpoint.getForensicRow(
      "ABC AND SONS",
      "abc-and-sons",
    );
    expect(result.row?.slug).toBe("abc-sons");
    expect(result.row?.beeLevel).toBe("Level 1");
  });

  it("retries with a shorter term when the canonical name matches nothing", async () => {
    // This route substring-matches `q` against the raw column too
    // (`forensic-search.ts:210-217`), so the canonical uppercase name and the
    // full deslug both miss a stored "Acme Civils (Pty) Ltd".
    const seen: string[] = [];
    const { endpoint } = harness((url) => {
      const q = new URL(url).searchParams.get("q") ?? "";
      seen.push(q);
      const hit = "Acme Civils (Pty) Ltd"
        .toLowerCase()
        .includes(q.toLowerCase());
      return jsonResponse(forensicSearch(hit ? [acmeForensicRow] : []));
    });
    const result = await endpoint.getForensicRow(
      "ACME CIVILS PTY LTD",
      "acme-civils-pty-ltd",
    );
    expect(result.row?.slug).toBe("acme-civils-pty-ltd");
    expect(seen).toEqual([
      "ACME CIVILS PTY LTD",
      "acme civils pty ltd",
      "acme civils",
    ]);
  });

  it("does not retry under preview, where a broader term cannot help", async () => {
    // Preview caps the response at 8 rows on page 1, so a wider search only
    // costs requests.
    const seen: string[] = [];
    const { endpoint } = harness((url) => {
      seen.push(new URL(url).searchParams.get("q") ?? "");
      return jsonResponse(forensicSearch([], true, false));
    });
    const result = await endpoint.getForensicRow(
      "ACME CIVILS PTY LTD",
      "acme-civils-pty-ltd",
    );
    expect(result.row).toBeNull();
    expect(result.preview).toBe(true);
    expect(seen).toHaveLength(1);
  });
});

describe("supplier profile — public record (contract C)", () => {
  it("calls /api/forensic/supplier/<slug>, the path that exists (H1)", async () => {
    const { endpoint, fetchImpl } = harness(() => jsonResponse(publicRecord));
    await endpoint.getPublicRecord(
      "acme-civils-pty-ltd",
      "Acme Civils (Pty) Ltd",
    );
    const [url] = calls(fetchImpl)[0];
    expect(url).toContain("/api/forensic/supplier/acme-civils-pty-ltd");
    // The tools/ path does not exist; a client there gets a 404 that reads as
    // a statement about the company rather than about the client.
    expect(url).not.toContain("/api/tools/forensic-analysis/supplier");
  });

  it("never sends x-pro-access (H3)", async () => {
    // It is a client-assertable access gate on an unauthenticated route.
    // Asserting it is privilege escalation by header, not a feature.
    const { endpoint, fetchImpl } = harness(() => jsonResponse(publicRecord));
    await endpoint.getPublicRecord(
      "acme-civils-pty-ltd",
      "Acme Civils (Pty) Ltd",
    );
    const [, init] = calls(fetchImpl)[0];
    const headers = init.headers as Record<string, string>;
    const names = Object.keys(headers).map((key) => key.toLowerCase());
    expect(names).not.toContain("x-pro-access");
  });

  it("accepts a name that differs only in the punctuation slugs delete", async () => {
    // The route echoes back its own deslugified name — "Acme Civils Pty Ltd"
    // — where the leaderboard's canonical name is "Acme Civils (Pty) Ltd".
    // Those are the same company and must not read as a mismatch.
    const { endpoint } = harness(() => jsonResponse(publicRecord));
    const record = await endpoint.getPublicRecord(
      "acme-civils-pty-ltd",
      "Acme Civils (Pty) Ltd",
    );
    expect(record.matched).toBe(true);
    expect(record.cipcData?.registrationNumber).toBe("2014/123456/07");
  });

  it("empties every field when the route resolved a different company (H2)", async () => {
    const { endpoint } = harness(() =>
      jsonResponse({ ...publicRecord, supplierName: "Beta Roadworks" }),
    );
    const record = await endpoint.getPublicRecord(
      "acme-civils-pty-ltd",
      "Acme Civils (Pty) Ltd",
    );
    expect(record.matched).toBe(false);
    // Emptied in the endpoint, so a panel added later cannot render another
    // company's registration number by forgetting to check the flag.
    expect(record.cipcData).toBeNull();
    expect(record.awardTimeline).toEqual([]);
    expect(record.forensicFlags).toEqual([]);
    expect(record.forensicRiskScore).toBeNull();
    expect(record.flagCount).toBe(0);
  });

  it("reports both caps the anonymous variant imposes (H3)", async () => {
    const timeline = Array.from({ length: 10 }, () => ({
      amount: 1,
      awardDate: "2026-01-01T00:00:00.000Z",
      tenderTitle: "t",
      department: "d",
    }));
    const { endpoint } = harness(() =>
      jsonResponse({ ...publicRecord, awardTimeline: timeline }),
    );
    const record = await endpoint.getPublicRecord(
      "acme-civils-pty-ltd",
      "Acme Civils (Pty) Ltd",
    );
    expect(record.timelineAtCap).toBe(true);
    // flagCount 4 against 1 returned flag: the rest are withheld, not absent.
    expect(record.flagsAtCap).toBe(true);
  });

  it("normalises a Decimal compliance score arriving as a string", async () => {
    const { endpoint } = harness(() =>
      jsonResponse({
        ...publicRecord,
        cipcData: { ...publicRecord.cipcData, complianceScore: "71.5" },
      }),
    );
    const record = await endpoint.getPublicRecord(
      "acme-civils-pty-ltd",
      "Acme Civils (Pty) Ltd",
    );
    expect(record.cipcData?.complianceScore).toBeCloseTo(71.5);
  });
});

describe("supplier profile — entity context (contract D)", () => {
  it("sends name, never slug (H7)", async () => {
    // The route's slug branch deslugifies as naively as contract C, so
    // passing the slug would reintroduce H2 on a route that offers a way out.
    const { endpoint, fetchImpl } = harness(() => jsonResponse(entityContext));
    await endpoint.getEntityContext("Acme Civils (Pty) Ltd");
    const [url] = calls(fetchImpl)[0];
    expect(url).toContain("name=Acme+Civils+%28Pty%29+Ltd");
    expect(url).not.toContain("slug=");
    expect(url).toContain("mode=supplier");
  });

  it("returns the restriction overlay with the parent's own label", async () => {
    const { endpoint } = harness(() => jsonResponse(entityContext));
    const context = await endpoint.getEntityContext("Acme Civils (Pty) Ltd");
    expect(context.restriction?.label).toBe(
      "No restricted supplier records in source data",
    );
    expect(context.categories).toEqual(["Civil engineering", "Roads"]);
    expect(context.provinceHealth).toHaveLength(1);
  });

  it("lets a 403 propagate rather than returning an empty context", async () => {
    // A caught-and-emptied 403 is indistinguishable from a company with no
    // recorded provinces. The screen must be able to name the plan.
    const { endpoint } = harness(() =>
      jsonResponse(
        { error: "Forensic entity context requires an active subscription." },
        403,
      ),
    );
    await expect(
      endpoint.getEntityContext("Acme Civils (Pty) Ltd"),
    ).rejects.toMatchObject({ kind: "forbidden" });
  });
});

describe("supplier profile — report access (contract F)", () => {
  it("marks an all-false body as not established (H9)", async () => {
    // The same body means anonymous, unresolvable slug, and internal error.
    const { endpoint } = harness(() =>
      jsonResponse({
        isPro: false,
        isPurchased: false,
        isClaimed: false,
        pendingForCurrentUser: false,
        hasApprovedClaimForCurrentUser: false,
      }),
    );
    const flags = await endpoint.getReportAccess("acme-civils-pty-ltd");
    expect(flags.established).toBe(false);
  });

  it("marks a body with any positive as established", async () => {
    const { endpoint } = harness(() =>
      jsonResponse({
        isPro: true,
        isPurchased: false,
        isClaimed: false,
        pendingForCurrentUser: false,
        hasApprovedClaimForCurrentUser: false,
      }),
    );
    const flags = await endpoint.getReportAccess("acme-civils-pty-ltd");
    expect(flags.established).toBe(true);
    expect(flags.isPro).toBe(true);
  });
});

describe("supplier profile — contacts (contract G)", () => {
  it("reads directors and the contact email", async () => {
    const { endpoint, fetchImpl } = harness(() => jsonResponse(contacts));
    const result = await endpoint.getContacts("acme-civils-pty-ltd");
    expect(result.directors).toHaveLength(2);
    expect(result.contactEmail).toBe("info@acmecivils.example");
    expect(result.resolved).toBe(true);
    const [url] = calls(fetchImpl)[0];
    expect(url).toContain("target=acme-civils-pty-ltd");
  });

  it("marks an empty 200 as unresolved, not as 'no directors' (H10)", async () => {
    const { endpoint } = harness(() =>
      jsonResponse({ directors: [], contactEmail: null }),
    );
    const result = await endpoint.getContacts("acme-civils-pty-ltd");
    expect(result.resolved).toBe(false);
  });

  it("lets the 403 propagate so the screen can name the plan", async () => {
    const { endpoint } = harness(() =>
      jsonResponse(
        {
          error: "A Starter plan or higher is required",
          code: "JV_SUBSCRIPTION_REQUIRED",
        },
        403,
      ),
    );
    await expect(
      endpoint.getContacts("acme-civils-pty-ltd"),
    ).rejects.toMatchObject({ kind: "forbidden" });
  });
});

/* ------------------------------------------------------------------ *
 * T5 — pinned copy (R-S10)
 * ------------------------------------------------------------------ */

describe("supplier profile — copy", () => {
  it("uses the exact vetting vocabulary brief §8.4 prescribes", () => {
    // Quoted, not paraphrased: the brief lists these as the language to use
    // *instead of* declaring a company legitimate or illegitimate.
    expect(VERDICT.strongEvidence).toBe("Strong evidence available");
    expect(VERDICT.limitedPublicData).toBe("Limited public data");
    expect(VERDICT.potentialInconsistency).toBe(
      "Potential inconsistency detected",
    );
    expect(VERDICT.requiresManualVerification).toBe(
      "Requires manual verification",
    );
    expect(VERDICT.relevantAwardHistory).toBe("Relevant award history found");
    expect(VERDICT.noRelatedAwardHistory).toBe(
      "No related award history found",
    );
  });

  it("restates each known flag type as a fact, not an allegation", () => {
    expect(flagHeading("DEREGISTERED_ENTITY")).toBe(
      "Company register shows a status other than active",
    );
    expect(flagHeading("POOR_COMPLIANCE")).toBe(
      "Register compliance score is below the platform's threshold",
    );
    expect(flagHeading("NEW_ENTRANT_LARGE_AWARD")).toBe(
      "A large award is recorded soon after registration",
    );
    expect(flagHeading("DISQUALIFIED_DIRECTOR")).toBe(
      "A director record matches a disqualification list",
    );
  });

  it("humanises an unrecognised flag type rather than dropping it", () => {
    // Hiding a signal the parent sent is as dishonest as overstating one.
    expect(flagHeading("SOME_NEW_SIGNAL")).toBe("Some new signal");
    expect(flagHeading("")).toBe("Signal");
  });

  it("describes severity as signal strength, never as a verdict", () => {
    expect(severityLabel("critical")).toBe("Signal strength: Highest");
    expect(severityLabel("low")).toBe("Signal strength: Low");
    // An unknown severity still says something true rather than nothing.
    expect(severityLabel("unheard-of")).toBe("Signal strength: Recorded");
  });

  it("keeps the disclaimer explicit about what the signals are not", () => {
    expect(RISK_DISCLAIMER).toContain("not findings of wrongdoing");
    expect(RISK_DISCLAIMER).toContain("Verify independently");
  });

  it("describes every tier limit as being about the plan, not the company", () => {
    expect(TIER.previewRowMissing).toContain(
      "a plan limit, not an absence of records",
    );
    expect(TIER.advancedContextLocked).toContain("not available on your plan");
    expect(TIER.listOverlayLocked).toContain("active subscription");
  });

  it("discloses both caps the desktop cannot lift", () => {
    expect(CAPS.timeline).toContain("10 most recent");
    expect(CAPS.flags(4, 3)).toBe(
      "4 signals are recorded; the first 3 are shown.",
    );
  });

  it("gives every panel a provenance eyebrow naming its source class", () => {
    // Brief §9 asks the product to differentiate user-verified, public-source,
    // award-derived and unverified data. An eyebrow that named none of those
    // would satisfy the letter and miss the point.
    for (const value of Object.values(EYEBROW)) {
      expect(value).toMatch(
        /Award-derived|Public-source|Derived|User-supplied/,
      );
    }
  });

  it("contains no word that reads as an accusation", () => {
    // The whole module is scanned, so a future string cannot slip past by
    // living in a constant this file does not name individually.
    const strings: string[] = [];
    const walk = (value: unknown) => {
      if (typeof value === "string") strings.push(value);
      else if (typeof value === "function") strings.push(String(value(1, 1)));
      else if (value && typeof value === "object") {
        Object.values(value).forEach(walk);
      }
    };
    walk({
      VERDICT,
      VERDICT_DETAIL,
      FLAG_HEADINGS,
      SEVERITY_LABELS,
      RISK_DISCLAIMER,
      TIER,
      CAPS,
      EYEBROW,
    });
    expect(strings.length).toBeGreaterThan(20);
    for (const banned of [
      "fraud",
      "corrupt",
      "illegal",
      "guilty",
      "blacklisted",
    ]) {
      const offenders = strings.filter((text) =>
        text.toLowerCase().includes(banned),
      );
      expect(offenders).toEqual([]);
    }
  });
});

/* ------------------------------------------------------------------ *
 * T3 — composition root (R-S3)
 * ------------------------------------------------------------------ */

describe("supplier profile — wiring", () => {
  it("is constructed by the composition root alongside the list client", () => {
    // Every advertised route must mount in every build (REQ-16), which means
    // the route's client must exist unconditionally rather than being built
    // lazily by the screen.
    const wiring = createAuthWiring({
      desktopAuthEnabled: true,
      apiBaseUrl: "http://localhost:3000",
      credentialStore: {
        save: async () => {},
        loadAccessToken: async () => undefined,
        clear: async () => {},
      },
      transport: new ApiTransport({
        baseUrl: "http://localhost:3000",
        fetchImpl: vi.fn() as unknown as typeof fetch,
      }),
    });
    expect(wiring.supplierProfile).toBeInstanceOf(SupplierProfileEndpoint);
    // The list client keeps its own single-route identity; the profile is not
    // a subclass of it and must not have replaced it.
    expect(wiring.supplierIntelligence).toBeInstanceOf(
      SupplierIntelligenceEndpoint,
    );
    expect(wiring.supplierProfile).not.toBeInstanceOf(
      SupplierIntelligenceEndpoint,
    );
  });
});

/* ------------------------------------------------------------------ *
 * T4 — route and open affordance (R-S1, R-S2)
 * ------------------------------------------------------------------ */

/** Gated build: `isEnabled()` false is what opens the escape hatch. */
const gatedAuth = {
  isEnabled: () => false,
  login: vi.fn(),
  restoreSession: vi.fn(async () => undefined),
  logout: vi.fn(async () => undefined),
} as unknown as AuthPort;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes
        auth={gatedAuth}
        isAuthenticated={false}
        clients={stubApiClients()}
      />
    </MemoryRouter>,
  );
}

describe("supplier profile — route (R-S1)", () => {
  it("mounts its own screen rather than falling through to the catch-all", async () => {
    // The failure mode being guarded: a missing route matches `path="*"` and
    // silently redirects home, so the link would claim a screen it never
    // shows (REQ-16).
    renderAt("/suppliers/acme-civils-pty-ltd");
    expect(
      await screen.findByText(/back to supplier intelligence/i),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Command Centre" }),
    ).toBeNull();
  });

  it("leaves the list route working, since the static segment outranks it", () => {
    renderAt("/suppliers");
    expect(
      screen.getByRole("heading", { name: "Supplier Intelligence" }),
    ).toBeVisible();
  });
});

describe("supplier intelligence — open affordance (R-S2)", () => {
  function listOver(rows: unknown[], onOpen?: (slug: string) => void) {
    const fetchImpl = vi.fn(async () => jsonResponse(leaderboard(rows)));
    const endpoint = {
      search: async () => ({
        companies: rows as never[],
        total: rows.length,
        page: 1,
        totalPages: 1,
        hasNext: false,
      }),
    } as unknown as ListEndpoint;
    render(
      <SupplierIntelligence endpoint={endpoint} onOpenSupplier={onOpen} />,
    );
    return fetchImpl;
  }

  it("opens the row's own slug, not its name or its rank", async () => {
    const onOpen = vi.fn();
    listOver([acme], onOpen);
    await userEvent.click(
      await screen.findByRole("button", { name: "Acme Civils (Pty) Ltd" }),
    );
    expect(onOpen).toHaveBeenCalledWith("acme-civils-pty-ltd");
  });

  it("opens from the keyboard, because a button is focusable by default", async () => {
    const onOpen = vi.fn();
    listOver([acme], onOpen);
    const control = await screen.findByRole("button", {
      name: "Acme Civils (Pty) Ltd",
    });
    control.focus();
    await userEvent.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledWith("acme-civils-pty-ltd");
  });

  it("renders no control at all without a callback", async () => {
    // A disabled or no-op control would be the dishonest affordance REQ-16
    // forbids. The name still renders — as text.
    listOver([acme]);
    expect(await screen.findByText("Acme Civils (Pty) Ltd")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Acme Civils (Pty) Ltd" }),
    ).toBeNull();
  });
});

describe("supplier profile — showcase directory (contract H)", () => {
  it("reads the bare array this route returns and filters to the slug", async () => {
    const { endpoint, fetchImpl } = harness(() =>
      jsonResponse([{ ...showcaseEntry, slug: "other" }, showcaseEntry]),
    );
    const entry = await endpoint.getShowcaseEntry("acme-civils-pty-ltd");
    expect(entry?.displayName).toBe("Acme Civils");
    const [url] = calls(fetchImpl)[0];
    expect(url).toContain("limit=20");
  });

  it("returns null when the company is not featured", async () => {
    // Absence from a 20-row featured list says nothing about a company, so
    // the caller renders no panel rather than a negative claim.
    const { endpoint } = harness(() => jsonResponse([]));
    expect(await endpoint.getShowcaseEntry("acme-civils-pty-ltd")).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * T6 — screen composition (R-S6, R-S7, R-S8)
 * ------------------------------------------------------------------ */

type ProfileEndpointStub = Parameters<typeof SupplierProfile>[0]["endpoint"];
type ProfileOverrides = Partial<Record<string, unknown>>;

/** Every read resolved with a working default; override one at a time. */
function profileEndpoint(
  overrides: ProfileOverrides = {},
): ProfileEndpointStub {
  return {
    resolveSupplier: async () => ({
      slug: "acme-civils-pty-ltd",
      name: "Acme Civils (Pty) Ltd",
      company: acme,
    }),
    getForensicRow: async () => ({
      row: acmeForensicRow,
      preview: false,
      access: access(true),
    }),
    getPublicRecord: async () => ({
      matched: true,
      supplierName: "Acme Civils Pty Ltd",
      cipcData: { ...publicRecord.cipcData, complianceScore: 71 },
      forensicRiskScore: 34,
      forensicFlags: publicRecord.forensicFlags,
      flagCount: 4,
      awardTimeline: publicRecord.awardTimeline,
      timelineAtCap: false,
      flagsAtCap: true,
    }),
    getEntityContext: async () => ({
      provinces: entityContext.data.provinces,
      categories: entityContext.data.categories,
      intelligence: entityContext.data.intelligence,
      provinceHealth: entityContext.data.provinceHealth,
      restriction: entityContext.data.restriction,
      access: access(true),
    }),
    getReportAccess: async () => ({
      established: true,
      isPro: true,
      isPurchased: false,
      isClaimed: false,
      pendingForCurrentUser: false,
      hasApprovedClaimForCurrentUser: false,
    }),
    getContacts: async () => ({ ...contacts, resolved: true }),
    getShowcaseEntry: async () => showcaseEntry,
    ...overrides,
  } as unknown as ProfileEndpointStub;
}

function renderProfile(overrides: ProfileOverrides = {}) {
  render(
    <SupplierProfile
      endpoint={profileEndpoint(overrides)}
      slug="acme-civils-pty-ltd"
    />,
  );
}

/**
 * Waits until no panel is still loading.
 *
 * Seven independent loads settle on their own schedules, so awaiting one
 * element proves nothing about the rest — a test that did so would assert
 * against a half-rendered screen and pass or fail on timing. `AsyncSection`
 * gives every loading state `role="status"`, so their absence is the honest
 * signal that the screen has finished.
 */
async function settled() {
  await waitFor(() => expect(screen.queryAllByRole("status")).toHaveLength(0));
}

const PANEL_ORDER = [
  "Registration details",
  "Contact details",
  "Operating areas and categories",
  "Award history",
  "Known buyers and award frequency",
  "Risk, restriction and compliance signals",
  "Data confidence",
  "Listed in the Tenders-SA company showcase",
];

describe("supplier profile screen — composition (R-S6)", () => {
  it("presents the brief's vetting list in order", async () => {
    renderProfile();
    await settled();
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((node) => node.textContent);
    expect(headings).toEqual(PANEL_ORDER);
  });

  it("renders the hero from the resolved row, with no request of its own", async () => {
    renderProfile();
    expect(
      await screen.findByRole("heading", { name: "Acme Civils (Pty) Ltd" }),
    ).toBeVisible();
    expect(screen.getByText("42")).toBeVisible();
    expect(screen.getByText("#3")).toBeVisible();
    expect(screen.getByText("2026")).toBeVisible();
  });

  it("shows the registration record contract C returned", async () => {
    renderProfile();
    await settled();
    expect(screen.getByText("2014/123456/07")).toBeVisible();
    expect(screen.getByText("In Business")).toBeVisible();
    expect(screen.getByText("12 Kruger Road, Midrand")).toBeVisible();
  });

  it("shows contacts, award rows, buyers and the restriction label", async () => {
    renderProfile();
    await settled();
    expect(screen.getByText("N. Dlamini")).toBeVisible();
    expect(screen.getByText("N1 resurfacing, section 12")).toBeVisible();
    expect(
      screen.getByText("No restricted supplier records in source data"),
    ).toBeVisible();
  });

  it("gives every panel a provenance eyebrow (R-S8)", async () => {
    renderProfile();
    await settled();
    for (const eyebrow of Object.values(EYEBROW)) {
      expect(screen.getAllByText(eyebrow).length).toBeGreaterThan(0);
    }
  });

  it("carries the risk disclaimer whenever signals render (R-S10)", async () => {
    renderProfile();
    await settled();
    // The disclaimer sits outside the AsyncSection deliberately: it is true
    // of the panel whether or not the upstream answered, so it must not
    // disappear while the signals it qualifies are loading.
    expect(screen.getByText(RISK_DISCLAIMER)).toBeVisible();
    expect(screen.getByText(VERDICT.potentialInconsistency)).toBeVisible();
    expect(
      screen.getByText("A large award is recorded soon after registration"),
    ).toBeVisible();
    expect(screen.getByText("Signal strength: High")).toBeVisible();
  });

  it("renders no accusatory word anywhere on the screen", async () => {
    renderProfile();
    await settled();
    const text = document.body.textContent?.toLowerCase() ?? "";
    for (const banned of [
      "fraud",
      "corrupt",
      "illegal",
      "guilty",
      "blacklisted",
    ]) {
      expect(text).not.toContain(banned);
    }
  });

  it("says the awards cannot be opened, rather than leaving a dead link (L1)", async () => {
    renderProfile();
    await settled();
    expect(screen.getByText(/carries no tender reference/i)).toBeVisible();
  });
});

describe("supplier profile screen — absent data (R-S7)", () => {
  const emptyCompany = {
    ...acme,
    totalAwards: 7,
    lastActiveYear: null,
    lastKnownBuyer: null,
    provinces: [],
    enrichment: undefined,
  };

  function renderEmpty() {
    renderProfile({
      resolveSupplier: async () => ({
        slug: "acme-civils-pty-ltd",
        name: "Acme Civils (Pty) Ltd",
        company: emptyCompany,
      }),
      getForensicRow: async () => ({
        row: null,
        preview: false,
        access: access(true),
      }),
      getPublicRecord: async () => ({
        matched: true,
        supplierName: "Acme Civils Pty Ltd",
        cipcData: null,
        forensicRiskScore: null,
        forensicFlags: [],
        flagCount: 0,
        awardTimeline: [],
        timelineAtCap: false,
        flagsAtCap: false,
      }),
      getEntityContext: async () => ({
        provinces: [],
        categories: [],
        intelligence: null,
        provinceHealth: [],
        restriction: null,
        access: access(true),
      }),
      getContacts: async () => ({
        directors: [],
        contactEmail: null,
        resolved: false,
      }),
      getShowcaseEntry: async () => null,
    });
  }

  it("keeps every panel and its heading, so nothing looks unasked", async () => {
    renderEmpty();
    await settled();
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((node) => node.textContent);
    // The showcase panel is the one honest omission: absence from a 20-row
    // featured list says nothing about a company (R-S15).
    expect(headings).toEqual(PANEL_ORDER.slice(0, 7));
  });

  it("says 'Not recorded' rather than leaving a blank or writing 0", async () => {
    renderEmpty();
    await settled();
    expect(screen.getAllByText("Not recorded").length).toBeGreaterThan(5);
    // "no directors were recorded" and "nobody counted" are different claims.
    expect(screen.queryByText("0")).toBeNull();
  });

  it("does not claim there is no award history when the leaderboard has some", async () => {
    // The leaderboard records 7 awards; the detail route returned none. That
    // is a gap in our view, not a fact about the company.
    renderEmpty();
    await settled();
    expect(
      screen.getAllByText(VERDICT_DETAIL.awardsWithoutDetail).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(VERDICT.noRelatedAwardHistory)).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * T7 — partial-failure isolation (R-S5)
 * ------------------------------------------------------------------ */

function failing(kind: "server" | "forbidden" | "not-found" = "server") {
  return async () => {
    throw new ApiError({ kind, message: "upstream is down" });
  };
}

describe("supplier profile screen — partial failure (R-S5)", () => {
  /**
   * One test per upstream. The behaviour being pinned is the one already
   * proven for `ApplicationWorkspace` at `module-screens.test.tsx:1041-1056`:
   * a screen assembled from several parent reads must lose the panel whose
   * read failed and keep the rest. A composed single request would fail all
   * seven together and the user would be told nothing is known about a
   * company the platform has full award history for.
   */
  const upstreams = [
    ["getForensicRow", /could not load risk signals/i],
    ["getPublicRecord", /could not load registration details/i],
    ["getEntityContext", /could not load operating areas/i],
    ["getReportAccess", /could not load your access to this report/i],
    ["getContacts", /could not load partner contact details/i],
    ["getShowcaseEntry", /could not load the company showcase listing/i],
  ] as const;

  it.each(upstreams)(
    "keeps the hero and the other panels when %s fails",
    async (method, message) => {
      renderProfile({ [method]: failing() });
      await settled();

      // The failing panel says so, in its own words.
      const alerts = screen.getAllByRole("alert");
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.some((node) => message.test(node.textContent ?? ""))).toBe(
        true,
      );

      // The hero is drawn from the resolved identity and is unaffected.
      expect(
        screen.getByRole("heading", { name: "Acme Civils (Pty) Ltd" }),
      ).toBeVisible();
      // And every panel heading survives, so the reader can still see which
      // questions were asked.
      const headings = screen
        .getAllByRole("heading", { level: 2 })
        .map((node) => node.textContent);
      expect(headings.length).toBeGreaterThanOrEqual(7);
    },
  );

  it("shows an error only in the panel that failed, not across the screen", async () => {
    renderProfile({ getContacts: failing() });
    await settled();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    // Neighbouring panels still carry their real data.
    expect(screen.getByText("2014/123456/07")).toBeVisible();
    expect(screen.getByText("N1 resurfacing, section 12")).toBeVisible();
  });

  it("fails the whole screen only when identity itself fails", async () => {
    // Without a canonical name there is no supplier to describe, so an error
    // for the whole screen is the truthful outcome rather than a degradation.
    renderProfile({ resolveSupplier: failing("not-found") });
    await settled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /this supplier could not be found/i,
    );
    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *
 * T8 — tier degradation and the slug verdict (R-S9, R-S11)
 * ------------------------------------------------------------------ */

describe("supplier profile screen — tier degradation (R-S9)", () => {
  it("names the plan when entity context is 403, and does not say 'no data'", async () => {
    renderProfile({ getEntityContext: failing("forbidden") });
    await settled();
    const alert = screen
      .getAllByRole("alert")
      .find((node) =>
        /restricted-supplier and market context/i.test(node.textContent ?? ""),
      );
    expect(alert).toBeDefined();
    expect(alert).toHaveTextContent(/your plan does not include/i);
    // A 403 is not retryable, so offering "Try again" would be a lie.
    expect(
      within(alert as HTMLElement).queryByRole("button", {
        name: /try again/i,
      }),
    ).toBeNull();
    expect(alert).toHaveAttribute("data-error-kind", "forbidden");
  });

  it("names the plan when contact details are 403", async () => {
    renderProfile({ getContacts: failing("forbidden") });
    await settled();
    expect(
      screen.getByText("Your plan does not include partner contact details."),
    ).toBeVisible();
    // Never the empty-state wording — that would be a claim about the company.
    expect(
      screen.queryByText("Contact details are not recorded for this company."),
    ).toBeNull();
  });

  it("calls a missing preview row a plan limit, not an absence of records", async () => {
    renderProfile({
      getForensicRow: async () => ({
        row: null,
        preview: true,
        access: access(false),
      }),
    });
    await settled();
    expect(screen.getByText(TIER.previewRowMissing)).toBeVisible();
    expect(screen.queryByText(TIER.notInWorkbench)).toBeNull();
  });

  it("says 'not recorded in the workbench' only when the plan is not the cause", async () => {
    renderProfile({
      getForensicRow: async () => ({
        row: null,
        preview: false,
        access: access(true),
      }),
    });
    await settled();
    expect(screen.getByText(TIER.notInWorkbench)).toBeVisible();
    expect(screen.queryByText(TIER.previewRowMissing)).toBeNull();
  });

  it("distinguishes withheld market context from absent market context (H5)", async () => {
    renderProfile({
      getForensicRow: async () => ({
        row: { ...acmeForensicRow, intelligence: null },
        preview: false,
        access: access(false),
      }),
      getEntityContext: async () => ({
        provinces: ["Gauteng"],
        categories: [],
        intelligence: null,
        provinceHealth: [],
        restriction: entityContext.data.restriction,
        access: access(false),
      }),
    });
    await settled();
    // `null` under a free plan means "withheld", which is a different claim
    // from "nothing was published".
    expect(screen.getAllByText(TIER.advancedContextLocked).length).toBe(2);
    expect(
      screen.queryByText(
        "No public reporting is recorded against this company.",
      ),
    ).toBeNull();
  });
});

describe("supplier profile screen — register mismatch (R-S11)", () => {
  it("asks for manual verification and shows none of the mismatched record", async () => {
    renderProfile({
      getPublicRecord: async () => ({
        matched: false,
        supplierName: "Beta Roadworks",
        cipcData: null,
        forensicRiskScore: null,
        forensicFlags: [],
        flagCount: 0,
        awardTimeline: [],
        timelineAtCap: false,
        flagsAtCap: false,
      }),
    });
    await settled();
    expect(
      screen.getAllByText(VERDICT.requiresManualVerification).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(VERDICT_DETAIL.registerMismatch).length,
    ).toBeGreaterThan(0);
    // Nothing from the other company reaches the screen.
    expect(screen.queryByText("2014/123456/07")).toBeNull();
    expect(screen.queryByText("N1 resurfacing, section 12")).toBeNull();
  });

  it("makes no claim about buyers either, since that timeline was emptied too", async () => {
    // The buyers panel derives from the same emptied timeline. "No buyer or
    // frequency detail is recorded here" would be a statement about the
    // company drawn from a record that was never trusted.
    renderProfile({
      getPublicRecord: async () => ({
        matched: false,
        supplierName: "Beta Roadworks",
        cipcData: null,
        forensicRiskScore: null,
        forensicFlags: [],
        flagCount: 0,
        awardTimeline: [],
        timelineAtCap: false,
        flagsAtCap: false,
      }),
    });
    await settled();
    const buyers = screen
      .getByRole("heading", { name: "Known buyers and award frequency" })
      .closest("section") as HTMLElement;
    expect(
      within(buyers).getByText(VERDICT_DETAIL.registerMismatch),
    ).toBeVisible();
    expect(
      screen.queryByText("No buyer or frequency detail is recorded here."),
    ).toBeNull();
  });
});

describe("supplier profile screen — report access (R-S14)", () => {
  it("renders an approved claim, which the access panel counted but never showed", async () => {
    renderProfile({
      getReportAccess: async () => ({
        established: true,
        isPro: false,
        isPurchased: false,
        isClaimed: false,
        pendingForCurrentUser: false,
        hasApprovedClaimForCurrentUser: true,
      }),
    });
    await settled();
    expect(
      screen.getByText("Your claim on this profile has been approved."),
    ).toBeVisible();
  });
});

/* ------------------------------------------------------------------ *
 * T9 — list enrichment and the optional overlay (R-S12, R-S13)
 * ------------------------------------------------------------------ */

describe("supplier intelligence list — enrichment already paid for (R-S12)", () => {
  function listEndpoint(rows: unknown[]) {
    const search = vi.fn(async () => ({
      companies: rows as never[],
      total: rows.length,
      page: 1,
      totalPages: 1,
      hasNext: false,
    }));
    return { search } as unknown as ListEndpoint & { search: typeof search };
  }

  it("renders website, address and compile date with no extra request", async () => {
    // All four have been arriving on every request the list has ever made;
    // only `description` was ever rendered.
    const endpoint = listEndpoint([acme]);
    render(<SupplierIntelligence endpoint={endpoint} />);
    expect(await screen.findByText("12 Kruger Road, Midrand")).toBeVisible();
    expect(screen.getByText("https://acmecivils.example")).toBeVisible();
    expect(screen.getByText(/last compiled/i)).toBeVisible();
    expect(screen.getByText(/verify before relying on it/i)).toBeVisible();
    expect(endpoint.search).toHaveBeenCalledTimes(1);
  });
});

describe("supplier intelligence list — forensic overlay (R-S13)", () => {
  function renderList(page: {
    rows: unknown[];
    preview: boolean;
    subscriber: boolean;
  }) {
    const endpoint = {
      search: async () => ({
        companies: [acme] as never[],
        total: 1,
        page: 1,
        totalPages: 1,
        hasNext: false,
      }),
    } as unknown as ListEndpoint;
    const forensic = {
      searchForensicSuppliers: vi.fn(async () => ({
        rows: page.rows,
        preview: page.preview,
        access: access(page.subscriber),
      })),
    };
    render(
      <SupplierIntelligence endpoint={endpoint} forensic={forensic as never} />,
    );
    return forensic;
  }

  it("merges risk, B-BBEE and OCPO signals when the response is not a preview", async () => {
    renderList({
      rows: [
        {
          ...acmeForensicRow,
          ocpo: { ...acmeForensicRow.ocpo, activeCount: 1 },
        },
      ],
      preview: false,
      subscriber: true,
    });
    expect(
      await screen.findByText(/Published risk indicator 34/),
    ).toBeVisible();
    expect(screen.getByText(/B-BBEE Level 1/)).toBeVisible();
    expect(
      screen.getByText(/1 active restricted-supplier record/),
    ).toBeVisible();
  });

  it("merges a row whose slug spells '&' differently from the list's", async () => {
    // Same slug-namespace split as `getForensicRow`: the workbench slugs the
    // raw supplier name, the leaderboard the normalised one. Keyed on
    // `row.slug` alone, the overlay silently matches nothing for any company
    // whose name holds an ampersand — and the list then looks like a company
    // with no risk data.
    const endpoint = {
      search: async () => ({
        companies: [
          { ...acme, name: "ABC AND SONS", slug: "abc-and-sons" },
        ] as never[],
        total: 1,
        page: 1,
        totalPages: 1,
        hasNext: false,
      }),
    } as unknown as ListEndpoint;
    const forensic = {
      searchForensicSuppliers: async () => ({
        rows: [{ ...acmeForensicRow, name: "ABC & Sons", slug: "abc-sons" }],
        preview: false,
        access: access(true),
      }),
    };
    render(
      <SupplierIntelligence endpoint={endpoint} forensic={forensic as never} />,
    );
    expect(
      await screen.findByText(/Published risk indicator 34/),
    ).toBeVisible();
  });

  it("skips the merge entirely under preview, with one line instead of blanks", async () => {
    // Preview returns at most 8 rows on page 1, so merging into a 20-row page
    // would leave most rows bare and read as "no risk data" when the cause is
    // the plan.
    renderList({ rows: [acmeForensicRow], preview: true, subscriber: false });
    expect(await screen.findByText(TIER.listOverlayLocked)).toBeVisible();
    expect(screen.queryByText(/Published risk indicator/)).toBeNull();
  });

  it("renders the list unchanged when no overlay port is supplied", async () => {
    const endpoint = {
      search: async () => ({
        companies: [acme] as never[],
        total: 1,
        page: 1,
        totalPages: 1,
        hasNext: false,
      }),
    } as unknown as ListEndpoint;
    render(<SupplierIntelligence endpoint={endpoint} />);
    expect(await screen.findByText("Acme Civils (Pty) Ltd")).toBeVisible();
    expect(screen.queryByText(TIER.listOverlayLocked)).toBeNull();
    expect(screen.queryByText(/Published risk indicator/)).toBeNull();
  });

  it("stays silent when the overlay request fails, rather than claiming anything", async () => {
    const endpoint = {
      search: async () => ({
        companies: [acme] as never[],
        total: 1,
        page: 1,
        totalPages: 1,
        hasNext: false,
      }),
    } as unknown as ListEndpoint;
    const forensic = {
      searchForensicSuppliers: async () => {
        throw new ApiError({ kind: "server", message: "down" });
      },
    };
    render(
      <SupplierIntelligence endpoint={endpoint} forensic={forensic as never} />,
    );
    expect(await screen.findByText("Acme Civils (Pty) Ltd")).toBeVisible();
    // No error banner: the list's own data is intact and the overlay's
    // absence makes no claim about any company.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(TIER.listOverlayLocked)).toBeNull();
  });
});

describe("supplier profile — derivations", () => {
  it("tallies buyers without inventing one for an unattributed award", () => {
    const summary = summariseBuyers([
      { amount: 100, awardDate: "2026-01-01", department: "SANRAL" },
      { amount: 50, awardDate: "2026-02-01", department: "SANRAL" },
      { amount: 25, awardDate: "2025-02-01", department: null },
    ]);
    expect(summary.buyers).toEqual([
      { buyer: "SANRAL", awards: 2, value: 150 },
    ]);
    expect(summary.unattributed).toBe(1);
  });

  it("skips an undated award rather than assigning it to this year", () => {
    const years = awardsPerYear([
      { amount: 1, awardDate: "2026-01-01" },
      { amount: 1, awardDate: null },
      { amount: 1, awardDate: "not-a-date" },
    ]);
    expect(years).toEqual([{ year: 2026, awards: 1 }]);
  });

  it("checks the register mismatch before anything else", () => {
    // Nothing was looked up, so "limited public data" would imply we looked
    // and found little — a different and untrue claim.
    expect(
      describeEvidence({
        registerMatched: false,
        hasRegisterData: false,
        timelineLength: 0,
        totalAwards: 0,
        confidenceScore: null,
      }).verdict,
    ).toBe(VERDICT.requiresManualVerification);
  });

  it("only says 'no related award history' when the leaderboard agrees", () => {
    expect(
      describeEvidence({
        registerMatched: true,
        hasRegisterData: true,
        timelineLength: 0,
        totalAwards: 0,
        confidenceScore: 0.9,
      }).verdict,
    ).toBe(VERDICT.noRelatedAwardHistory);
    expect(
      describeEvidence({
        registerMatched: true,
        hasRegisterData: true,
        timelineLength: 0,
        totalAwards: 9,
        confidenceScore: 0.9,
      }).verdict,
    ).toBe(VERDICT.limitedPublicData);
  });

  it("reserves 'strong evidence' for a matched register plus real confidence", () => {
    const base = {
      registerMatched: true,
      hasRegisterData: true,
      timelineLength: 3,
      totalAwards: 9,
    };
    expect(describeEvidence({ ...base, confidenceScore: 0.82 }).verdict).toBe(
      VERDICT.strongEvidence,
    );
    expect(describeEvidence({ ...base, confidenceScore: 0.4 }).verdict).toBe(
      VERDICT.relevantAwardHistory,
    );
    expect(describeEvidence({ ...base, confidenceScore: null }).verdict).toBe(
      VERDICT.relevantAwardHistory,
    );
    expect(
      describeEvidence({
        ...base,
        hasRegisterData: false,
        confidenceScore: 0.99,
      }).verdict,
    ).toBe(VERDICT.limitedPublicData);
  });
});
