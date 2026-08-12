/**
 * Sign-in shell — brand column, pipeline graphic, status footer
 * (Slice 8, T4 — R-V1, R-V3, R-V4, R-V5).
 *
 * Deliberately a **separate file** from `login-shell.test.tsx`. R-V2 says
 * the authentication behaviour does not change, and the evidence for that is
 * that its test file passes untouched. Adding these cases there would have
 * blurred the one assertion that proves it.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginShell } from "../features/auth/LoginShell";
import { PIPELINE_NODES } from "../features/auth/bid-pipeline-nodes";
import { SignInStatusFooter } from "../features/auth/SignInStatusFooter";
import { WORKSPACE_STAGES } from "../services/api/endpoints/applications";
import type { AuthPort } from "../services/auth/ports";

function enabledAuth(): AuthPort {
  return {
    isEnabled: () => true,
    login: vi.fn(async () => ({ userId: "u1", email: "a@b.c" })),
    restoreSession: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
  };
}

/** jsdom reports `navigator.onLine` as true; this flips it for a render. */
function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    value,
    configurable: true,
  });
}

afterEach(() => {
  setOnline(true);
});

describe("sign-in brand column (R-V1)", () => {
  it("says what the product is", () => {
    render(<LoginShell auth={enabledAuth()} />);
    expect(
      screen.getByText(/prepare stronger tender responses/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/without the distractions/i)).toBeInTheDocument();
    expect(screen.getByText(/focused tender preparation/i)).toBeInTheDocument();
  });

  it("states no quantity anywhere (R-V4)", () => {
    // There is no session on this screen, so there is no data. Any count
    // here — tenders tracked, companies served — would be a number nobody
    // measured. The version string is the one permitted numeral and lives
    // in the footer, so this scans the brand column alone.
    render(<LoginShell auth={enabledAuth()} />);
    const claim = screen.getByText(/prepare stronger tender responses/i);
    const panel = claim.closest("div")?.parentElement;
    expect(panel).not.toBeNull();
    expect(panel?.textContent ?? "").not.toMatch(/\d/);
  });

  it("puts nothing focusable ahead of the email field", async () => {
    // A decorative link in the brand column would sit between the user and
    // the thing they opened the application to do.
    const user = userEvent.setup();
    render(<LoginShell auth={enabledAuth()} />);
    await user.tab();
    expect(screen.getByLabelText("Email")).toHaveFocus();
  });

  it("uses design-system tokens rather than raw colour utilities", () => {
    const { container } = render(<LoginShell auth={enabledAuth()} />);
    expect(container.innerHTML).not.toMatch(
      /(bg|text|border|fill|stroke)-(slate|gray|zinc|neutral|stone|red|green|blue|emerald|amber|yellow)-\d{2,3}/,
    );
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe("bid pipeline graphic (R-V3)", () => {
  it("is announced rather than left as decoration", () => {
    render(<LoginShell auth={enabledAuth()} />);
    expect(
      screen.getByRole("img", { name: /discover, analyse, prepare, submit/i }),
    ).toBeInTheDocument();
  });

  it("names all four stages", () => {
    render(<LoginShell auth={enabledAuth()} />);
    const diagram = screen.getByRole("img", {
      name: /discover, analyse, prepare, submit/i,
    });
    for (const node of PIPELINE_NODES) {
      expect(within(diagram).getByText(node.label)).toBeInTheDocument();
    }
  });

  it("accounts for every real workspace stage exactly once", () => {
    // The graphic summarises the parent's eight stages. If the parent gains
    // a ninth and nobody places it, this fails — which is the point: the
    // sign-in screen must not keep describing a product that has moved on.
    const covered = PIPELINE_NODES.flatMap((node) => node.stages);
    expect([...covered].sort()).toEqual([...WORKSPACE_STAGES].sort());
    expect(new Set(covered).size).toBe(covered.length);
  });

  it("drives its motion from a class, so reduced motion can switch it off", () => {
    // The guard itself lives in theme.css; what this pins is that there is
    // a single hook for it and no JS timer behind a screen a user may leave
    // open all day.
    const { container } = render(<LoginShell auth={enabledAuth()} />);
    expect(container.querySelectorAll(".login-pipeline-pulse")).toHaveLength(1);
  });
});

describe("sign-in status footer (R-V5)", () => {
  it("reports the build and the host it will talk to", () => {
    render(<SignInStatusFooter apiBaseUrl="https://www.tenders-sa.org" />);
    expect(screen.getByText(/www\.tenders-sa\.org/)).toBeInTheDocument();
  });

  it("shows the hostname only, never a full URL", () => {
    render(<SignInStatusFooter apiBaseUrl="https://www.tenders-sa.org" />);
    expect(screen.queryByText(/https:\/\//)).toBeNull();
  });

  it("confirms reachability when online", () => {
    setOnline(true);
    render(<SignInStatusFooter />);
    expect(screen.getByText(/Connected/)).toBeInTheDocument();
  });

  it("says so before the user spends an attempt when offline", () => {
    setOnline(false);
    render(<SignInStatusFooter />);
    expect(
      screen.getByText(/Offline — sign-in needs a connection/i),
    ).toBeInTheDocument();
  });

  it("does not claim a live region the gated build already owns", () => {
    // `login-shell.test.tsx` reads the one `role="status"` on this screen to
    // find the gating notice. A second live region would break that and,
    // worse, announce itself over it.
    const { container } = render(<SignInStatusFooter />);
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("never carries the state in colour alone", () => {
    setOnline(false);
    const { container } = render(<SignInStatusFooter />);
    const dot = container.querySelector("span[aria-hidden]");
    expect(dot).not.toBeNull();
    expect(container.textContent).toMatch(/Offline/);
  });
});
