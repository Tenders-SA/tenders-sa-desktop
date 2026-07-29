/**
 * Settings and Tasks tests.
 *
 * Refs: INT-A3, REQ-A8, A11Y-A1
 *
 * The load-bearing one here is data loss: `PUT /api/v1/users/preferences`
 * **replaces every column**, so a save that omitted the fields this screen
 * cannot edit would silently wipe a user's categories and keywords. That is
 * pinned first and hardest.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Settings } from "../features/settings/Settings";
import { Tasks } from "../features/tasks/Tasks";
import { ApiError } from "../services/api/errors";
import type {
  PreferenceValues,
  PreferencesEndpoint,
} from "../services/api/endpoints/preferences";
import type { DashboardEndpoint } from "../services/api/endpoints/dashboard";
import type { PlannerEndpoint } from "../services/api/endpoints/planner";

const configured: PreferenceValues = {
  preferredCategories: ["Construction", "Civil engineering"],
  excludedCategories: ["Catering"],
  preferredProvinces: ["Gauteng"],
  mustIncludeKeywords: ["roadworks"],
  excludedKeywords: ["cleaning"],
  minTenderValue: 100_000,
  maxTenderValue: 5_000_000,
  minMatchScore: 70,
};

function settingsHarness(
  options: { isDefault?: boolean; values?: PreferenceValues } = {},
) {
  const update = vi.fn(async () => {});
  const endpoint = {
    get: vi.fn(async () => ({
      preferences: options.values ?? configured,
      isDefault: options.isDefault ?? false,
    })),
    update,
  } as unknown as PreferencesEndpoint;

  render(<Settings endpoint={endpoint} />);
  return { endpoint, update };
}

describe("Settings — preference saving", () => {
  it("sends every field, so the ones it cannot edit are not wiped", async () => {
    // THE important test. The route replaces all columns, so a partial payload
    // would silently destroy the user's categories and keywords.
    const { update } = settingsHarness();
    await screen.findByText("Tender Radar preferences");

    await userEvent.selectOptions(
      screen.getByLabelText("Minimum match score"),
      "80",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Save preferences" }),
    );

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith({
      ...configured,
      minMatchScore: 80,
    });
  });

  it("keeps the categories and keywords byte-for-byte on save", async () => {
    const { update } = settingsHarness();
    await screen.findByText("Tender Radar preferences");
    await userEvent.click(screen.getByLabelText("Limpopo"));
    await userEvent.click(
      screen.getByRole("button", { name: "Save preferences" }),
    );

    await waitFor(() => expect(update).toHaveBeenCalled());
    const sent = (update as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][0] as PreferenceValues;
    expect(sent.preferredCategories).toEqual(configured.preferredCategories);
    expect(sent.mustIncludeKeywords).toEqual(configured.mustIncludeKeywords);
    expect(sent.minTenderValue).toBe(configured.minTenderValue);
    expect(sent.preferredProvinces).toEqual(["Gauteng", "Limpopo"]);
  });

  it("cannot be saved until something changes", async () => {
    settingsHarness();
    await screen.findByText("Tender Radar preferences");
    expect(
      screen.getByRole("button", { name: "Save preferences" }),
    ).toBeDisabled();
  });

  it("says these are platform defaults when nothing has been set", async () => {
    // `isDefault` distinguishes "you chose 70" from "nobody has set this".
    settingsHarness({ isDefault: true });
    expect(
      await screen.findByText(/have not set any preferences yet/i),
    ).toBeVisible();
  });

  it("does not claim defaults when the user has configured them", async () => {
    settingsHarness({ isDefault: false });
    await screen.findByText("Tender Radar preferences");
    expect(screen.queryByText(/have not set any preferences yet/i)).toBeNull();
  });

  it("shows the uneditable preferences rather than hiding them", async () => {
    // The user should still see what is affecting their matches.
    settingsHarness();
    expect(
      await screen.findByText("Construction, Civil engineering"),
    ).toBeVisible();
    expect(screen.getByText("roadworks")).toBeVisible();
  });

  it("says `None set` rather than rendering a blank row", async () => {
    settingsHarness({
      values: { ...configured, excludedKeywords: [] },
    });
    await screen.findByText("Tender Radar preferences");
    expect(screen.getAllByText("None set").length).toBeGreaterThan(0);
  });

  it("reports a save failure rather than claiming success", async () => {
    const endpoint = {
      get: vi.fn(async () => ({ preferences: configured, isDefault: false })),
      update: vi.fn(async () => {
        throw new ApiError({ kind: "server", message: "boom", status: 500 });
      }),
    } as unknown as PreferencesEndpoint;
    render(<Settings endpoint={endpoint} />);
    await screen.findByText("Tender Radar preferences");

    await userEvent.selectOptions(
      screen.getByLabelText("Minimum match score"),
      "90",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Save preferences" }),
    );
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByText(/^Saved\./)).toBeNull();
  });

  it("shows the signed-in account when there is a session", () => {
    const endpoint = {
      get: vi.fn(() => new Promise<never>(() => {})),
      update: vi.fn(),
    } as unknown as PreferencesEndpoint;
    render(
      <Settings
        endpoint={endpoint}
        session={{ userId: "u1", email: "buyer@example.co.za" }}
      />,
    );
    expect(screen.getByText("buyer@example.co.za")).toBeVisible();
  });
});

describe("Tasks", () => {
  const overdue = {
    id: "e1",
    title: "Site visit",
    description: null,
    eventDate: "2020-01-01T00:00:00.000Z",
    eventType: "SITE_VISIT",
    isCompleted: false,
  };
  const future = {
    id: "e2",
    title: "Closing date",
    description: null,
    eventDate: "2099-01-01T00:00:00.000Z",
    eventType: "CLOSING_DATE",
    isCompleted: false,
  };

  function harness(options: {
    actions?: unknown;
    events?: unknown[];
    actionsFail?: boolean;
  }) {
    const dashboard = {
      getActionItems: vi.fn(async () => {
        if (options.actionsFail) {
          throw new ApiError({ kind: "server", message: "boom", status: 500 });
        }
        return options.actions ?? [];
      }),
    } as unknown as DashboardEndpoint;
    const planner = {
      listEvents: vi.fn(async () => options.events ?? []),
    } as unknown as PlannerEndpoint;
    render(<Tasks dashboard={dashboard} planner={planner} />);
    return { dashboard, planner };
  }

  it("shows overdue preparation steps and says they are overdue", async () => {
    harness({ events: [overdue] });
    expect(await screen.findByText(/Overdue ·/)).toBeVisible();
    // Exactly one: the humanised event type would otherwise repeat the title
    // verbatim for an event named after its own type.
    expect(screen.getAllByText("Site visit")).toHaveLength(1);
  });

  it("excludes future events, which belong on the Calendar", async () => {
    // A task list containing next month's closing dates stops being a list of
    // things to do now.
    harness({ events: [future] });
    expect(
      await screen.findByText(/nothing is overdue or due today/i),
    ).toBeVisible();
    expect(screen.queryByText("Closing date")).toBeNull();
  });

  it("still shows due work when the action centre fails", async () => {
    // The two panels load independently on purpose: an action-centre outage
    // must not hide a missed site visit.
    harness({ events: [overdue], actionsFail: true });
    expect(await screen.findByText(/Overdue ·/)).toBeVisible();
    expect(screen.getByText("Site visit")).toBeVisible();
    expect(screen.getByRole("alert")).toBeVisible();
  });

  it("shows action-centre items waiting on the user", async () => {
    harness({ actions: [{ title: "Approve the JV agreement" }] });
    expect(await screen.findByText("Approve the JV agreement")).toBeVisible();
  });

  it("says nothing is waiting when both sources are empty", async () => {
    harness({});
    expect(await screen.findByText(/nothing is waiting on you/i)).toBeVisible();
  });
});
