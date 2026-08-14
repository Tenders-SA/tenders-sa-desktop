/**
 * Tender Radar — matched opportunities.
 *
 * Refs: brief §6.2, INT-A3, REQ-A12
 * Parent routes (read from source at `8ff2e4c2`):
 *   GET  /api/v1/recommendations                        -> {success, state, scope, recommendations[], counts, pagination}
 *   GET  /api/v1/recommendations/new-count              -> count of unseen
 *   GET  /api/v1/recommendations/[tenderId]/explanation  -> match breakdown
 *   POST /api/v1/recommendations/refresh                 -> recompute
 *
 * This is what the brief means by Tender Radar: tenders scored against the
 * company profile, not a keyword search. **The score is computed server-side
 * and never recomputed here** — the desktop has no access to the matching
 * inputs (award history, personnel, equipment, financial capacity), so any
 * local score would be a different and wrong number.
 *
 * `state` is the field that matters most. `no_company_profile` is a
 * first-class outcome, not an error: a user with no company profile gets an
 * empty list with a reason, and telling them "no matches" instead would send
 * them looking for tenders that do not exist rather than to their profile.
 */

import { z } from "zod";
import { AuthenticatedEndpoint } from "./base";

const scoreBandSchema = z.object({
  score: z.number(),
  maxScore: z.number(),
});

/** Per-factor contribution. Every factor is optional in the parent type. */
const scoreFactorsSchema = z.object({
  eligibility: scoreBandSchema.optional(),
  industry: scoreBandSchema
    .extend({
      breakdown: z
        .object({ exact: z.number(), fuzzy: z.number(), tfidf: z.number() })
        .optional(),
    })
    .optional(),
  province: scoreBandSchema.optional(),
  bbbee: scoreBandSchema.optional(),
  value: scoreBandSchema.optional(),
  documentReadiness: scoreBandSchema.optional(),
  userPreferences: scoreBandSchema.optional(),
});

export type ScoreFactors = z.infer<typeof scoreFactorsSchema>;

const recommendedTenderSchema = z.object({
  id: z.string(),
  tenderId: z.string(),
  tender: z.object({
    id: z.string(),
    title: z.string(),
    referenceNumber: z.string().nullable(),
    description: z.string().nullable(),
    closingDate: z.string().nullable(),
    estimatedValue: z.number().nullable(),
    province: z.string().nullable(),
    sourceOrganization: z.string().nullable(),
    status: z.string(),
  }),
  score: z.number(),
  baseScore: z.number().nullable(),
  reasoning: z.string().nullable(),
  factors: scoreFactorsSchema.nullable(),
  improvementAreas: z.array(z.string()).nullable(),
  calculatedAt: z.string(),
  matchCategory: z.enum(["highly_qualified", "good_match", "potential"]),
  aiRecommendation: z
    .object({
      reasoning: z.string().nullable(),
      improvementAreas: z
        .object({ gaps: z.array(z.string()), actions: z.array(z.string()) })
        .nullable(),
      competitivePosition: z.string().nullable(),
      successProbability: z.number().nullable(),
      estimatedTimeToQualify: z.string().nullable(),
      aiAdjustment: z.number().nullable(),
    })
    .partial()
    .optional(),
});

export type RecommendedTender = z.infer<typeof recommendedTenderSchema>;

/**
 * `state` distinguishes "you have no profile" from "your profile matched
 * nothing", which are different problems with different fixes.
 */
export type RadarState = "ready" | "empty" | "no_company_profile";

const recommendationsSchema = z.object({
  success: z.literal(true),
  state: z.enum(["ready", "empty", "no_company_profile"]),
  scope: z.object({ companyId: z.string().nullable().optional() }).optional(),
  recommendations: z.array(recommendedTenderSchema),
  // Shape is service-defined and used only for headline totals.
  counts: z.unknown().optional(),
  pagination: z
    .object({
      limit: z.number(),
      offset: z.number(),
      hasMore: z.boolean(),
    })
    .optional(),
});

export interface RadarResult {
  state: RadarState;
  recommendations: RecommendedTender[];
  hasMore: boolean;
  offset: number;
  limit: number;
}

export const radarResultSchema = z.object({
  state: z.enum(["ready", "empty", "no_company_profile"]),
  recommendations: z.array(recommendedTenderSchema),
  hasMore: z.boolean(),
  offset: z.number(),
  limit: z.number(),
});

