import { AsyncSection, Panel } from "../../components/common/AsyncSection";
import { useAsync } from "../../hooks/use-async";
import type { DashboardEndpoint } from "../../services/api/endpoints/dashboard";

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
    <Panel title="Needs attention">
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
  );
}
