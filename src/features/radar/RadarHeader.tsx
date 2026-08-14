import type { RadarAccess, RadarCounts } from "./radar-workspace-model";

const PLAN_LABELS: Record<RadarAccess, string> = {
  free: "Free",
  starter: "Starter · top 10 matches",
  professional: "Professional · up to 50 matches",
  enterprise: "Enterprise · up to 50 matches",
};

function calculationLabel(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) {
    return "Radar calculation time unavailable";
  }
  return `Radar last calculated ${new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))}`;
}

export function RadarHeader({
  access,
  counts,
  lastUpdated,
  completeness,
}: {
  access: RadarAccess;
  counts: RadarCounts;
  lastUpdated: string | null;
  completeness?: number;
}) {
  const metrics = [
    ["All matches", counts.all],
    ["Highly qualified", counts.highly_qualified],
    ["Potential", counts.potential],
    ["Near miss", counts.near_miss],
  ] as const;

  return (
    <header className="rounded-2xl border border-primary/25 bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {PLAN_LABELS[access]}
          </p>
          <h1
            id="radar-heading"
            className="mt-1 text-2xl font-bold text-foreground"
          >
            Your Tender Radar
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Prioritise opportunities using server-calculated fit, closing
            urgency, and your company profile signals.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {calculationLabel(lastUpdated)}
          </p>
        </div>
        {completeness !== undefined && (
          <p className="rounded-full border border-border px-3 py-1 text-sm font-medium text-foreground">
            Profile {completeness}% complete
          </p>
        )}
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-background p-3"
          >
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-xl font-semibold text-foreground">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
