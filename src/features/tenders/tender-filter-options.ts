/**
 * Filter values the parent's `/api/tenders` route actually accepts.
 *
 * Refs: INT-A3, REQ-A14
 * Evidence: `src/app/api/tenders/route.ts` and `prisma/tender-domain.prisma`
 * read from parent source at `8ff2e4c2b2b5597dc6d8107f628ffe72c9a89bc1`.
 *
 * **These are not free text.** The route matches province with Prisma
 * `equals` (case-insensitive) -- not `contains` -- so a value that is not one
 * of the stored names returns an empty page rather than a wide result. A text
 * input would therefore look broken for most of what a user would type into
 * it, which is why province is a fixed list and not a box.
 *
 * `industry`, by contrast, IS a `contains` match against category names, so
 * free text is appropriate there. It is not exposed yet: the set of category
 * names lives in parent data with no endpoint to enumerate it, and a
 * hand-guessed list would silently return nothing for anything missing.
 */

/**
 * Canonical display names, taken from the values of `PROVINCE_VARIANTS` in
 * the parent's `src/lib/utils.ts`. That map normalises many spellings onto
 * exactly these, so they are the forms the database should hold.
 *
 * "National" is included because the parent treats it as a province value
 * for tenders that are not province-specific -- omitting it would hide them
 * behind a filter that looks exhaustive.
 */
export const PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "National",
  "North West",
  "Northern Cape",
  "Western Cape",
] as const;

export type Province = (typeof PROVINCES)[number];

/**
 * What kind of notice to show.
 *
 * Every value here was read off the route's own branching, and each one takes
 * a branch that does what its label says:
 *
 *   - **`undefined`** -- the route's no-parameter default: `TENDER_NOTICE`,
 *     `status: ACTIVE`, and `closingDate` in the future. Open tenders, which
 *     is the right default for a bidder.
 *   - **`CLOSED`** -- a pseudo-value the route special-cases into
 *     `TENDER_NOTICE` + `status: CLOSED`. Not a `PublicationType` member.
 *   - **`AWARD_NOTICE`**, **`CANCELLATION_NOTICE`** -- real enum members,
 *     matched exactly.
 *   - **`CORRIGENDUM`** -- special-cased into the whole notice group
 *     (`CORRIGENDUM`, `ADDENDUM`, `GENERAL_NOTICE`, `PROCUREMENT_PLAN`),
 *     which is why it is labelled "Amendments and notices" rather than
 *     "Corrigenda".
 *
 * An unrecognised value silently falls back to open tenders, so offering
 * anything not on this list would produce a filter that appears to do
 * nothing. Labels are ours; values are the parent's.
 */
export const PUBLICATION_FILTERS = [
  { value: undefined, label: "Open tenders" },
  { value: "CLOSED", label: "Closed tenders" },
  { value: "AWARD_NOTICE", label: "Awards" },
  { value: "CANCELLATION_NOTICE", label: "Cancellations" },
  { value: "CORRIGENDUM", label: "Amendments and notices" },
] as const;
