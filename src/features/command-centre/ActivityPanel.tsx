import { AsyncSection, Panel } from "../../components/common/AsyncSection";
import { useAsync } from "../../hooks/use-async";
import {
  describeApplicationStatus,
  type ApplicationsEndpoint,
} from "../../services/api/endpoints/applications";
import { describeActivityType, formatTimestamp } from "./activity-format";

/**
 * Activity feed (brief §6.1).
 *
 * The web application's own "recent activity" feed answers `{}` from
 * `/api/v1/dashboard/activity` on the running site, and the web dashboard
 * therefore feeds its activity-equivalent card from `/api/v1/applications`
 * (its "Recent applications" panel). The desktop does the same: the most
 * recently updated applications, newest first, are this feed.
 *
 * Each entry is an application: the status change is the activity, the
 * tender title is what it happened to, and the update time is when.
 */
export function ActivityPanel({
  applications,
}: {
  applications: ApplicationsEndpoint;
}) {
  const state = useAsync(
    (signal) => applications.list({ limit: 10 }, signal),
    [applications],
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
        isEmpty={(result) => result.applications.length === 0}
      >
        {({ applications: apps }) => (
          <ul className="flex flex-col gap-3">
            {apps.map((application) => (
              <li key={application.id}>
                <p className="text-sm text-card-foreground">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {describeActivityType("application")}
                  </span>
                  <br />
                  {`Application ${describeApplicationStatus(application.status)}`}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {application.tender?.title ?? "Unknown tender"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatTimestamp(application.updatedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AsyncSection>
    </Panel>
  );
}
