/**
 * Per-tender eligibility check.
 *
 * Refs: brief §6.2 (mandatory requirements, missing internal requirements),
 * §4.3, INT-A3
 * Parent route:
 *   POST /api/v1/tenders/[id]/eligibility-check
 *     -> {success, data:{eligible, score, checks[], blockers[], suggestions[], matchScore?}}
 *
 * **The verb is POST, and getting it wrong is not a 405 the user ever sees as
 * one.** The parent route exports `POST` only. A `GET` is answered by Next.js
 * with a bare 405, `kindForStatus` maps every unlisted 4xx to `validation`,
 * and `describeApiError` renders `validation` as "Add your company profile to
 * see the eligibility check". So the wrong method surfaced as a *missing
 * company profile* on accounts that had one — the request never reached the
 * profile lookup at all. The route reads no request body; the tender is in
 * the path. `eligibility-endpoint.test.ts` pins the method for that reason.
 *
 * This is step 5 of the brief's workflow — "identify compliance, experience,
 * capacity and resource gaps" — answered for one tender.
 *
 * **`eligible` is a three-way answer, not a boolean.** The parent returns
 * `'yes' | 'partial' | 'no'` from the proportion of checks passed, and
 * collapsing `partial` into either extreme is the mistake to avoid: a bidder
 * who fails one of six criteria has a fixable gap, and telling them "not
 * eligible" would lose a winnable tender while telling them "eligible" would
 * walk them into a disqualification.
 *
 * Every check carries `required` and `user` side by side, so the screen can
 * show *why* something failed rather than only that it did.
 */

import { z } from "zod";
import { AuthenticatedEndpoint } from "./base";

const checkSchema = z.object({
  criterion: z.string(),
  /** What the tender demands. */
  required: z.union([z.string(), z.number()]).nullable().optional(),
  /** What the company has on record. */
  user: z.union([z.string(), z.number()]).nullable().optional(),
  pass: z.boolean(),
});

export type EligibilityCheck = z.infer<typeof checkSchema>;

const eligibilitySchema = z.object({
  success: z.literal(true),
  data: z.object({
    eligible: z.enum(["yes", "partial", "no"]),
    /** Percentage of checks passed, computed server-side. */
    score: z.number(),
    checks: z.array(checkSchema),
    /** Hard failures that would disqualify a bid. */
    blockers: z.array(z.string()),
    /** What to do about them. */
    suggestions: z.array(z.string()),
    /** The Tender Radar match score, when one has been calculated. */
    matchScore: z.number().optional(),
  }),
});

export type EligibilityResult = z.infer<typeof eligibilitySchema>["data"];

export class EligibilityEndpoint extends AuthenticatedEndpoint {
  async check(
    tenderId: string,
    signal?: AbortSignal,
  ): Promise<EligibilityResult> {
    const body = await this.transport.request({
      method: "POST",
      path: `/api/v1/tenders/${encodeURIComponent(tenderId)}/eligibility-check`,
      schema: eligibilitySchema,
      headers: await this.authHeaders(),
      signal,
    });
    return body.data;
  }
}

/**
 * The three-way answer as a sentence.
 *
 * `partial` is phrased as an action rather than a verdict, because that is
 * what it means: the gaps are listed and most of them are fixable.
 */
export function describeEligibility(
  eligible: EligibilityResult["eligible"],
): string {
  switch (eligible) {
    case "yes":
      return "Your company meets every recorded criterion";
    case "partial":
      return "Your company meets some criteria — see the gaps below";
    case "no":
      return "Your company does not currently meet these criteria";
  }
}
