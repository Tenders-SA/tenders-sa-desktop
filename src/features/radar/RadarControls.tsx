import type {
  RadarCounts,
  RadarFilters,
  RadarSort,
} from "./radar-workspace-model";

const TABS = [
  ["all", "All"],
  ["highly_qualified", "Highly Qualified"],
  ["potential", "Potential"],
  ["near_miss", "Near Miss"],
] as const;

export function RadarControls({
  counts,
  filters,
  sort,
  onFiltersChange,
  onSortChange,
  onReset,
}: {
  counts: RadarCounts;
  filters: RadarFilters;
  sort: RadarSort;
  onFiltersChange: (filters: RadarFilters) => void;
  onSortChange: (sort: RadarSort) => void;
  onReset: () => void;
}) {
  const hasFilters =
    filters.band !== "all" || filters.closingSoon || filters.newThisWeek;
  return (
    <section aria-label="Radar controls" className="mt-5 rounded-xl border border-border bg-card p-4">
      <div role="tablist" aria-label="Match categories" className="flex flex-wrap gap-2">
        {TABS.map(([band, label]) => (
          <button
            key={band}
            type="button"
            role="tab"
            aria-selected={filters.band === band}
            onClick={() => onFiltersChange({ ...filters, band })}
            className="rounded-full border border-border px-3 py-1.5 text-sm text-foreground aria-selected:border-primary aria-selected:bg-primary/10"
          >
            {label} ({counts[band]})
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={filters.closingSoon}
            onChange={(event) =>
              onFiltersChange({ ...filters, closingSoon: event.target.checked })
            }
          />
          Closing Soon
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={filters.newThisWeek}
            onChange={(event) =>
              onFiltersChange({ ...filters, newThisWeek: event.target.checked })
            }
          />
          New to Radar This Week
        </label>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          Sort
          <select
            aria-label="Sort matches"
            value={sort}
            onChange={(event) => onSortChange(event.target.value as RadarSort)}
            className="rounded border border-input bg-background px-2 py-1.5 text-foreground"
          >
            <option value="best_match">Best Match</option>
            <option value="closing_soon">Closing Soon</option>
            <option value="newest">Newest to Radar</option>
            <option value="highest_value">Highest Value</option>
          </select>
        </label>
        {hasFilters && (
          <button type="button" onClick={onReset} className="text-sm font-medium text-primary hover:underline">
            Reset filters
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        “New” uses the Radar calculation timestamp, not tender publication time.
      </p>
    </section>
  );
}
