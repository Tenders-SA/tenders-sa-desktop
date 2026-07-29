import { AsyncSection, Panel } from "../../components/common/AsyncSection";
import { useAsync } from "../../hooks/use-async";
import type { DashboardEndpoint } from "../../services/api/endpoints/dashboard";
import { describeActivityType, formatTimestamp } from "./activity-format";

/**
 * Activity feed (brief §6.1).
 *
 * The parent returns each entry with an `href` and an `icon` — but those are
 * the **web** application's routes and icon names. Following an `href` here
 * would be a broken link, so the desktop routes on `type` instead and ignores
 * both. That is why the feed renders as text rather than as links: a
 * plausible-looking link that goes nowhere is worse than plain text.
 */
export function ActivityPanel({ endpoint }: { endpoint: DashboardEndpoint }) {
  const state = useAsync(
    (signal) => endpoint.getActivity(10, signal),
    [endpoint],
  );

  return (
    <Panel title="Recent activity">
      <AsyncSection
        state={state}
        subject="recent activity"
        onRetry={state.reload}
        empty={
          <p className="text-sm text-muted-foreground">
            No activity in your account yet.
          </p>
        }
      >
        {(activities) => (
          <ul className="flex flex-col gap-3">
            {activities.map((activity) => (
              <li key={activity.id}>
                <p className="text-sm text-card-foreground">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {describeActivityType(activity.type)}
                  </span>
                  <br />
                  {activity.title}
                </p>
                {activity.description && (
                  <p className="truncate text-sm text-muted-foreground">
                    {activity.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formatTimestamp(activity.timestamp)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AsyncSection>
    </Panel>
  );
}
