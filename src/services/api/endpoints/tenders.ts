/**
 * Tender discovery endpoints.
 *
 * Refs: REQ-A12 (per-endpoint schemas), INT-A2 (validate at the boundary),
 * INT-A3 (main-application API only), PERF-3 (bounded requests).
 * Contract: `docs/audits/endpoint-inventory.md` §2.2, read from parent
 * source at `8ff2e4c2`.
 *
 * `awaiting-contract` (INT-6): hand-authored. Neither parent OpenAPI
 * document describes these routes.
 *
 * **The list and detail routes disagree, and that is not a mistake here.**
 * Gap E-11 from the audit, confirmed against source:
 *
 *   - `GET /api/tenders`      wraps: `{tenders[], pagination, debug}`
 *   - `GET /api/tenders/[id]` returns the **bare tender object**, no wrapper
 *
 * and the three Json-ish fields (`requirements`, `eligibilityCriteria`,
 * `bbbeeRequirements`) are returned **raw** by the list but passed through
 * `parseJsonField` by the detail route. So the same field has a different
 * runtime type depending on which endpoint produced it. Both schemas below
 * therefore accept `unknown` for those fields and the UI renders them
 * defensively rather than assuming a shape.
 */

import { z } from "zod";
import { bearerHeader } from "../tauri-http-transport";
import type { ApiTransport } from "../transport";

/** Server-owned pipeline internals are deliberately not projected. */
const tenderListItemSchema = z.object({
  id: z.string(),
  tender_id: z.string(),
  title: z.string(),
  referenceNumber: z.string(),
  sourceOrganization: z.string(),
  description: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  closingDate: z.string(),
  estimatedValue: z.number().nullable().optional(),
  type: z.string().nullable().optional(),
  publicationType: z.string().optional(),
  delivery: z.string().nullable().optional(),
  industryCategories: z.array(z.string()).optional(),
  documentCount: z.number().optional(),
  createdAt: z.string().optional(),
  // Raw on this route (E-11). Never assume a shape.
  requirements: z.unknown().optional(),
  eligibilityCriteria: z.unknown().optional(),
  bbbeeRequirements: z.unknown().optional(),
});

export type TenderListItem = z.infer<typeof tenderListItemSchema>;

/**
 * `{page, limit, total, pages}` — the shared `parsePagination` convention.
 * NOT `limit`/`cursor`: that is the public Developer API, which this client
 * does not consume (REQ-A14).
 */
const paginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  pages: z.number(),
});

const tenderListResponseSchema = z.object({
  tenders: z.array(tenderListItemSchema),
  pagination: paginationSchema,
  // The route also returns a `debug` block of corpus-level DB statistics on
  // every response (gap E-5). Not projected: it is parent pipeline state the
  // desktop has no business rendering, and it inflates every page.
});

/**
 * Detail returns the tender object bare — no wrapper (a tenth shape).
 *
 * Unlike the list projection, the parent detail route does not return the
 * external `tender_id` field. Keep that route-specific mismatch explicit:
 * inheriting the required list field makes every real detail response fail
 * validation before the page can render.
 */
