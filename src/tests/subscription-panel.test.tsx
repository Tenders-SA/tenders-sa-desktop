/**
 * Subscription panel tests (TASK-2.9).
 *
 * Refs: REQ-A10, REQ-A11, REL-A1, A11Y-A1
 *
 * The panel is the first real authenticated read rendered in the product,
 * so these cover all four states the spec requires -- loading, ready,
 * error, and **schema-validation failure** -- with the last asserted to be
 * a handled state rather than a crash.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SubscriptionPanel } from "../features/command-centre/SubscriptionPanel";
import { CommandCentre } from "../features/command-centre/CommandCentre";
import { ApiError } from "../services/api/errors";
import type {
  EntitlementSummary,
  SubscriptionEndpoint,
} from "../services/api/endpoints/subscription";

function endpointReturning(
  result: EntitlementSummary | Promise<never>,
): SubscriptionEndpoint {
  return {
    getStatus: vi.fn(async () => {
      if (result instanceof Promise) return result;
      return result;
    }),
    getFeatureAccess: vi.fn(),
  } as unknown as SubscriptionEndpoint;
}

function endpointRejecting(error: unknown): SubscriptionEndpoint {
  return {
    getStatus: vi.fn(async () => {
      throw error;
    }),
    getFeatureAccess: vi.fn(),
  } as unknown as SubscriptionEndpoint;
}

const subscribed: EntitlementSummary = {
  kind: "subscribed",
  subscription: {
    id: "sub_1",
    planName: "Professional",
    tier: "pro",
    status: "ACTIVE",
    currentPeriodStart: null,
    currentPeriodEnd: "2026-08-27T00:00:00.000Z",
    isTrial: false,
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    applicationSlots: {
      total: 50,
      used: 12,
      remaining: 38,
      preserved: 0,
      resetsAt: "2026-08-27T00:00:00.000Z",
    },
    applicationCredits: { totalRemaining: 0 },
  },
};

const freeWithCredits: EntitlementSummary = {
  kind: "free-with-credits",
  subscription: {
    ...(subscribed.kind === "subscribed"
      ? subscribed.subscription
      : ({} as never)),
    id: null,
    planName: "free",
    tier: "free",
    currentPeriodEnd: null,
    applicationSlots: {
      total: 0,
      used: 0,
      remaining: 0,
      preserved: 0,
      resetsAt: null,
    },
    applicationCredits: { totalRemaining: 3 },
  },
};

describe("SubscriptionPanel states", () => {
  it("shows a loading state first", () => {
    render(
      <SubscriptionPanel
        endpoint={endpointReturning(new Promise<never>(() => {}))}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("Loading");
  });

  it("renders a real subscription", async () => {
    render(<SubscriptionPanel endpoint={endpointReturning(subscribed)} />);
    await waitFor(() =>
      expect(screen.getByText("Professional")).toBeInTheDocument(),
    );
    expect(screen.getByText("38 of 50 remaining")).toBeInTheDocument();
  });

  it("shows a credit-holding free user as entitled, not as nothing (REQ-A10)", async () => {
    // The audited trap, rendered: this user has no subscription row but has
    // paid for credits. Showing "no active subscription" would hide features
    // they are entitled to.
    render(<SubscriptionPanel endpoint={endpointReturning(freeWithCredits)} />);
    await waitFor(() =>
      expect(screen.getByText("Using application credits")).toBeInTheDocument(),
    );
    expect(screen.queryByText(/no active subscription/i)).toBeNull();
  });

  it("shows the server's message when there is genuinely no entitlement", async () => {
    render(
      <SubscriptionPanel
        endpoint={endpointReturning({
          kind: "none",
          message: "No active subscription found",
        })}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByText("No active subscription found"),
      ).toBeInTheDocument(),
    );
  });

  it("never renders a billing period start, which the route always nulls", async () => {
    render(<SubscriptionPanel endpoint={endpointReturning(subscribed)} />);
    await waitFor(() =>
      expect(screen.getByText("Professional")).toBeInTheDocument(),
    );
    // Rendering one would mean inventing a date.
    expect(screen.queryByText(/began|started|period start/i)).toBeNull();
  });
});

describe("SubscriptionPanel failures", () => {
  it("treats a schema-validation failure as a handled state, not a crash (REL-A1)", async () => {
    // The parent-internal API is undocumented by any OpenAPI document, so a
    // shape this build does not understand is a realistic outcome. It must
    // not reach the error boundary.
    render(
      <SubscriptionPanel
        endpoint={endpointRejecting(
          new ApiError({ kind: "malformed", message: "unexpected" }),
        )}
      />,
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("data-error-kind", "malformed");
    expect(alert.textContent).toMatch(/format this version understands/i);
  });

  it("reports a 5xx as unavailable, never as a denial or an upsell (REQ-A11)", async () => {
    const alert = await renderAndFindAlert(
      new ApiError({ kind: "server", message: "boom", status: 500 }),
    );
    expect(alert.textContent).toMatch(/unavailable right now/i);
    expect(alert.textContent).not.toMatch(/upgrade|pricing|plan required/i);
  });

  it("reports an expired session distinctly", async () => {
    const alert = await renderAndFindAlert(
      new ApiError({
        kind: "unauthorized",
        message: "Unauthorized",
        status: 401,
      }),
    );
    expect(alert.textContent).toMatch(/session has expired/i);
  });

  it("reports offline distinctly from a server fault", async () => {
    const alert = await renderAndFindAlert(
      new ApiError({ kind: "offline", message: "no network" }),
    );
    expect(alert.textContent).toMatch(/could not reach/i);
  });

  it("ignores a cancellation rather than showing a false failure", async () => {
    // Unmount-time aborts are normal. Rendering an error for them would
    // flash a failure at every navigation.
    render(
      <SubscriptionPanel
        endpoint={endpointRejecting(
          new ApiError({ kind: "cancelled", message: "cancelled" }),
        )}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("copes with a non-ApiError without crashing", async () => {
    const alert = await renderAndFindAlert(new Error("something odd"));
    expect(alert).toHaveAttribute("data-error-kind", "unknown");
  });

  async function renderAndFindAlert(error: unknown) {
    render(<SubscriptionPanel endpoint={endpointRejecting(error)} />);
    return screen.findByRole("alert");
  }
});

describe("CommandCentre integration", () => {
  /** Contains a `Link` now, so a router is required. */
  const renderCentre = (subscription?: SubscriptionEndpoint) =>
    render(
      <MemoryRouter>
        <CommandCentre subscriptionEndpoint={subscription} />
      </MemoryRouter>,
    );

  it("renders the plan panel when an endpoint is supplied", async () => {
    renderCentre(endpointReturning(subscribed));
    await waitFor(() =>
      expect(screen.getByText("Professional")).toBeInTheDocument(),
    );
  });

  it("omits the panel entirely in a gated build with no session", () => {
    renderCentre();
    expect(screen.queryByText("Your plan")).toBeNull();
    // The shell must still render, and must still be honest about what is
    // not connected.
    expect(
      screen.getByRole("heading", { name: "Command Centre" }),
    ).toBeInTheDocument();
  });

  it("still says the unbuilt workspace features are not connected", () => {
    renderCentre(endpointReturning(subscribed));
    expect(screen.getByText(/not connected yet/i)).toBeInTheDocument();
  });
});
