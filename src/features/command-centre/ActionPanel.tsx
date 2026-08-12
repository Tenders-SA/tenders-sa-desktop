import { AsyncSection, Panel } from "../../components/common/AsyncSection";
import { useAsync } from "../../hooks/use-async";
import { Link } from "react-router-dom";
import type {
  ActionItem,
  DashboardEndpoint,
} from "../../services/api/endpoints/dashboard";

/**
 * Needs attention (brief §6.1 — pending approvals, missing mandatory items).
 *
 * `/api/v1/dashboard/action-center` is shaped by a service rather than an
 * inline literal, so the endpoint reads it tolerantly and drops anything it
 * cannot recognise. That means an empty list here can mean either "nothing
 * needs attention" or "the payload changed shape" — and the copy is written to
 * be true in both cases rather than asserting all clear.
 */
export function ActionPanel({ endpoint }: { endpoint: DashboardEndpoint }) {
  const state = useAsync(
    (signal) => endpoint.getActionItems(signal),
    [endpoint],
  );

  return (
    <Panel
      title="Needs attention"
      aside={
        <Link
          to="/tasks"
          className="text-xs font-medium text-primary hover:underline"
        >
          Open task desk
        </Link>
      }
    >
      <AsyncSection
        state={state}
        subject="outstanding actions"
        onRetry={state.reload}
        empty={
          <p className="text-sm text-muted-foreground">
            Nothing is waiting on you.
          </p>
        }
      >
        {(items) => (
          <ul className="grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded border border-border bg-background/40 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${severityStyle(item.severity)}`}
                  >
                    {severityLabel(item.severity)}
                  </span>
                  {typeof item.count === "number" && (
                    <span
                      aria-label={`${item.count} items`}
                      className="flex h-7 min-w-7 items-center justify-center rounded-full bg-secondary px-2 text-xs font-semibold text-secondary-foreground"
                    >
                      {item.count}
                    </span>
                  )}
                </div>
                <div className="mt-3 min-w-0">
                  <p className="text-sm font-semibold text-card-foreground">
                    {item.title}
                  </p>
                  {item.detail && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {item.detail}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AsyncSection>
    </Panel>
  );
}

function severityLabel(severity: ActionItem["severity"]): string {
  switch (severity?.toLowerCase()) {
    case "critical":
    case "urgent":
    case "high":
      return "Urgent";
    case "medium":
    case "warning":
      return "Review";
    default:
      return "Next action";
  }
}

function severityStyle(severity: ActionItem["severity"]): string {
  switch (severityLabel(severity)) {
    case "Urgent":
      return "bg-destructive/15 text-destructive";
    case "Review":
      return "bg-warning/15 text-warning";
    default:
      return "bg-info/15 text-info";
  }
}
