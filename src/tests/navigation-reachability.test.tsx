/**
 * Every advertised destination must actually exist.
 *
 * Refs: REQ-16
 *
 * This file exists because of a real defect, not a hypothetical one. When
 * tender discovery shipped, "Tender Radar" was flipped to
 * `available: true` with `path: "/tenders"` -- but the route was mounted
 * only when a session existed, so in a gated build the link fell through to
 * the catch-all and silently redirected home. The nav claimed a working
 * feature and delivered a redirect, which is precisely the dishonest
 * affordance REQ-16 forbids, and nothing caught it.
 *
 * The test below is derived from `NAVIGATION_GROUPS` rather than from a
 * hard-coded list, so marking any future item `available` without building
 * its route fails here instead of in front of a user.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "../app/router/routes";
import { ALL_NAVIGATION_ITEMS } from "../components/navigation/navigation-items";
import type { AuthPort } from "../services/auth/ports";
import type { ApiClients } from "../app/auth-wiring";
import { stubApiClients } from "./fixtures/api-clients";

/** Gated build: `isEnabled()` false is what opens the escape hatch. */
const gatedAuth = {
  isEnabled: () => false,
  login: vi.fn(),
  restoreSession: vi.fn(async () => undefined),
  logout: vi.fn(async () => undefined),
} as unknown as AuthPort;

const clients = stubApiClients();

function renderAt(path: string, routeClients = clients) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes
        auth={gatedAuth}
        isAuthenticated={false}
        clients={routeClients}
      />
    </MemoryRouter>,
  );
}

const availablePaths = ALL_NAVIGATION_ITEMS.filter(
  (item) => item.available && item.path,
).map((item) => ({ label: item.label, path: item.path as string }));

describe("navigation reachability", () => {
  it("advertises at least one destination, so the sweep below is not vacuous", () => {
    // Without this, deleting every path would make the loop pass trivially.
    expect(availablePaths.length).toBeGreaterThan(1);
  });

  it.each(availablePaths)(
    "$label ($path) resolves to its own route, not a redirect home",
    ({ path }) => {
      renderAt(path);
      if (path === "/") {
        expect(
          screen.getByRole("heading", { name: "Command Centre" }),
        ).toBeVisible();
        return;
      }
      // The failure mode being guarded: a missing route falls through to
      // `path="*"` and lands on the Command Centre instead.
      expect(
        screen.queryByRole("heading", { name: "Command Centre" }),
      ).toBeNull();
    },
  );

  it("keeps /tenders reachable with no session, because the nav promises it", () => {
    renderAt("/tenders");
    expect(
      screen.getByRole("heading", { name: "Find the right tender to prepare" }),
    ).toBeVisible();
  });

  it("mounts the tender detail route", () => {
    renderAt("/tenders/t1");
    expect(clients.tenders.get).toHaveBeenCalledWith("t1", expect.anything());
  });

  it("decodes an id containing a slash rather than splitting the path", () => {
    // Parent ids are cuids today, but the list route links with
    // `encodeURIComponent`, so the detail route has to decode symmetrically.
    renderAt(`/tenders/${encodeURIComponent("a/b")}`);
    expect(clients.tenders.get).toHaveBeenCalledWith("a/b", expect.anything());
  });

  it("mounts the existing application workspace deep link", () => {
    renderAt(`/applications/${encodeURIComponent("application/42")}`);
    expect(clients.applications.get).toHaveBeenCalledWith(
      "application/42",
      expect.anything(),
    );
    expect(clients.applications.getCockpit).toHaveBeenCalledWith(
      "application/42",
      expect.anything(),
    );
  });

  it.each(["understand", "qualify", "plan", "draft", "review"])(
    "keeps the %s workflow stage directly addressable",
    async (stage) => {
      const routeClients = stubApiClients({
        applications: {
          ...clients.applications,
          get: vi.fn(async () => ({
            id: "a1",
            tenderId: "t1",
            status: "DRAFT",
            submittedAt: null,
            createdAt: "2026-08-01T00:00:00.000Z",
            updatedAt: "2026-08-01T00:00:00.000Z",
            notes: null,
            isArchived: false,
            tender: {
              id: "t1",
              title: "Security services",
              referenceNumber: "RFQ-3",
              sourceOrganization: "Dept of Health",
              closingDate: "2099-01-01T00:00:00.000Z",
            },
          })),
        } as unknown as ApiClients["applications"],
      });
      renderAt(`/applications/a1/${stage}`, routeClients);
      expect(
        await screen.findByRole("heading", {
          level: 2,
          name:
            stage === "review"
              ? "Review & Export"
              : `${stage.charAt(0).toUpperCase()}${stage.slice(1)}`,
        }),
      ).toBeVisible();
    },
  );

  it("redirects an unknown workflow stage to Understand", async () => {
    const routeClients = stubApiClients({
      applications: {
        ...clients.applications,
        get: vi.fn(async () => ({
          id: "a1",
          tenderId: "t1",
          status: "DRAFT",
          submittedAt: null,
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
          notes: null,
          isArchived: false,
          tender: {
            id: "t1",
            title: "Security services",
            referenceNumber: "RFQ-3",
            sourceOrganization: "Dept of Health",
            closingDate: "2099-01-01T00:00:00.000Z",
          },
        })),
      } as unknown as ApiClients["applications"],
    });
    renderAt("/applications/a1/not-a-stage", routeClients);
    expect(
      await screen.findByRole("heading", { level: 2, name: "Understand" }),
    ).toBeVisible();
  });

  it("still sends a genuinely unknown path home", () => {
    renderAt("/not-a-real-screen");
    expect(
      screen.getByRole("heading", { name: "Command Centre" }),
    ).toBeVisible();
  });

  it("marks unbuilt items with no path at all", () => {
    // The other half of the invariant: an unavailable item must not carry a
    // path, or a future refactor could turn it into a working-looking link.
    const unavailableWithPath = ALL_NAVIGATION_ITEMS.filter(
      (item) => !item.available && item.path,
    );
    expect(unavailableWithPath).toEqual([]);
  });
});
