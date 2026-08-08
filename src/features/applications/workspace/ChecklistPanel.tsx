/**
 * Preparation checklist for the workspace (cockpit payload).
 *
 * Progress and items, grouped by category. Read-only: completion is owned by
 * the parent workspace (there is no checklist PATCH route), so the desktop
 * reports rather than edits.
 */

import { Panel } from "../../../components/common/AsyncSection";
import type { AsyncState } from "../../../hooks/use-async";
import { AsyncSection } from "../../../components/common/AsyncSection";
import type { CockpitPayload } from "../../../services/api/endpoints/applications";

export interface ChecklistPanelProps {
  state: AsyncState<CockpitPayload>;
}

export function ChecklistPanel({ state }: ChecklistPanelProps) {
  return (
    <AsyncSection
      state={state}
      subject="the preparation checklist"
      isEmpty={(cockpit) => !cockpit.checklistState?.length}
      empty={null}
    >
      {(cockpit) => {
        const items = cockpit.checklistState ?? [];
        if (items.length === 0) return null;
        const done = items.filter((item) => item.completed).length;
        const categories = new Map<string, typeof items>();
        for (const item of items) {
          const key = item.category ?? "Other";
          const bucket = categories.get(key);
          if (bucket) bucket.push(item);
          else categories.set(key, [item]);
        }
        return (
          <Panel
            title="Preparation checklist"
            aside={
              <span className="text-xs text-muted-foreground">
                {done} of {items.length} complete
              </span>
            }
          >
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={items.length}
              aria-valuenow={done}
              aria-label="Checklist progress"
              className="h-1.5 rounded bg-border"
            >
              <div
                className="h-full rounded bg-success"
                style={{ width: `${(done / items.length) * 100}%` }}
              />
            </div>
            {[...categories.entries()].map(([category, categoryItems]) => (
              <div key={category} className="mt-3">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {category}
                </h3>
                <ul className="mt-1 flex flex-col gap-1">
                  {categoryItems.map((item) => (
                    <li
                      key={item.id ?? item.label ?? "item"}
                      className="flex items-baseline gap-2 text-sm"
                    >
                      <span
                        className={
                          item.completed
                            ? "text-success"
                            : "text-muted-foreground"
                        }
                        aria-hidden="true"
                      >
                        {item.completed ? "✓" : "○"}
                      </span>
                      <span
                        className={
                          item.completed
                            ? "text-muted-foreground"
                            : "text-foreground"
                        }
                      >
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Panel>
        );
      }}
    </AsyncSection>
  );
}
