import type { SubscriptionEndpoint } from "../../services/api/endpoints/subscription";
import { SubscriptionPanel } from "./SubscriptionPanel";

export interface CommandCentreProps {
  /**
   * Present once authentication is live. Absent in a gated build, where
   * there is no session to read a plan for.
   */
  subscriptionEndpoint?: SubscriptionEndpoint;
}

/**
 * Command Centre (REQ-2; first real data added by TASK-2.9).
 *
 * The brief describes this as the post-login default screen with deadline,
 * readiness, and pipeline widgets. Almost none of that data is reachable
 * yet, so the page still says so rather than showing mock widgets that
 * would read as working features.
 *
 * What IS real is the plan panel: one authenticated read against the parent
 * API, which is what makes Phase 2 a vertical slice rather than an auth
 * refactor. It renders only when an endpoint is supplied.
 */
export function CommandCentre({ subscriptionEndpoint }: CommandCentreProps) {
  return (
    <section aria-labelledby="command-centre-heading" className="max-w-2xl">
      <h1
        id="command-centre-heading"
        className="text-xl font-semibold text-foreground"
      >
        Command Centre
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dashboard widgets, tender data, and workspace features arrive in later,
        separately approved phases.
      </p>

      {subscriptionEndpoint && (
        <SubscriptionPanel endpoint={subscriptionEndpoint} />
      )}

      <div className="mt-6 rounded border border-border bg-card p-6">
        <h2 className="text-sm font-medium text-card-foreground">
          Tenders and applications are not connected yet
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tender discovery, deadlines, and workspace features arrive in later,
          separately approved phases.
        </p>
      </div>
    </section>
  );
}
