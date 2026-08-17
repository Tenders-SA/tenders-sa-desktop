/**
 * Every user-facing string on the Supplier Profile screen.
 *
 * Spec: desktop-supplier-profile §design 6 (R-S8, R-S9, R-S10, R-S14)
 *
 * **The wording here is contractual, not stylistic.** Brief §8.4 forbids
 * legal claims about a company and prescribes the vocabulary to use instead;
 * §10 forbids using award data to imply corruption or wrongdoing. Those are
 * requirements a component cannot be trusted to remember every time it
 * renders a flag, so the strings live in one module that a test can read in
 * full — including a test that no accusatory word ever entered it.
 *
 * Two rules follow from that and are easy to break by accident:
 *
 *  1. **A tier limit is never described as an absence of data.** "Your plan
 *     does not include this" and "nothing was recorded" are different claims,
 *     and only one of them is about the company.
 *  2. **A signal is never a finding.** The parent's own `description` is shown
 *     verbatim as the source's words; the heading above it restates the fact
 *     neutrally and never characterises the company.
 */

/**
 * The verdict vocabulary of brief §8.4, verbatim.
 *
 * The brief lists these as the language to use *instead of* declaring a
 * company legitimate or illegitimate, so they are quoted rather than
 * paraphrased.
 */
export const VERDICT = {
  strongEvidence: "Strong evidence available",
  limitedPublicData: "Limited public data",
  potentialInconsistency: "Potential inconsistency detected",
  requiresManualVerification: "Requires manual verification",
  relevantAwardHistory: "Relevant award history found",
  noRelatedAwardHistory: "No related award history found",
} as const;

export const VERDICT_DETAIL = {
  /** Contract C resolved the slug to a different company (H2). */
  registerMismatch:
    "We could not confidently match this company in the company register. Nothing from the register is shown for that reason.",
  /** Awards exist on the leaderboard but contract C returned no detail. */
  awardsWithoutDetail:
    "This company has recorded awards, but no award detail is available here.",
  /** Any flag is present. Always paired with the verdict above it. */
  flagsNeedVerification:
    "Requires manual verification before you rely on this.",
} as const;

/**
 * Neutral restatements of the parent's four flag types
 * (`src/lib/cipc/forensics.ts:311,320,331,342`).
 *
 * Each says what the underlying record shows and stops there. The parent's
 * own `description` is rendered beneath as the source's words, so nothing is
 * hidden — but the heading a reader scans must not read as an allegation.
 */
export const FLAG_HEADINGS: Record<string, string> = {
  DEREGISTERED_ENTITY: "Company register shows a status other than active",
  POOR_COMPLIANCE:
    "Register compliance score is below the platform's threshold",
  NEW_ENTRANT_LARGE_AWARD: "A large award is recorded soon after registration",
  DISQUALIFIED_DIRECTOR: "A director record matches a disqualification list",
};

/**
 * Turns an unrecognised flag type into a readable heading.
 *
 * `SOME_NEW_SIGNAL` → `Some new signal`. A type the desktop has never seen
 * still renders with the parent's description beneath it, rather than being
 * dropped — hiding a signal is as dishonest as overstating one.
 */
export function flagHeading(type: string): string {
  const known = FLAG_HEADINGS[type];
  if (known) return known;
  const words = type.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Signal";
}

/**
 * Severity as strength, never as a verdict.
 *
 * "Critical" on a flag describes how strong the signal is, not how bad the
 * company is; rendering the parent's raw word would let a reader take it as
 * the latter. Colour alone is never used — it carries no meaning for a
 * screen-reader user and reads as a judgement to everyone else.
 */
export const SEVERITY_LABELS: Record<string, string> = {
  low: "Signal strength: Low",
  medium: "Signal strength: Moderate",
  high: "Signal strength: High",
  critical: "Signal strength: Highest",
};

export function severityLabel(severity: string): string {
  return (
    SEVERITY_LABELS[severity?.toLowerCase()] ?? "Signal strength: Recorded"
  );
}

/**
 * Shown whenever any score, flag or restriction renders (brief §10).
 *
 * This is the sentence that keeps the panel on the right side of "do not
 * imply wrongdoing without reliable evidence". It is not a disclaimer bolted
 * on for safety — it is the accurate description of what the data is.
 */
export const RISK_DISCLAIMER =
  "These are data signals drawn from public procurement and company-register records. They are not findings of wrongdoing, and they do not indicate that any law has been broken. Verify independently before acting on them.";

/**
 * Plan-limit copy (R-S9).
 *
 * Never "no data". Each of these describes the *account*, not the company.
 */
export const TIER = {
  previewRowMissing:
    "Risk signals are limited to a preview on your plan, and this company is outside it. This is a plan limit, not an absence of records.",
  notInWorkbench: "Not recorded in the forensic workbench.",
  advancedContextLocked:
    "Market and province context is not available on your plan.",
  listOverlayLocked:
    "Risk and restricted-supplier signals need an active subscription.",
} as const;

/** Cap disclosure (R-S14, H3, L2). */
export const CAPS = {
  timeline:
    "Showing the 10 most recent awards on record. The desktop cannot request more.",
  flags: (total: number, shown: number) =>
    `${total} signals are recorded; the first ${shown} are shown.`,
} as const;

/**
 * The provenance line on each panel (brief §4.2, §9).
 *
 * §9 asks the product to differentiate user-verified, public-source,
 * award-derived, AI-inferred and unverified user-added data. These are that
 * distinction, made visible per panel.
 */
export const EYEBROW = {
  hero: "Award-derived · public procurement records",
  registration: "Public-source · company register, matched by name",
  contacts: "Public-source · company register and platform enrichment",
  operating: "Award-derived · from recorded awards",
  awards: "Award-derived · public procurement records",
  buyers: "Derived · computed from the awards listed above",
  risk: "Public-source · Tenders-SA forensic workbench and OCPO records",
  confidence: "Derived · about this page, not about the company",
  showcase: "User-supplied · submitted by the company",
} as const;

/**
 * Provenance for the compiled description, kept identical to the wording
 * already shipped on the list row (`SupplierIntelligence.tsx:209-215`) so one
 * product does not describe the same derived field two ways.
 */
export const ENRICHMENT = {
  compiled: "Automatically compiled",
  verify: " — verify before relying on it",
  lastCompiled: "last compiled",
} as const;
