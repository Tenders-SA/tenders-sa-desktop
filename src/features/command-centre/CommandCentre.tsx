import { Link } from "react-router-dom";
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
 * readiness, and pipeline widgets. Most of that data is still unreachable,
 * so the page says so rather than showing mock widgets that would read as
 * working features.
 *
 * Two things here are real: the plan panel, which renders only when an
 * endpoint is supplied, and the route into tender discovery. Everything
 * else is deliberately described as absent.
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
        Dashboard widgets and workspace features arrive in later, separately
        approved phases.
      </p>

      {subscriptionEndpoint && (
        <SubscriptionPanel endpoint={subscriptionEndpoint} />
      )}

      <div className="mt-6 rounded border border-border bg-card p-6">
        <h2 className="text-sm font-medium text-card-foreground">
          Browse tenders
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Search live tender notices and check closing dates. Matching,
          applications, and proposal drafting are not connected yet.
        </p>
        <Link
          to="/tenders"
          className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
        >
          Open Tender Radar
        </Link>
      </div>
    </section>
  );
}
