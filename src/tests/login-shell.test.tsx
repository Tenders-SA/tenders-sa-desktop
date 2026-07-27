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
        "Those details did not match.",
      );
    });
    render(<LoginShell auth={auth} />);

    await userEvent.type(screen.getByLabelText("Email"), "buyer@example.com");
    await userEvent.type(screen.getByLabelText("Password"), password);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Those details did not match.");
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
