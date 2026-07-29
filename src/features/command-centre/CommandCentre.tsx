import { Link } from "react-router-dom";
import type { ApiClients } from "../../app/auth-wiring";
import { SubscriptionPanel } from "./SubscriptionPanel";
import { DeadlinePanel } from "./DeadlinePanel";
import { ActivityPanel } from "./ActivityPanel";
import { ActionPanel } from "./ActionPanel";

export interface CommandCentreProps {
  /**
   * Present once authentication is live. Absent in a gated build, where
   * there is no session to read anything for.
   */
  clients?: ApiClients;
}

/**
 * Command Centre (brief §6.1) — the post-login default screen.
 *
 * The brief asks for deadlines, pipeline value, missing mandatory items,
 * pending approvals and an activity feed. Those come from three parent
 * routes, and each panel below owns one of them so that **one failing panel
 * does not blank the dashboard**. A single combined request would mean an
 * action-centre outage hides the user's closing deadlines, which is exactly
 * the information they cannot afford to lose.
 */
export function CommandCentre({ clients }: CommandCentreProps) {
  return (
    <section aria-labelledby="command-centre-heading" className="max-w-5xl">
      <h1
        id="command-centre-heading"
        className="text-xl font-semibold text-foreground"
      >
        Command Centre
      </h1>

      {!clients && (
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to see your deadlines, pipeline and activity.
        </p>
      )}

      {clients && (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <DeadlinePanel endpoint={clients.dashboard} />
            <SubscriptionPanel endpoint={clients.subscription} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ActionPanel endpoint={clients.dashboard} />
            <ActivityPanel endpoint={clients.dashboard} />
          </div>
        </>
      )}

      <div className="mt-6 rounded border border-border bg-card p-6">
        <h2 className="text-sm font-medium text-card-foreground">
          Find work to bid on
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tender Radar scores open tenders against your company profile.
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <Link
            to="/radar"
            className="text-sm font-medium text-primary hover:underline"
          >
            Open Tender Radar
          </Link>
          <Link
            to="/tenders"
            className="text-sm font-medium text-primary hover:underline"
          >
            Browse all tenders
          </Link>
        </div>
      </div>
    </section>
  );
}
