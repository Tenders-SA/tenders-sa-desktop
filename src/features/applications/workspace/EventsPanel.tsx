/**
 * Key dates for the workspace (cockpit payload).
 *
 * A timeline of the tender's events — briefing, site visits, closing. Sorted
 * chronologically; completed events are muted rather than removed.
 */

import { Panel } from "../../../components/common/AsyncSection";
import type { AsyncState } from "../../../hooks/use-async";
import { AsyncSection } from "../../../components/common/AsyncSection";
import type { CockpitPayload } from "../../../services/api/endpoints/applications";

export interface EventsPanelProps {
  state: AsyncState<CockpitPayload>;
}

export function EventsPanel({ state }: EventsPanelProps) {
  return (
    <AsyncSection
      state={state}
      subject="the key dates"
      isEmpty={(cockpit) => !cockpit.events?.length}
      empty={null}
    >
      {(cockpit) => {
        const events = [...(cockpit.events ?? [])].sort(
          (a, b) =>
            new Date(a.eventDate ?? 0).getTime() -
            new Date(b.eventDate ?? 0).getTime(),
        );
        if (events.length === 0) return null;
        return (
          <Panel title="Key dates">
            <ul className="flex flex-col gap-2">
              {events.map((event) => {
                const when =
                  event.eventDate &&
                  !Number.isNaN(new Date(event.eventDate).getTime())
                    ? new Date(event.eventDate).toLocaleDateString("en-ZA", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : undefined;
                return (
                  <li
                    key={event.id ?? event.title ?? "event"}
                    className="flex items-baseline gap-3 text-sm"
                  >
                    {when && (
                      <span
                        className={
                          event.isCompleted
                            ? "w-24 shrink-0 text-xs text-muted-foreground"
                            : "w-24 shrink-0 text-xs font-medium text-foreground"
                        }
                      >
                        {when}
                      </span>
                    )}
                    <span
                      className={
                        event.isCompleted
                          ? "text-muted-foreground"
                          : "text-foreground"
                      }
                    >
                      {event.title}
                    </span>
                    {event.isCompleted && (
                      <span className="text-xs text-success">done</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        );
      }}
    </AsyncSection>
  );
}