export const tenderDetailSchema = tenderListItemSchema
  .omit({ tender_id: true })
  .extend({
    status: z.string().optional(),
    sourceUrl: z.string().nullable().optional(),
    updatedAt: z.string().optional(),
    requiredDocuments: z.array(z.unknown()).optional(),
    sourceOrganizationRelation: z
      .object({
        name: z.string(),
        organizationType: z.string().nullable().optional(),
        contactEmail: z.string().nullable().optional(),
        contactPhone: z.string().nullable().optional(),
        physicalAddress: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    timeline: z
      .array(
        z.object({
          id: z.string(),
          eventType: z.string(),
          eventDate: z.string(),
          title: z.string(),
          description: z.string().nullable().optional(),
          isAutomatic: z.boolean().optional(),
        }),
      )
      .optional(),
    submissionRequirements: z
      .array(
        z.object({
          id: z.string(),
          category: z.string(),
          requirement: z.string(),
          isMandatory: z.boolean(),
          dueDate: z.string().nullable().optional(),
          orderIndex: z.number().optional(),
          documentId: z.string().nullable().optional(),
        }),
      )
      .optional(),
    documents: z
      .array(
        z.object({
          id: z.string(),
          fileName: z.string().nullable().optional(),
          // NOTE: never fetched directly. Document access goes through
          // /api/v1/documents/[id]/download-url?requireR2=1 (INT-4), which is
          // a later slice. This is metadata only.
          processingStatus: z.string().optional(),
          fileSize: z.number().nullable().optional(),
          mimeType: z.string().nullable().optional(),
          summary: z.string().nullable().optional(),
          keyPoints: z.array(z.unknown()).optional(),
          hasExtractedText: z.boolean().optional(),
          processedAt: z.string().nullable().optional(),
          analyses: z
            .array(
              z.object({
                id: z.string(),
                submissionGuidelines: z.string().nullable().optional(),
                evaluationCriteria: z.string().nullable().optional(),
                importantDates: z.string().nullable().optional(),
                contactInformation: z.string().nullable().optional(),
                technicalSpecifications: z.string().nullable().optional(),
                financialRequirements: z.string().nullable().optional(),
                complianceRequirements: z.string().nullable().optional(),
                confidenceScore: z.number().nullable().optional(),
                extractedAt: z.string().nullable().optional(),
              }),
            )
            .optional(),
        }),
      )
      .optional(),
    documentStats: z
      .object({
        total: z.number(),
        processed: z.number(),
        pending: z.number(),
        failed: z.number(),
      })
      .optional(),
  });

export type TenderDetail = z.infer<typeof tenderDetailSchema>;

export interface TenderListQuery {
  page?: number;
  /** Clamped to MAX_LIMIT=100 server-side; kept modest for PERF-3. */
  limit?: number;
  /** The route's parameter is `search`, not `q`. */
  search?: string;
  province?: string;
  industry?: string;
  publicationType?: string;
}

export interface TenderListResult {
  tenders: TenderListItem[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export const tenderListResultSchema = z.object({
  tenders: z.array(tenderListItemSchema),
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  pages: z.number(),
});

export interface TendersEndpointOptions {
  transport: ApiTransport;
  /** Reads the Bearer token from the keychain, per request (SEC-A1). */
  getToken: () => Promise<string | undefined>;
}

export class TendersEndpoint {
  private readonly transport: ApiTransport;
  private readonly getToken: () => Promise<string | undefined>;

  constructor(options: TendersEndpointOptions) {
    this.transport = options.transport;
    this.getToken = options.getToken;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return token ? bearerHeader(token) : {};
  }

  /**
   * `GET /api/tenders`.
   *
   * Middleware-gated: the handler itself performs no auth check (gap E-4),
   * so the Bearer header is what makes this succeed.
   */
  async list(
    query: TenderListQuery = {},
    signal?: AbortSignal,
  ): Promise<TenderListResult> {
    const response = await this.transport.request({
      method: "GET",
      path: "/api/tenders",
      schema: tenderListResponseSchema,
      // An explicit limit on every list call (PERF-3): omitting it accepts
      // whatever the server defaults to, which is how unbounded fetches
      // creep in.
      query: {
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        search: query.search || undefined,
        province: query.province || undefined,
        industry: query.industry || undefined,
        publicationType: query.publicationType || undefined,
      },
      headers: await this.authHeaders(),
      signal,
    });

    return { tenders: response.tenders, ...response.pagination };
  }

  /** `GET /api/tenders/[id]` — returns the bare tender object. */
  async get(id: string, signal?: AbortSignal): Promise<TenderDetail> {
    return this.transport.request({
      method: "GET",
      path: `/api/tenders/${encodeURIComponent(id)}`,
      schema: tenderDetailSchema,
      headers: await this.authHeaders(),
      signal,
    });
  }
}

/**
 * Days until closing, or null when the date is unusable.
 *
 * Deadlines are the single most decision-relevant field in the product, so
 * an unparseable date must render as "unknown" rather than as a misleading
 * number.
 */
export function daysUntilClosing(
  closingDate: string,
  now: Date = new Date(),
): number | null {
  const closes = new Date(closingDate);
  if (Number.isNaN(closes.getTime())) return null;
  const ms = closes.getTime() - now.getTime();
  return Math.ceil(ms / 86_400_000);
}
