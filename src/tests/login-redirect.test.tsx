/**
 * Post-login navigation.
 *
 * Refs: REQ-4, REQ-16
 *
 * `/login` is deliberately outside `ProtectedRoute` -- it has to be, or an
 * unauthenticated user could never reach it. The consequence is that
 * establishing a session does not on its own change what is on screen, and
 * for a while it did not: a successful sign-in left the user looking at the
 * same form they had just submitted, session established, nothing to say so.
 *
 * These pin the redirect in both directions, because the failure is silent in
 * both -- a missing redirect strands a signed-in user on the form, and an
 * over-eager one would make the form unreachable.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "../app/router/routes";
import type { AuthPort } from "../services/auth/ports";
import { stubApiClients } from "./fixtures/api-clients";

function authWith(enabled: boolean): AuthPort {
  return {
    isEnabled: () => enabled,
    login: vi.fn(),
    restoreSession: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
  } as unknown as AuthPort;
}

const clients = stubApiClients();

function renderAt(
  path: string,
  { enabled, isAuthenticated }: { enabled: boolean; isAuthenticated: boolean },
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes
        auth={authWith(enabled)}
        isAuthenticated={isAuthenticated}
        clients={clients}
      />
    </MemoryRouter>,
  );
}

describe("post-login navigation", () => {
  it("sends a signed-in user from /login into the app", () => {
    // The bug this exists for: signing in succeeded and the screen did not
    // change, so it looked like nothing had happened.
    renderAt("/login", { enabled: true, isAuthenticated: true });
    expect(
      screen.getByRole("heading", { name: "Command Centre" }),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: /sign in/i })).toBeNull();
  });

  it("still shows the form to a user with no session", () => {
    // The other direction. A redirect that fired unconditionally would make
    // signing in impossible.
    renderAt("/login", { enabled: true, isAuthenticated: false });
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  it("redirects on a restored session, not only on a fresh sign-in", () => {
    // Start-up restores from the keychain without going through the form, so
    // the redirect must be a property of the route rather than something the
    // submit handler does.
    renderAt("/login", { enabled: true, isAuthenticated: true });
    expect(
      screen.getByRole("heading", { name: "Command Centre" }),
    ).toBeVisible();
  });

  it("does not strand an unauthenticated user in a gated build either", () => {
    // With auth gated the escape hatch lets the shell render, and /login
    // still has to show the form rather than bounce.
    renderAt("/login", { enabled: false, isAuthenticated: false });
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  it("keeps sending an unauthenticated user to /login when auth is live", () => {
    // The complementary guard: the protected route must still bounce, or the
    // redirect above would be covering an open shell.
    renderAt("/", { enabled: true, isAuthenticated: false });
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });
});
