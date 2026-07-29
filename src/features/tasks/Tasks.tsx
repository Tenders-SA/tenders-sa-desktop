import { AsyncSection, Panel } from "../../components/common/AsyncSection";
import { useAsync } from "../../hooks/use-async";
import type { DashboardEndpoint } from "../../services/api/endpoints/dashboard";
import {
  describeEventType,
  groupEvents,
  type PlannerEndpoint,
} from "../../services/api/endpoints/planner";
import { formatEventDate } from "../calendar/event-format";

export interface TasksProps {
  dashboard: DashboardEndpoint;
  planner: PlannerEndpoint;
}

/**
 * Tasks (brief §5).
 *
 * The parent has no task table, so this is assembled from the two places
 * outstanding work actually lives: the action centre (things waiting on the
 * user) and incomplete preparation events that are overdue or due today.
 *
 * **The two sources load independently**, and that is the point — the action
 * centre's shape is service-defined and read tolerantly, so if it changes the
 * user still sees their overdue deadlines. One combined request would let an
 * action-centre change hide a missed site visit.
 *
 * Future-dated events are deliberately excluded. Everything upcoming is on the
 * Calendar; a task list that included next month's closing dates would stop
 * being a list of things to do now.
 */
export function Tasks({ dashboard, planner }: TasksProps) {
  const actions = useAsync(
    (signal) => dashboard.getActionItems(signal),
    [dashboard],
  );
  const events = useAsync(
    (signal) => planner.listEvents(undefined, signal),
    [planner],
  );

  return (
    <section aria-labelledby="tasks-heading" className="max-w-3xl">
      <h1 id="tasks-heading" className="text-xl font-semibold text-foreground">
        Tasks
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Work that is waiting on you, and preparation steps that are due.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <Panel title="Waiting on you">
          <AsyncSection
            state={actions}
            subject="outstanding actions"
            onRetry={actions.reload}
            empty={
              <p className="text-sm text-muted-foreground">
                Nothing is waiting on you.
              </p>
            }
          >
            {(items) => (
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="min-w-0">
                      <span className="text-sm text-card-foreground">
                        {item.title}
                      </span>
                      {item.detail && (
                        <span className="block truncate text-sm text-muted-foreground">
                          {item.detail}
                        </span>
                      )}
                    </span>
                    {typeof item.count === "number" && (
                      <span className="shrink-0 text-sm font-medium text-foreground">
                        {item.count}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </AsyncSection>
        </Panel>

        <Panel title="Due now">
          <AsyncSection
            state={events}
            subject="your preparation steps"
            onRetry={events.reload}
            isEmpty={(all) => {
              const groups = groupEvents(all);
              return groups.overdue.length === 0 && groups.today.length === 0;
            }}
            empty={
              <p className="text-sm text-muted-foreground">
                Nothing is overdue or due today.
              </p>
            }
          >
            {(all) => {
              const groups = groupEvents(all);
              const due = [...groups.overdue, ...groups.today];
              return (
                <ul className="flex flex-col gap-2">
                  {due.map((event) => {
                    const overdue = groups.overdue.includes(event);
                    return (
                      <li
                        key={event.id}
                        className="flex items-start justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-card-foreground">
                            {event.title}
                          </p>
                          {/*
                            Omitted when it would just repeat the title --
                            an event called "Site visit" of type SITE_VISIT
                            humanises to the same words, and printing both
                            reads as a rendering fault.
                          */}
                          {describeEventType(event.eventType) !==
                            event.title.trim() && (
                            <p className="text-sm text-muted-foreground">
                              {describeEventType(event.eventType)}
                            </p>
                          )}
                        </div>
                        <span
                          className={
                            overdue
                              ? "shrink-0 text-sm font-medium text-destructive"
                              : "shrink-0 text-sm text-muted-foreground"
                          }
                        >
                          {/* Overdue says so in words, not colour alone. */}
                          {overdue ? "Overdue · " : "Today · "}
                          {formatEventDate(event.eventDate)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              );
            }}
          </AsyncSection>
        </Panel>
      </div>
    </section>
  );
}
