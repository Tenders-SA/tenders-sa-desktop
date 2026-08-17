/**
 * Data-quality mapping for officer rows (design.md §UI, QualityLabel).
 * Pure mapping of `status` + `lastSeenAt`; thresholds are display
 * constants, not business rules.
 */

export type OfficerQualityTone = "verified" | "recent" | "historical" | "unverified";

export interface OfficerQuality {
  label: string;
  tone: OfficerQualityTone;
}

const TWELVE_MONTHS_MS = 365.25 * 24 * 60 * 60 * 1000;
const TWENTY_FOUR_MONTHS_MS = 2 * TWELVE_MONTHS_MS;

export function officerQuality(
  status: string,
  lastSeenAt: string | null,
  now: Date = new Date(),
): OfficerQuality {
  if (status === "verified") {
    return { label: "Verified", tone: "verified" };
  }
  if (!lastSeenAt) {
    return { label: "Unverified", tone: "unverified" };
  }
  const age = now.getTime() - new Date(lastSeenAt).getTime();
  if (Number.isNaN(age)) {
    return { label: "Unverified", tone: "unverified" };
  }
  if (age <= TWELVE_MONTHS_MS) {
    return { label: "Recently observed", tone: "recent" };
  }
  if (age <= TWENTY_FOUR_MONTHS_MS) {
    return { label: "Historical", tone: "historical" };
  }
  return { label: "Unverified", tone: "unverified" };
}