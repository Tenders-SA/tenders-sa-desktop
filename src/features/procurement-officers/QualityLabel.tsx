/**
 * Data-quality chip for officer result rows (design.md §UI, QualityLabel).
 */

import { officerQuality, type OfficerQualityTone } from "./officer-quality";

const TONE_CLASSES: Record<OfficerQualityTone, string> = {
  verified: "bg-emerald-100 text-emerald-800",
  recent: "bg-sky-100 text-sky-800",
  historical: "bg-amber-100 text-amber-800",
  unverified: "bg-neutral-100 text-neutral-600",
};

export function QualityLabel({
  status,
  lastSeenAt,
}: {
  status: string;
  lastSeenAt: string | null;
}) {
  const quality = officerQuality(status, lastSeenAt);
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[quality.tone]}`}
    >
      {quality.label}
    </span>
  );
}