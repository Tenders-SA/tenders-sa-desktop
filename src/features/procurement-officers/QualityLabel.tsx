/**
 * Data-quality chip for officer result rows (design.md §UI, QualityLabel).
 */

import { officerQuality, type OfficerQualityTone } from "./officer-quality";

const TONE_CLASSES: Record<OfficerQualityTone, string> = {
  verified: "bg-success/15 text-success",
  recent: "bg-info/15 text-info",
  historical: "bg-warning/15 text-warning",
  unverified: "bg-muted text-muted-foreground",
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
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${TONE_CLASSES[quality.tone]}`}
    >
      {quality.label}
    </span>
  );
}