export interface RadarQuery {
  limit?: number;
  offset?: number;
  /** Server clamps to 0-100. Parent default is 60. */
  minScore?: number;
  provinces?: string[];
  categories?: string[];
}

const explanationSchema = z.object({
  score: z.number(),
  baseScore: z.number().nullable(),
  aiAdjustment: z.number().nullable(),
  breakdown: z.array(
    z.object({
      factor: z.string(),
      points: z.number(),
      maxPoints: z.number(),
      description: z.string(),
      passed: z.boolean(),
    }),
  ),
  gaps: z.array(z.string()),
  actionItems: z.array(z.string()),
  estimatedTimeToQualify: z.string().nullable(),
  competitivePosition: z.string().nullable().optional(),
  successProbability: z.number().nullable().optional(),
});

export type MatchExplanation = z.infer<typeof explanationSchema>;

/**
 * The explanation route may wrap or return bare depending on the handler, so
 * both are accepted rather than betting on one.
 */
const explanationBodySchema = z.union([
  z.object({ success: z.literal(true), data: explanationSchema }),
  z.object({ success: z.literal(true), explanation: explanationSchema }),
  explanationSchema,
]);

const newCountSchema = z.union([
  z.object({ count: z.number() }),
  z.object({ newCount: z.number() }),
  z.object({ success: z.literal(true), data: z.object({ count: z.number() }) }),
]);

export class RecommendationsEndpoint extends AuthenticatedEndpoint {
  async list(
    query: RadarQuery = {},
    signal?: AbortSignal,
  ): Promise<RadarResult> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const body = await this.transport.request({
      method: "GET",
      path: "/api/v1/recommendations",
      query: {
        limit,
        offset,
        minScore: query.minScore ?? 60,
        // Comma-joined, which is how the route parses them.
        provinces: query.provinces?.length
          ? query.provinces.join(",")
          : undefined,
        categories: query.categories?.length
          ? query.categories.join(",")
          : undefined,
      },
      schema: recommendationsSchema,
      headers: await this.authHeaders(),
      signal,
    });

    return {
      state: body.state,
      recommendations: body.recommendations,
      hasMore: body.pagination?.hasMore ?? false,
      offset: body.pagination?.offset ?? offset,
      limit: body.pagination?.limit ?? limit,
    };
  }

  /** Why this tender scored what it scored. */
  async explain(
    tenderId: string,
    signal?: AbortSignal,
  ): Promise<MatchExplanation> {
    const body = await this.transport.request({
      method: "GET",
      path: `/api/v1/recommendations/${encodeURIComponent(tenderId)}/explanation`,
      schema: explanationBodySchema,
      headers: await this.authHeaders(),
      signal,
    });
    if ("data" in body) return body.data;
    if ("explanation" in body) return body.explanation;
    return body;
  }

  /** Unseen matches, for a navigation badge. */
  async newCount(signal?: AbortSignal): Promise<number> {
    const body = await this.transport.request({
      method: "GET",
      path: "/api/v1/recommendations/new-count",
      schema: newCountSchema,
      headers: await this.authHeaders(),
      signal,
    });
    if ("count" in body) return body.count;
    if ("newCount" in body) return body.newCount;
    return body.data.count;
  }

  /**
   * Asks the parent to recompute. A mutation, so the transport gives it
   * `retry: "never"` — the parent supports no idempotency key, and a
   * replayed recompute is wasted server work.
   */
  async refresh(signal?: AbortSignal): Promise<void> {
    await this.transport.request({
      method: "POST",
      path: "/api/v1/recommendations/refresh",
      schema: z.unknown(),
      headers: await this.authHeaders(),
      signal,
    });
  }
}

/**
 * Match band as words, because a bare percentage invites false precision.
 *
 * Bands follow the parent's own `matchCategory` rather than inventing new
 * thresholds, so the desktop and the web app never disagree about whether a
 * tender is a good match.
 */
export function describeMatchCategory(
  category: RecommendedTender["matchCategory"],
): string {
  switch (category) {
    case "highly_qualified":
      return "Strong match";
    case "good_match":
      return "Good match";
    case "potential":
      return "Possible match";
  }
}
