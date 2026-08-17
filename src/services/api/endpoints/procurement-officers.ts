/**
 * Procurement Officer Directory endpoints.
 *
 * Refs: REQ-A12 (per-endpoint schemas), INT-A2 (validate at the boundary),
 * INT-A3 (main-application API only), PERF-3 (bounded requests).
 * Contract: main-repo `.kiro/specs/procurement-officer-directory-main/`,
 * read from parent source on branch `spec/procurement-officer-directory-main`
 * (service shapes in `src/lib/services/procurement-officer.service.ts`,
 * routes in `src/app/api/v1/procurement-officers/**`).
 *
 * Parent routes (all JWT-gated; 404 when the directory beta setting is off;
 * sync additionally requires the `apiAccess` entitlement → 403):
 *
 *   GET  /api/v1/procurement-officers/search?q=&province=&organisation=&role=&verification=&page=&limit=
 *        -> {success, data: rows[], meta: {page, limit, total}}
 *        contact values are MASKED (`t***@dwa.gov.za`, `012****89`).
 *   GET  /api/v1/procurement-officers/[id]
 *        -> {success, data: detail} — contact points masked, no meta.
 *   GET  /api/v1/procurement-officers/[id]/tenders
 *        -> {success, data: rows[], meta: {page, limit, total}}
 *   GET  /api/v1/procurement-officers/sync?cursor=&since=&page=&limit=
 *        -> {success, data: {rows, nextCursor, hasMore}, meta: {page, limit, total, since?}}
 *        rows carry UNMASKED official values; suppressed officers are
 *        tombstones: `suppressed: true` with EMPTY contactPoints/assignments.
 *   POST /api/v1/procurement-officers/[id]/corrections
 *        body {field, reason} -> {success, data: {id, status: "pending"}}
 *
 * The feed is the only unmasked source, and it is the contract the local
 * index is built from; search/detail stay masked on the wire.
 */

import { z } from "zod";
import { AuthenticatedEndpoint } from "./base";

const officerContactPointSchema = z.object({
  id: z.string(),
  type: z.string(),
  value: z.string(),
  isRoleBased: z.boolean(),
  isOfficial: z.boolean(),
  verificationStatus: z.string(),
});

export type OfficerContactPoint = z.infer<typeof officerContactPointSchema>;

const officerAssignmentSchema = z.object({
  id: z.string(),
  organisationId: z.string(),
  organisationName: z.string().nullable(),
  title: z.string().nullable(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  isCurrent: z.boolean(),
  confidenceScore: z.number().nullable(),
});

export type OfficerAssignment = z.infer<typeof officerAssignmentSchema>;

/**
 * Dates arrive as ISO strings (NextResponse.json serialises Date). Kept as
 * strings at the boundary; consumers convert with `new Date(value)`.
 */
const officerSearchRowSchema = z.object({
  id: z.string(),
  canonicalName: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  currentTitle: z.string().nullable(),
  currentOrganisationId: z.string().nullable(),
  organisationName: z.string().nullable(),
  province: z.string().nullable(),
  kind: z.string(),
  status: z.string(),
  confidenceScore: z.number().nullable(),
  tendersCount: z.number(),
  contactSummary: z.object({
    email: z.string().nullable(),
    telephone: z.string().nullable(),
  }),
});

export type OfficerSearchRow = z.infer<typeof officerSearchRowSchema>;

export interface OfficerSearchQuery {
  q?: string;
  province?: string;
  organisation?: string;
  /** The parent route reads `role`, not `kind`. */
  role?: string;
  verification?: string;
  page?: number;
  limit?: number;
}

const officerSearchBodySchema = z.object({
  success: z.literal(true),
  data: z.array(officerSearchRowSchema),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
  }),
});

export interface OfficerSearchResult {
  officers: OfficerSearchRow[];
  page: number;
  limit: number;
  total: number;
}

const officerDetailSchema = z.object({
  id: z.string(),
  canonicalName: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  currentTitle: z.string().nullable(),
  currentOrganisationId: z.string().nullable(),
  organisationName: z.string().nullable(),
  organisationAddress: z.string().nullable(),
  province: z.string().nullable(),
  kind: z.string(),
  status: z.string(),
  confidenceScore: z.number().nullable(),
  firstSeenAt: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
  verifiedAt: z.string().nullable(),
  tendersCount: z.number(),
  contactPoints: z.array(officerContactPointSchema),
  assignments: z.array(officerAssignmentSchema),
  evidenceSummary: z.object({
    sourceMethods: z.array(z.string()),
    sourceFieldCount: z.number(),
    observedRange: z.object({
      earliest: z.string().nullable(),
      latest: z.string().nullable(),
    }),
  }),
});

export type OfficerDetail = z.infer<typeof officerDetailSchema>;

const officerDetailBodySchema = z.object({
  success: z.literal(true),
  data: officerDetailSchema,
});

const officerTenderRowSchema = z.object({
  id: z.string(),
  tenderId: z.string(),
  title: z.string(),
  referenceNumber: z.string(),
  province: z.string().nullable(),
  closingDate: z.string().nullable(),
  sourceUrl: z.string().nullable(),
});

export type OfficerTenderRow = z.infer<typeof officerTenderRowSchema>;

const officerTendersBodySchema = z.object({
  success: z.literal(true),
  data: z.array(officerTenderRowSchema),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
  }),
});

export interface OfficerTendersResult {
  tenders: OfficerTenderRow[];
  page: number;
  limit: number;
  total: number;
}

