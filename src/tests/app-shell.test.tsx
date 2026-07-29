import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "../app/layouts/AppLayout";
import { CommandCentre } from "../features/command-centre/CommandCentre";
import { ProtectedRoute } from "../app/router/ProtectedRoute";
import { AppRoutes } from "../app/router/routes";
import type { AuthPort } from "../services/auth/ports";
import { stubApiClients } from "./fixtures/api-clients";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { SyncStatus } from "../components/common/SyncStatus";
import {
  ALL_NAVIGATION_ITEMS,
  NAVIGATION_GROUPS,
} from "../components/navigation/navigation-items";

function renderShell(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<CommandCentre />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("navigation model", () => {
  it("matches the product brief's labels and grouping", () => {
    // Transcribed from docs/prompts §5 "Primary navigation".
    expect(NAVIGATION_GROUPS.map((g) => g.items.map((i) => i.label))).toEqual([
      [
        "Command Centre",
        "Tender Radar",
        "Opportunities",
        "Application Workspaces",
        "Proposals",
        "Calendar",
        "Tasks",
      ],
      [
        "Company Profile",
        "Company Document Vault",
        "JV and Partner Network",
        "Supplier Intelligence",
        "Buyer Intelligence",
        "Award Intelligence",
      ],
      ["Notifications", "Reports", "Settings"],
    ]);
  });

  it("marks only built destinations as available, so no later phase looks shipped", () => {
    // Grows only when a screen actually exists, and every entry here is
    // checked against a real route by navigation-reachability.test.tsx.
    // Adding a label without building its route is exactly what the
    // `available` flag exists to prevent.
    const available = ALL_NAVIGATION_ITEMS.filter((item) => item.available);
    expect(available.map((item) => item.label)).toEqual([
      "Command Centre",
      "Tender Radar",
      "Opportunities",
      "Application Workspaces",
      "Calendar",
      "Tasks",
      "Company Profile",
      "Company Document Vault",
      "Notifications",
      "Settings",
    ]);
  });

  it("still marks the modules with no parent capability as unavailable", () => {
    // These are not merely unbuilt UI: each needs either a capability the
    // parent exposes only to its own pages, or a write flow that would need
    // the accessible-form foundation first.
    const unavailable = ALL_NAVIGATION_ITEMS.filter((item) => !item.available);
    expect(unavailable.map((item) => item.label)).toEqual([
      "Proposals",
      "JV and Partner Network",
      "Supplier Intelligence",
      "Buyer Intelligence",
      "Award Intelligence",
      "Reports",
    ]);
  });

  it("gives every unavailable item no path at all", () => {
    for (const item of ALL_NAVIGATION_ITEMS) {
      if (!item.available) {
        expect(item.path, `${item.label} must not be routable`).toBeUndefined();
      }
    }
  });
});

describe("AppLayout", () => {
  it("renders the primary navigation landmark", () => {
    renderShell();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeVisible();
  });

  it("renders later-phase destinations as disabled, not as links", () => {
    renderShell();
    const nav = screen.getByRole("navigation", { name: "Primary" });

    // The one real destination is a link...
    expect(
      within(nav).getByRole("link", { name: "Command Centre" }),
    ).toBeVisible();
    // ...and the rest are not links at all.
    expect(within(nav).queryByRole("link", { name: "Proposals" })).toBeNull();
    expect(within(nav).getByText("Proposals")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("exposes a skip link as the first focusable element (A11Y-1)", async () => {
    renderShell();
    await userEvent.tab();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveFocus();
  });

  it("renders a main landmark for the routed content", () => {
    renderShell();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Command Centre" }),
    ).toBeVisible();
  });
});

describe("CommandCentre", () => {
  // Now contains a `Link`, so it needs a router around it.
  const renderCentre = () =>
    render(
      <MemoryRouter>
        <CommandCentre />
      </MemoryRouter>,
    );

  it("says what to do rather than rendering empty widgets with no session", () => {
    // COPY UPDATED THREE TIMES, and the intent has never changed: the page
    // must not imply that data it does not have is present. Phase 0 said
    // "nothing to show yet"; TASK-2.9 replaced that with "not connected yet"
    // once the plan panel became real; now the modules are real too, so with
    // no session the honest statement is "sign in".
    renderCentre();
    expect(screen.getByText(/sign in to see your deadlines/i)).toBeVisible();
  });

  it("offers real ways into the tender modules, not descriptions of them", () => {
    renderCentre();
    expect(
      screen.getByRole("link", { name: "Open Tender Radar" }),
    ).toHaveAttribute("href", "/radar");
    expect(
      screen.getByRole("link", { name: "Browse all tenders" }),
    ).toHaveAttribute("href", "/tenders");
  });

  it("renders no data panels at all when there is no session", () => {
    // Panels are omitted rather than rendered empty: an empty deadline panel
    // reads as "nothing closes soon", which is a claim we cannot make.
    renderCentre();
    expect(screen.queryByText("Your plan")).toBeNull();
    expect(screen.queryByText("Closing this week")).toBeNull();
    expect(screen.queryByText("Recent activity")).toBeNull();
  });
});

describe("CommandPalette", () => {
  it("opens on Ctrl+K and focuses the search field", async () => {
    renderShell();
    await userEvent.keyboard("{Control>}k{/Control}");

    const dialog = await screen.findByRole("dialog", {
      name: "Command palette",
    });
    expect(dialog).toBeVisible();
    expect(screen.getByLabelText("Search commands")).toHaveFocus();
  });

  it("closes on Escape", async () => {
    renderShell();
    await userEvent.keyboard("{Control>}k{/Control}");
    await screen.findByRole("dialog", { name: "Command palette" });

    await userEvent.keyboard("{Escape}");

    expect(
      screen.queryByRole("dialog", { name: "Command palette" }),
    ).toBeNull();
  });

  it("filters entries by the typed query", async () => {
    renderShell();
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.type(screen.getByLabelText("Search commands"), "proposal");

    expect(screen.getByRole("button", { name: /Proposals/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Calendar/ })).toBeNull();
  });

  it("shows an empty state when nothing matches", async () => {
    renderShell();
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.type(
      screen.getByLabelText("Search commands"),
      "zzzznotathing",
    );

    expect(screen.getByText("No matching commands")).toBeVisible();
  });

  it("cannot route into a later-phase destination", async () => {
    renderShell();
    await userEvent.keyboard("{Control>}k{/Control}");

    // Picks an item that is still genuinely unbuilt. This used to name
    // Tender Radar, which shipped with tender discovery -- so the example
    // moved rather than the rule. Any unavailable item must stay disabled,
    // so the palette cannot become a back door into an unbuilt route.
    const laterPhase = screen.getByRole("button", { name: /Proposals/ });
    expect(laterPhase).toBeDisabled();
  });

  it("can route into a destination that actually exists", async () => {
    renderShell();
    await userEvent.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("button", { name: /Tender Radar/ })).toBeEnabled();
  });
});

describe("ProtectedRoute", () => {
  function renderProtected(props: {
    isAuthenticated: boolean;
    allowUnauthenticated: boolean;
  }) {
    return render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<ProtectedRoute {...props} />}>
            <Route index element={<p>protected content</p>} />
          </Route>
          <Route path="/login" element={<p>login screen</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("redirects an unauthenticated user when the escape hatch is off", () => {
    renderProtected({ isAuthenticated: false, allowUnauthenticated: false });
    expect(screen.getByText("login screen")).toBeVisible();
  });

  it("admits an authenticated user", () => {
    renderProtected({ isAuthenticated: true, allowUnauthenticated: false });
    expect(screen.getByText("protected content")).toBeVisible();
  });

  it("admits an unauthenticated user only while auth is gated off", () => {
    renderProtected({ isAuthenticated: false, allowUnauthenticated: true });
    expect(screen.getByText("protected content")).toBeVisible();
  });
});

describe("ErrorBoundary", () => {
  function Boom(): never {
    throw new Error("pricing payload 12345 leaked into the message");
  }

  it("catches a render error and shows a generic, non-leaking message", () => {
    // React logs the caught error; silence it for a clean test run.
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <Boom />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/something went wrong/i);
    expect(alert.textContent).not.toContain("12345");
    expect(onError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});

describe("SyncStatus", () => {
  it("labels connectivity in text, never colour alone", () => {
    render(<SyncStatus />);
    expect(
      screen.getByLabelText("Connectivity and sync status"),
    ).toHaveTextContent(/online|offline/i);
  });

  it("reports pending operations and conflicts needing review", () => {
    render(<SyncStatus pendingCount={3} conflictCount={2} />);
    const status = screen.getByLabelText("Connectivity and sync status");
    expect(status).toHaveTextContent("3 pending");
    expect(status).toHaveTextContent("2 needing review");
  });

  it("omits counts when there is nothing pending", () => {
    render(<SyncStatus pendingCount={0} conflictCount={0} />);
    const status = screen.getByLabelText("Connectivity and sync status");
    expect(status).not.toHaveTextContent("pending");
  });
});

describe("ProtectedRoute escape hatch (TASK-2.10, REQ-A9)", () => {
  function authWith(enabled: boolean): AuthPort {
    return {
      isEnabled: () => enabled,
      login: vi.fn(),
      restoreSession: vi.fn(async () => undefined),
      logout: vi.fn(async () => undefined),
    } as unknown as AuthPort;
  }

  const clients = stubApiClients();

  const routesAt = (enabled: boolean, isAuthenticated: boolean) => (
    <MemoryRouter initialEntries={["/"]}>
      <AppRoutes
        auth={authWith(enabled)}
        isAuthenticated={isAuthenticated}
        clients={clients}
      />
    </MemoryRouter>
  );

  it("closes itself once auth is live, rather than needing manual removal", () => {
    // The hatch exists only so a gated build is reachable. If it stayed
    // open after auth shipped, every protected route would be reachable
    // with no session -- an unauthenticated bypass, not a convenience.
    render(routesAt(true, false));
    // Redirected to login, not into the shell.
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  it("stays open while auth is gated, so the shell remains reachable", () => {
    render(routesAt(false, false));
    expect(
      screen.getByRole("heading", { name: "Command Centre" }),
    ).toBeVisible();
  });

  it("lets an authenticated user into the shell when auth is live", () => {
    render(routesAt(true, true));
    expect(
      screen.getByRole("heading", { name: "Command Centre" }),
    ).toBeVisible();
  });

  it("protects the tender routes too, not just the index", () => {
    // A new route under the guarded layout must inherit the guard. Mounting
    // tenders outside it would be an unauthenticated read path.
    render(
      <MemoryRouter initialEntries={["/tenders"]}>
        <AppRoutes
          auth={authWith(true)}
          isAuthenticated={false}
          clients={clients}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Tenders" })).toBeNull();
  });
});
