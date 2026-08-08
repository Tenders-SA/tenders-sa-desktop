import { z } from "zod";

/**
 * The Tenders-SA Developer API envelope, verified against the live API
 * (v2.1.0) rather than assumed from documentation -- see
 * docs/architecture/api.md for the evidence.
 *
 * NOTE: this differs from design.md's `ApiEnvelope<T>` sketch in two
 * ways that matter. `error` is always a plain string with `code` as a
 * SIBLING field (design.md typed it as `string | {code, message}`),
 * and there is no `meta` block (pagination is by query parameter).
 * The sketch predates verification; this file is the contract.
 */

export const apiErrorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  message: z.string().optional(),
  action: z.string().optional(),
  requestId: z.string().optional(),
  docs: z.string().optional(),
  timestamp: z.string().optional(),
});

export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;

/**
 * Builds a success-envelope schema around a caller-supplied `data`
 * schema. Every consumed endpoint must supply one: the published
 * OpenAPI document describes a `200` content schema for exactly 1 of
 * its 98 endpoints, so generated types are not trustworthy here and
 * response shapes are hand-authored per INT-6.
 */
export function apiSuccessEnvelope<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}

/**
 * The parent-internal failure shape (TASK-2.3, REQ-A12).
 *
 * This is deliberately looser than `apiErrorEnvelopeSchema` above, and
 * the difference is a Phase 1 finding rather than caution. The
 * parent-internal API has **no single envelope** -- nine distinct
 * top-level shapes appear across 16 endpoints, and `success` is absent
 * from three of them (`endpoint-inventory.md` §3). A failure arrives as
 * either of:
 *
 *   { error: "Unauthorized" }                                  <- route handler
 *   { error: "Unauthorized", message: "Authentication required" }  <- middleware
 *
 * so requiring `success: false` would reject every real parent failure.
 * In practice the middleware form is what a gated route returns, because
 * middleware verifies the same JWT before the handler runs
 * (`auth-subscription-contract.md` §6).
 */
export const parentErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  code: z.string().optional(),
  /**
   * The workspace lifecycle route answers 400 with the transitions it
   * would accept (`{error, allowed: [...]}`). Carried through so the UI
   * can offer only legal moves instead of guessing.
   */
  allowed: z.array(z.string()).optional(),
});

export type ParentError = z.infer<typeof parentErrorSchema>;
