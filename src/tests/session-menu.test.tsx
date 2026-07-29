/**
 * Sign-out tests.
 *
 * Refs: REQ-4, SEC-2, PRIV-1
 *
 * Signing out is not cosmetic on this platform. The parent has no
 * revocation -- no denylist, no `tokenVersion`, no endpoint -- so a
 * keychain-held token stays valid for up to seven days after the user
 * believes they have left (`docs/architecture/auth.md` §4). Deleting the
 * keychain entry is the only real logout, which makes the control that
 * triggers it security-relevant rather than a convenience.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SessionMenu } from "../features/auth/SessionMenu";
import { AppLayout } from "../app/layouts/AppLayout";
import type { SessionSummary } from "../services/auth/ports";

const session: SessionSummary = {
  userId: "u1",
  email: "buyer@example.co.za",
  displayName: "Thandi Nkosi",
};

describe("SessionMenu", () => {
  it("names the signed-in account", () => {
    render(<SessionMenu session={session} onSignOut={vi.fn()} />);
    expect(screen.getByText("Thandi Nkosi")).toBeVisible();
  });

  it("falls back to the email when there is no display name", () => {
    render(
      <SessionMenu
        session={{ userId: "u1", email: "buyer@example.co.za" }}
        onSignOut={vi.fn()}
      />,
    );
    expect(screen.getByText("buyer@example.co.za")).toBeVisible();
  });

  it("falls back to the email when the display name is only whitespace", () => {
    render(
      <SessionMenu
        session={{ ...session, displayName: "   " }}
        onSignOut={vi.fn()}
      />,
    );
    expect(screen.getByText("buyer@example.co.za")).toBeVisible();
  });

  it("keeps the email available to assistive technology behind a name", () => {
    // Two accounts can share a display name; the email is the identity the
    // parent actually authenticated. Asserting only that it is in the DOM
    // would pass for the fallback case too, so this pins that it is present
    // *and* visually hidden while a name is shown.
    render(<SessionMenu session={session} onSignOut={vi.fn()} />);
    expect(screen.getByText("buyer@example.co.za")).toHaveClass("sr-only");
    expect(screen.getByText("Thandi Nkosi")).not.toHaveClass("sr-only");
  });

  it("does not repeat the email when it is already the visible label", () => {
    render(
      <SessionMenu
        session={{ userId: "u1", email: "buyer@example.co.za" }}
        onSignOut={vi.fn()}
      />,
    );
    expect(screen.getAllByText("buyer@example.co.za")).toHaveLength(1);
  });

  it("signs out when the control is used", async () => {
    const onSignOut = vi.fn(async () => {});
    render(<SessionMenu session={session} onSignOut={onSignOut} />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("blocks a second click while the first is in flight", async () => {
    // Two overlapping clears are harmless but the flicker is not, and a
    // double-submit is the kind of thing that becomes a real bug once a
    // remote call is involved.
    let release = () => {};
    const onSignOut = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    render(<SessionMenu session={session} onSignOut={onSignOut} />);

    const button = screen.getByRole("button", { name: "Sign out" });
    await userEvent.click(button);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /signing out/i }),
      ).toBeDisabled(),
    );
    expect(onSignOut).toHaveBeenCalledTimes(1);
    release();
  });

  it("re-enables the control if signing out rejects, so the user is not stuck", async () => {
    const onSignOut = vi.fn(async () => {
      throw new Error("boom");
    });
    render(<SessionMenu session={session} onSignOut={onSignOut} />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled(),
    );
  });

  it("reports no failure message, because a failed remote call still signs out", async () => {
    // `GatedAuthService.logout()` clears locally regardless of the remote
    // outcome. "Sign-out failed" would therefore be a false statement.
    const onSignOut = vi.fn(async () => {
      throw new Error("boom");
    });
    render(<SessionMenu session={session} onSignOut={onSignOut} />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled(),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("AppLayout account control", () => {
  it("offers sign-out when there is a session", () => {
    render(
      <MemoryRouter>
        <AppLayout session={session} onSignOut={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  it("offers nothing in a gated build, where there is nothing to sign out of", () => {
    // A "Sign out" button with no session behind it is a false affordance,
    // and the shell is reachable without a session while auth is gated.
    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(screen.queryByLabelText("Signed-in account")).toBeNull();
  });
});
