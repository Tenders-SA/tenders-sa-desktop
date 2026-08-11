import { useEffect, useState } from "react";
import { Gauge } from "../../components/charts/Gauge";
import { ApiError } from "../../services/api/errors";
import type {
  EntitlementSummary,
  SubscriptionEndpoint,
} from "../../services/api/endpoints/subscription";

export interface SubscriptionPanelProps {
  endpoint: SubscriptionEndpoint;
}

type State =
  | { status: "loading" }
  | { status: "ready"; entitlement: EntitlementSummary }
  | { status: "error"; message: string; kind: string };

/**
 * Maps a transport failure onto something a user can act on.
 *
 * A schema-validation failure (`malformed`) is deliberately a **handled
 * state, not a crash** (REL-A1). It means the parent returned something
 * this build does not understand -- plausible given the parent-internal API
 * is undocumented and its response shapes are not covered by any OpenAPI
 * document -- and the honest thing is to say so rather than render a broken
 * widget or throw into the error boundary.
 */
function describeError(error: unknown): { message: string; kind: string } {
  if (!(error instanceof ApiError)) {
    return { message: "Could not load your plan.", kind: "unknown" };
  }
  switch (error.kind) {
    case "unauthorized":
      return { message: "Your session has expired.", kind: error.kind };
    case "offline":
    case "timeout":
      return { message: "Could not reach Tenders-SA.", kind: error.kind };
    case "malformed":
      return {
        message:
          "Your plan could not be read in a format this version understands.",
        kind: error.kind,
      };
    default:
      // Includes `server` -- notably the feature-access HTTP 500 whose body
      // carries `hasAccess: false`. It must never read as a denial or an
      // upgrade prompt (REQ-A11).
      return {
        message: "Plan information is unavailable right now.",
        kind: error.kind,
      };
  }
}

/** Renders the entitlement, with the synthesised-free-plan trap resolved. */
function EntitlementView({ entitlement }: { entitlement: EntitlementSummary }) {
  if (entitlement.kind === "none") {
    return (
      <p className="mt-1 text-sm text-muted-foreground">
        {entitlement.message ?? "No active subscription."}
      </p>
    );
  }

  const { subscription } = entitlement;
  const slots = subscription.applicationSlots;

  return (
    <>
      {/* Slice 8: the gauge reads the entitlement this component has already
          resolved. Giving the slot count its own panel would have meant a
          second call to a route whose failure modes this component handles
          carefully, and two places deciding what "no subscription" means. */}
      <div className="mt-3 flex justify-center">
        <Gauge
          label="Application slots used"
          value={slots.used}
          max={slots.total}
          display={`${slots.remaining}`}
          caption={
            slots.total > 0 ? `of ${slots.total} left` : "credits available"
          }
        />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Plan</dt>
        <dd className="text-card-foreground">{subscription.planName}</dd>

        <dt className="text-muted-foreground">Status</dt>
        <dd className="text-card-foreground">
          {subscription.isTrial ? "Trial" : subscription.status}
        </dd>

        <dt className="text-muted-foreground">Application slots</dt>
        <dd className="text-card-foreground">
          {slots.remaining} of {slots.total} remaining
        </dd>

        {entitlement.kind === "free-with-credits" && (
          <>
            <dt className="text-muted-foreground">Access</dt>
            {/* The trap made visible: this user has no subscription row but
              does hold credits, and must not be shown as unentitled. */}
            <dd className="text-card-foreground">Using application credits</dd>
          </>
        )}

        {/* `currentPeriodStart` is deliberately never rendered: the route
          hard-codes it to null in both branches, so any "period began"
          date shown here would be invented. */}
        {subscription.currentPeriodEnd && (
          <>
            <dt className="text-muted-foreground">Renews</dt>
            <dd className="text-card-foreground">
              {subscription.currentPeriodEnd.slice(0, 10)}
            </dd>
          </>
        )}
      </dl>
    </>
  );
}

/**
 * The first real authenticated read rendered in the product (TASK-2.9).
 *
 * This is what makes Phase 2 a *vertical* slice rather than an auth
 * refactor: it exercises the HTTP plugin, the Rust transport, the Bearer
 * header, per-endpoint schema validation, error normalisation, and
 * rendering, end to end against the real parent API.
 */
export function SubscriptionPanel({ endpoint }: SubscriptionPanelProps) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    endpoint
      .getStatus(controller.signal)
      .then((entitlement) => {
        if (active) setState({ status: "ready", entitlement });
      })
      .catch((error: unknown) => {
        // A cancelled request is not an error state -- the component is
        // unmounting, and setting state would warn and show a false failure.
        if (error instanceof ApiError && error.kind === "cancelled") return;
        if (active) setState({ status: "error", ...describeError(error) });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [endpoint]);

  return (
    <section
      aria-labelledby="subscription-panel-heading"
      className="mt-6 rounded border border-border bg-card p-6"
    >
      <h2
        id="subscription-panel-heading"
        className="text-sm font-medium text-card-foreground"
      >
        Your plan
      </h2>

      {state.status === "loading" && (
        <p role="status" className="mt-1 text-sm text-muted-foreground">
          Loading your plan…
        </p>
      )}

      {state.status === "error" && (
        <p
          role="alert"
          data-error-kind={state.kind}
          className="mt-1 text-sm text-destructive"
        >
          {state.message}
        </p>
      )}

      {state.status === "ready" && (
        <EntitlementView entitlement={state.entitlement} />
      )}
    </section>
  );
}