const officerSyncRowSchema = z.object({
  id: z.string(),
  canonicalName: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  currentTitle: z.string().nullable(),
  currentOrganisationId: z.string().nullable(),
  province: z.string().nullable(),
  kind: z.string(),
  status: z.string(),
  confidenceScore: z.number().nullable(),
  firstSeenAt: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
  verifiedAt: z.string().nullable(),
  /** Tombstone rows carry `true` with EMPTY contactPoints/assignments. */
  suppressed: z.boolean(),
  updatedAt: z.string(),
  contactPoints: z.array(officerContactPointSchema),
  assignments: z.array(officerAssignmentSchema),
});

export type OfficerSyncRow = z.infer<typeof officerSyncRowSchema>;

export interface OfficerSyncQuery {
  cursor?: string;
  since?: string;
  page?: number;
  limit?: number;
}

const officerSyncBodySchema = z.object({
  success: z.literal(true),
  data: z.object({
    rows: z.array(officerSyncRowSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  }),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    since: z.string().optional(),
  }),
});

export interface OfficerSyncResult {
  rows: OfficerSyncRow[];
  nextCursor: string | null;
  hasMore: boolean;
  meta: { page: number; limit: number; total: number; since?: string };
}

const officerCorrectionBodySchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    status: z.string(),
  }),
});

export type OfficerCorrection = z.infer<
  typeof officerCorrectionBodySchema
>["data"];

/** The parent route's field allowlist (validation mirror, not a duplicate rule). */
export const OFFICER_CORRECTION_FIELDS = [
  "email",
  "telephone",
  "mobile",
  "title",
  "organisation",
  "officer",
] as const;

export class ProcurementOfficersEndpoint extends AuthenticatedEndpoint {
  /**
   * `GET /api/v1/procurement-officers/search`.
   *
   * Server-refresh surface: contact values are masked by the parent. The
   * unmasked values for the same officer come from the sync feed's local
   * index, so the screen merges (local wins on values) rather than
   * rendering the masked strings as facts.
   */
  async search(
    query: OfficerSearchQuery = {},
    signal?: AbortSignal,
  ): Promise<OfficerSearchResult> {
    const body = await this.transport.request({
      method: "GET",
      path: "/api/v1/procurement-officers/search",
      schema: officerSearchBodySchema,
      // Explicit bounds on every search (PERF-3); the parent clamps to 50.
      query: {
        q: query.q || undefined,
        province: query.province || undefined,
        organisation: query.organisation || undefined,
        role: query.role || undefined,
        verification: query.verification || undefined,
        page: query.page ?? 1,
        limit: query.limit ?? 20,
      },
      headers: await this.authHeaders(),
      signal,
    });
    return {
      officers: body.data,
      page: body.meta.page,
      limit: body.meta.limit,
      total: body.meta.total,
    };
  }

  /** `GET /api/v1/procurement-officers/[id]` — masked detail, no meta. */
  async get(id: string, signal?: AbortSignal): Promise<OfficerDetail> {
    const body = await this.transport.request({
      method: "GET",
      path: `/api/v1/procurement-officers/${encodeURIComponent(id)}`,
      schema: officerDetailBodySchema,
      headers: await this.authHeaders(),
      signal,
    });
    return body.data;
  }

  /** `GET /api/v1/procurement-officers/[id]/tenders`. */
  async getTenders(
    id: string,
    query: { page?: number; limit?: number } = {},
    signal?: AbortSignal,
  ): Promise<OfficerTendersResult> {
    const body = await this.transport.request({
      method: "GET",
      path: `/api/v1/procurement-officers/${encodeURIComponent(id)}/tenders`,
      schema: officerTendersBodySchema,
      query: {
        page: query.page ?? 1,
        limit: query.limit ?? 20,
      },
      headers: await this.authHeaders(),
      signal,
    });
    return {
      tenders: body.data,
      page: body.meta.page,
      limit: body.meta.limit,
      total: body.meta.total,
    };
  }

  /**
   * `GET /api/v1/procurement-officers/sync` — the export feed the local
   * index is built from (apiAccess-gated → 403 without entitlement).
   *
   * Pages are bounded (PERF-3); callers loop on `hasMore`/`nextCursor`.
   */
  async sync(
    query: OfficerSyncQuery = {},
    signal?: AbortSignal,
  ): Promise<OfficerSyncResult> {
    const body = await this.transport.request({
      method: "GET",
      path: "/api/v1/procurement-officers/sync",
      schema: officerSyncBodySchema,
      query: {
        cursor: query.cursor || undefined,
        since: query.since || undefined,
        page: query.page ?? 1,
        limit: query.limit ?? 200,
      },
      headers: await this.authHeaders(),
      signal,
    });
    return {
      rows: body.data.rows,
      nextCursor: body.data.nextCursor,
      hasMore: body.data.hasMore,
      meta: body.meta,
    };
  }

  /** `POST /api/v1/procurement-officers/[id]/corrections`. */
  async submitCorrection(
    id: string,
    input: { field: string; reason: string },
    signal?: AbortSignal,
  ): Promise<OfficerCorrection> {
    const body = await this.transport.request({
      method: "POST",
      path: `/api/v1/procurement-officers/${encodeURIComponent(id)}/corrections`,
      schema: officerCorrectionBodySchema,
      body: input,
      headers: await this.authHeaders(),
      signal,
    });
    return body.data;
  }
}
