import { Link } from "react-router-dom";
import type { ApiClients } from "../../app/auth-wiring";
import { SubscriptionPanel } from "./SubscriptionPanel";
import { DeadlinePanel } from "./DeadlinePanel";
import { ActivityPanel } from "./ActivityPanel";
import { ActionPanel } from "./ActionPanel";
import { PipelinePanel } from "./PipelinePanel";
import { RunwayPanel } from "./RunwayPanel";
import { MarketPanel } from "./MarketPanel";
import { PulseTotals } from "./PulseTotals";
import { usePortfolio } from "./use-portfolio";
import { usePulse } from "./use-pulse";

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
 * pending approvals and an activity feed. Each panel below owns one live
 * parent route so that **one failing panel does not blank the dashboard**.
 * A combined request would mean an action-centre outage hides the user's
 * closing deadlines, which is exactly the information they cannot afford
 * to lose.
 *
 * Slice 8 added the charts. There are two data domains and they are kept
 * apart on purpose (R-V11): the *market* visuals read the platform pulse,
 * and the *portfolio* visuals read the applications this screen was already
 * loading. A pulse outage must still leave the user looking at their own
 * deadlines, and an applications outage must still leave the market
 * readable.
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

      {clients && <SignedIn clients={clients} />}

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

/**
 * The authenticated body.
 *
 * A separate component because `usePortfolio` is a hook and the screen
 * renders without clients in a gated build — calling it conditionally in
 * `CommandCentre` would break the rules of hooks, and calling it
 * unconditionally would fire a request with no session behind it.
 */
function SignedIn({ clients }: { clients: ApiClients }) {
  // Two requests, six visuals. The portfolio read feeds the deadline panel,
  // the pipeline donut and the runway; the pulse read feeds the KPI strip
  // and both market charts. Each panel still renders its own loading and
  // error state, so sharing the request does not merge the failure domains
  // in the UI (R-V11).
  const portfolio = usePortfolio(clients.applications, clients.documents);
  const pulse = usePulse(clients.pulse);

  return (
    <>
      <div className="mt-6">
        <PulseTotals state={pulse} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <MarketPanel state={pulse} view="trend" />
        <PipelinePanel state={portfolio} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DeadlinePanel state={portfolio} />
        <RunwayPanel state={portfolio} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <MarketPanel state={pulse} view="provinces" />
        <SubscriptionPanel endpoint={clients.subscription} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ActionPanel endpoint={clients.dashboard} />
        <ActivityPanel applications={clients.applications} />
      </div>
    </>
  );
}
