import { Link } from "react-router-dom";
import { AsyncSection, Panel } from "../../components/common/AsyncSection";
import { describeApplicationStatus } from "../../services/api/endpoints/applications";
import { formatTimestamp } from "./activity-format";
import type { PortfolioState } from "./use-portfolio";

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
export function ActivityPanel({ state }: { state: PortfolioState }) {
  return (
    <Panel
      title="Recent activity"
      aside={
        <Link
          to="/applications"
          className="text-xs font-medium text-primary hover:underline"
        >
          View all
        </Link>
      }
    >
      <AsyncSection
        state={state}
        subject="recent activity"
        onRetry={state.reload}
        empty={
          <p className="text-sm text-muted-foreground">
            No activity in your account yet.
          </p>
        }
        isEmpty={(portfolio) => portfolio.applications.length === 0}
      >
        {({ applications }) => (
          <ol className="relative ml-2 border-l border-border">
            {[...applications]
              .sort(
                (a, b) =>
                  new Date(b.updatedAt).getTime() -
                  new Date(a.updatedAt).getTime(),
              )
              .slice(0, 6)
              .map((application) => (
                <li
                  key={application.id}
                  className="relative pb-5 pl-5 last:pb-0"
                >
                  <span
                    aria-hidden="true"
                    className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-card bg-primary"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      {describeApplicationStatus(application.status)}
                    </span>
                    <time className="shrink-0 text-xs text-muted-foreground">
                      {formatTimestamp(application.updatedAt)}
                    </time>
                  </div>
                  <Link
                    to={`/applications/${encodeURIComponent(application.id)}`}
                    className="mt-2 block text-sm font-semibold leading-snug text-card-foreground hover:text-primary"
                  >
                    {application.tender?.title ?? "Unknown tender"}
                  </Link>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {activityContext(application.tender)}
                  </p>
                </li>
              ))}
          </ol>
        )}
      </AsyncSection>
    </Panel>
  );
}

function activityContext(tender: {
  sourceOrganization: string | null;
  referenceNumber: string | null;
}): string {
  return (
    [tender.sourceOrganization, tender.referenceNumber]
      .filter((value): value is string => Boolean(value))
      .join(" · ") || "Tender details unavailable"
  );
}
