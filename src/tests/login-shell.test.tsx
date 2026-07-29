import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginShell } from "../features/auth/LoginShell";
import { AuthError, type AuthPort } from "../services/auth/ports";

function gatedAuth(): AuthPort {
  return {
    isEnabled: () => false,
    login: vi.fn(async () => {
      throw new AuthError("disabled", "Desktop authentication is disabled.");
    }),
    restoreSession: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
  };
}

function enabledAuth(): AuthPort {
  return {
    isEnabled: () => true,
    login: vi.fn(async () => ({ userId: "u1", email: "a@b.c" })),
    restoreSession: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
  };
}

describe("LoginShell", () => {
  it("says plainly that sign-in is unavailable while gated", () => {
    render(<LoginShell auth={gatedAuth()} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      /not yet available in this build/i,
    );
  });

  it("disables every control while gated, rather than faking a working form", () => {
    render(<LoginShell auth={gatedAuth()} />);
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByLabelText("Password")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
  });

  it("cannot be submitted while gated", async () => {
    const auth = gatedAuth();
    render(<LoginShell auth={auth} />);

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(auth.login).not.toHaveBeenCalled();
  });

  it("exposes accessible names for every field (A11Y-1)", () => {
    render(<LoginShell auth={enabledAuth()} />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("submits credentials when enabled", async () => {
    const auth = enabledAuth();
    render(<LoginShell auth={auth} />);

    await userEvent.type(screen.getByLabelText("Email"), "buyer@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "pw");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(auth.login).toHaveBeenCalledWith({
      email: "buyer@example.com",
      password: "pw",
    });
  });

  it("surfaces a failure as an alert without leaking the password", async () => {
    const auth = enabledAuth();
    const password = "super-secret-value";
    auth.login = vi.fn(async () => {
      throw new AuthError(
        "invalid-credentials",
        "an adapter-internal diagnostic string",
      );
    });
    render(<LoginShell auth={auth} />);

    await userEvent.type(screen.getByLabelText("Email"), "buyer@example.com");
    await userEvent.type(screen.getByLabelText("Password"), password);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    // CHANGED BY TASK-2.7, deliberately. Phase 0 rendered `AuthError.message`
    // straight into the alert. That put user-facing copy in two places once
    // the adapter also produced messages, and the two would drift.
    //
    // Ownership is now explicit: the ADAPTER classifies (kind, plus
    // retryAfterSeconds) and its message is a diagnostic; the COMPONENT owns
    // every user-facing string. Only the component can do what these states
    // actually need -- add a "check your inbox" hint for an inactive
    // account, or format 742 seconds as "13 minutes".
    expect(alert).toHaveTextContent("Incorrect email or password");
    expect(alert.textContent).not.toContain("adapter-internal");
    expect(document.body.textContent).not.toContain(password);
  });

  it("uses design-system tokens rather than raw colour utilities", () => {
    const { container } = render(<LoginShell auth={enabledAuth()} />);
    const markup = container.innerHTML;
    // Semantic tokens present...
    expect(markup).toMatch(/bg-card|text-card-foreground/);
    // ...and no raw Tailwind palette colours (bg-slate-900, text-red-500…).
    expect(markup).not.toMatch(
      /(bg|text|border)-(slate|gray|zinc|neutral|stone|red|green|blue|emerald|amber|yellow)-\d{2,3}/,
    );
  });
});

describe("LoginShell — audited failure states (TASK-2.7, REQ-A5)", () => {
  function enabledAuth(login: AuthPort["login"]): AuthPort {
    return {
      isEnabled: () => true,
      login,
      restoreSession: async () => undefined,
      logout: async () => {},
    };
  }

  async function submitWith(error: AuthError) {
    const user = userEvent.setup();
    render(
      <LoginShell
        auth={enabledAuth(async () => {
          throw error;
        })}
      />,
    );
    await user.type(screen.getByLabelText("Email"), "a@b.co");
    await user.type(screen.getByLabelText("Password"), "pw");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    return screen.getByRole("alert");
  }

  it("renders invalid credentials without a misleading hint", async () => {
    const alert = await submitWith(
      new AuthError("invalid-credentials", "ignored"),
    );
    expect(alert.textContent).toContain("Incorrect email or password");
  });

  it("tells an inactive account to verify their email, not to retry a password", async () => {
    // The dead end TASK-2.5 exists to prevent: no password works here.
    const alert = await submitWith(
      new AuthError("account-inactive", "ignored"),
    );
    expect(alert.textContent).toContain("not active yet");
    expect(alert.textContent).toMatch(/verification email/i);
    expect(alert.textContent).not.toMatch(/incorrect .*password/i);
  });

  it("surfaces the real wait on a rate limit rather than inviting a retry", async () => {
    const alert = await submitWith(
      new AuthError("rate-limited", "ignored", { retryAfterSeconds: 742 }),
    );
    expect(alert.textContent).toContain("Too many sign-in attempts");
    // 742s -> 13 minutes, not "742 seconds".
    expect(alert.textContent).toContain("13 minutes");
  });

  it("copes with a rate limit that carries no Retry-After", async () => {
    const alert = await submitWith(new AuthError("rate-limited", "ignored"));
    expect(alert.textContent).toContain("few minutes");
  });

  it("distinguishes a network failure from bad credentials", async () => {
    const alert = await submitWith(new AuthError("network", "ignored"));
    expect(alert.textContent).toContain("Could not reach");
  });

  it("says a server error is not the user's fault", async () => {
    const alert = await submitWith(new AuthError("server-error", "ignored"));
    expect(alert.textContent).toMatch(/not a problem with your details/i);
  });

  it("associates the error with both fields for assistive technology", async () => {
    await submitWith(new AuthError("invalid-credentials", "ignored"));
    const alert = screen.getByRole("alert");
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-describedby",
      alert.id,
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "aria-describedby",
      alert.id,
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("never renders the password back into the DOM after a failure", async () => {
    const user = userEvent.setup();
    const password = "S3cret-Bid-Password!";
    render(
      <LoginShell
        auth={enabledAuth(async () => {
          throw new AuthError("invalid-credentials", "ignored");
        })}
      />,
    );
    await user.type(screen.getByLabelText("Email"), "a@b.co");
    await user.type(screen.getByLabelText("Password"), password);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("alert").textContent).not.toContain(password);
    // `textContent`, not `innerHTML`: the password input legitimately holds
    // its own value so the user can correct a typo without retyping. What
    // must never happen is the password being *rendered as text* -- echoed
    // into the error, a heading, or a diagnostic block.
    expect(document.body.textContent).not.toContain(password);
  });

  it("reports the session and clears the password on success", async () => {
    const user = userEvent.setup();
    const onSignedIn = vi.fn();
    render(
      <LoginShell
        auth={enabledAuth(async () => ({ userId: "u1", email: "a@b.co" }))}
        onSignedIn={onSignedIn}
      />,
    );
    await user.type(screen.getByLabelText("Email"), "a@b.co");
    await user.type(screen.getByLabelText("Password"), "pw");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(onSignedIn).toHaveBeenCalledWith({ userId: "u1", email: "a@b.co" });
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("is operable by keyboard alone", async () => {
    const user = userEvent.setup();
    const login = vi.fn(async () => ({ userId: "u1", email: "a@b.co" }));
    render(<LoginShell auth={enabledAuth(login)} />);

    await user.tab();
    expect(screen.getByLabelText("Email")).toHaveFocus();
    await user.keyboard("a@b.co");
    await user.tab();
    expect(screen.getByLabelText("Password")).toHaveFocus();
    await user.keyboard("pw{Enter}");

    expect(login).toHaveBeenCalledTimes(1);
  });
});
