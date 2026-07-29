/**
 * Supplier Intelligence — who has won this kind of work before.
 *
 * Refs: brief §6 (Supplier Intelligence, Award Data), §4.4, INT-A3
 * Parent route (read from source at `8ff2e4c2`):
 *   GET /api/tools/company-intelligence/search
 *     -> {data: CompanyLeaderboardItem[], meta:{total, page, per_page, total_pages, mode, has_next, has_prev}}
 *   Item shape: `CompanyLeaderboardItem` in `src/lib/data-access/company-intelligence.ts`
 *
 * This answers two of the brief's §2 questions directly — "has the buyer
 * awarded similar work before?" and "which companies have previously won
 * similar tenders?" — and feeds step 7 of the workflow, evaluating potential
 * suppliers or JV partners.
 *
 * **A third envelope, and snake_case.** This route returns `{data, meta}` with
 * `per_page` / `total_pages` / `has_next`, where the dashboard routes use
 * `{success, data}` and `/api/tenders` returns a bare domain key. Three
 * conventions, all live, none normalised — a shared envelope assumption would
 * fail on two of the three.
 *
 * The figures are **award history the platform already holds**, not a
 * recommendation. Nothing here is scored against the user's company, so the
 * screen presents it as evidence to interpret rather than advice to follow.
 */

import { z } from "zod";
import { AuthenticatedEndpoint } from "./base";

const companySchema = z
  .object({
    rank: z.number(),
    name: z.string(),
    slug: z.string(),
    totalAwards: z.number(),
    totalValue: z.number(),
    latestAwardDate: z.string().nullable(),
    lastActiveYear: z.number().nullable(),
    lastKnownBuyer: z.string().nullable(),
    provinces: z.array(z.string()),
    currency: z.string(),
    enrichment: z
      .object({
        website: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        headquartersAddress: z.string().nullable().optional(),
        /**
         * How confident the enrichment is. Surfaced so the screen can label
         * derived data as derived (brief §4.2) rather than presenting an
         * inferred description as fact.
         */
        confidenceScore: z.number().nullable().optional(),
        lastEnrichedAt: z.string().nullable().optional(),
      })
      .optional(),
  })
  .passthrough();

export type IntelligenceCompany = z.infer<typeof companySchema>;

const searchSchema = z.object({
  data: z.array(companySchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    per_page: z.number(),
    total_pages: z.number(),
    mode: z.string().optional(),
    has_next: z.boolean(),
    has_prev: z.boolean(),
  }),
});

export interface SupplierSearchResult {
  companies: IntelligenceCompany[];
  total: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
}

export interface SupplierSearchQuery {
  q?: string;
  page?: number;
  perPage?: number;
  province?: string;
  /** Free text; the route passes it through to the award index. */
  category?: string;
}

export class SupplierIntelligenceEndpoint extends AuthenticatedEndpoint {
  async search(
    query: SupplierSearchQuery = {},
    signal?: AbortSignal,
  ): Promise<SupplierSearchResult> {
    const body = await this.transport.request({
      method: "GET",
      path: "/api/tools/company-intelligence/search",
      query: {
        q: query.q || undefined,
        // `mode=company` selects the leaderboard search, which is the one
        // whose item shape this schema describes.
        mode: "company",
        page: query.page ?? 1,
        per_page: query.perPage ?? 20,
        province: query.province || undefined,
        category: query.category || undefined,
      },
      schema: searchSchema,
      headers: await this.authHeaders(),
      signal,
    });

    return {
      companies: body.data,
      total: body.meta.total,
      page: body.meta.page,
      totalPages: body.meta.total_pages,
      hasNext: body.meta.has_next,
    };
  }
}

/**
 * Award value in the currency the row declares.
 *
 * The row carries its own `currency` rather than assuming ZAR, so this
 * respects it — mislabelling a foreign-currency award as rands would misstate
 * a supplier's size by an order of magnitude.
 */
export function formatAwardValue(company: IntelligenceCompany): string {
  const currency = company.currency?.trim() || "ZAR";
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(company.totalValue);
  } catch {
    // An unrecognised currency code would otherwise throw. The number is more
    // useful than nothing, so it is shown with the code beside it.
    return `${currency} ${Math.round(company.totalValue).toLocaleString("en-ZA")}`;
  }
}
