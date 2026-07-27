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
