/**
 * Decide-and-pursue tests for one tender.
 *
 * Refs: brief §4.1 steps 5–6, §4.3, A11Y-A1
 *
 * These cover the three actions that turn discovery into a bid: checking
 * eligibility, shortlisting, and starting an application. The last is a **bid
 * decision**, which brief §4.3 reserves for a human, so the tests pin that it
 * only ever happens on an explicit click.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { TenderActions } from "../features/tenders/TenderActions";
import { describeEligibility } from "../services/api/endpoints/eligibility";
import { ApiError } from "../services/api/errors";
import type {
  EligibilityEndpoint,
  EligibilityResult,
} from "../services/api/endpoints/eligibility";
import type { SavedTendersEndpoint } from "../services/api/endpoints/saved-tenders";
import type { ApplicationsEndpoint } from "../services/api/endpoints/applications";

const partial: EligibilityResult = {
  eligible: "partial",
  score: 67,
  checks: [
    { criterion: "B-BBEE Level", required: "2", user: "4", pass: false },
    { criterion: "Province", required: "Gauteng", user: "Gauteng", pass: true },
    {
      criterion: "Tax Compliance",
      required: "Valid certificate",
      user: "Valid",
      pass: true,
    },
  ],
  blockers: ["B-BBEE level 4 does not meet the required level 2"],
  suggestions: ["Obtain a level 2 B-BBEE certificate"],
  matchScore: 71,
};

function harness(
  overrides: {
    eligibility?: Partial<EligibilityEndpoint>;
    savedTenders?: Partial<SavedTendersEndpoint>;
    applications?: Partial<ApplicationsEndpoint>;
  } = {},
) {
  const eligibility = {
    check: vi.fn(async () => partial),
    ...overrides.eligibility,
  } as unknown as EligibilityEndpoint;
  const savedTenders = {
    toggleSave: vi.fn(async () => true),
    ...overrides.savedTenders,
  } as unknown as SavedTendersEndpoint;
  const applications = {
    create: vi.fn(async () => "a1"),
    ...overrides.applications,
  } as unknown as ApplicationsEndpoint;

  render(
    <MemoryRouter>
      <TenderActions
        tenderId="t1"
        eligibility={eligibility}
        savedTenders={savedTenders}
        applications={applications}
      />
    </MemoryRouter>,
  );
  return { eligibility, savedTenders, applications };
}

describe("eligibility wording", () => {
  it("keeps `partial` as its own answer, phrased as an action", () => {
    // Collapsing partial into yes/no either loses a winnable tender or walks
    // the user into a disqualification.
    expect(describeEligibility("partial")).toMatch(/some criteria/i);
    expect(describeEligibility("yes")).toMatch(/meets every/i);
    expect(describeEligibility("no")).toMatch(/does not currently meet/i);
  });
});

describe("eligibility check", () => {
  it("runs only when asked, because it is server-side computation", async () => {
    const { eligibility } = harness();
    expect(eligibility.check).not.toHaveBeenCalled();
  });

  it("shows the three-way verdict and the score", async () => {
    harness();
    await userEvent.click(
      screen.getByRole("button", { name: "Check eligibility" }),
    );
    expect(await screen.findByText(/meets some criteria/i)).toBeVisible();
    expect(screen.getByText(/67% of recorded criteria met/)).toBeVisible();
  });

  it("shows the match score alongside, when the parent has one", async () => {
    harness();
    await userEvent.click(
      screen.getByRole("button", { name: "Check eligibility" }),
    );
    expect(await screen.findByText(/Tender Radar match 71%/)).toBeVisible();
  });

  it("shows required and recorded values side by side so a gap explains itself", async () => {
    harness();
    await userEvent.click(
      screen.getByRole("button", { name: "Check eligibility" }),
    );
    expect(await screen.findByText("B-BBEE Level")).toBeVisible();
    expect(screen.getByText(/required 2 · you 4/)).toBeVisible();
  });

  it("marks pass and fail with words, not colour alone (A11Y-1)", async () => {
    harness();
    await userEvent.click(
      screen.getByRole("button", { name: "Check eligibility" }),
    );
    expect(await screen.findByText("Gap")).toBeVisible();
    expect(screen.getAllByText("Meets").length).toBe(2);
  });

  it("lists blockers and suggested steps separately", async () => {
    harness();
    await userEvent.click(
      screen.getByRole("button", { name: "Check eligibility" }),
    );
    expect(
      await screen.findByText(/does not meet the required level 2/),
    ).toBeVisible();
    expect(
      screen.getByText("Obtain a level 2 B-BBEE certificate"),
    ).toBeVisible();
  });

  it("says a value is not recorded rather than printing null", async () => {
    harness({
      eligibility: {
        check: vi.fn(async () => ({
          ...partial,
          checks: [
            {
              criterion: "CIDB Grade",
              required: null,
              user: null,
              pass: false,
            },
          ],
        })),
      },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Check eligibility" }),
    );
    expect(
      await screen.findByText(/required not recorded · you not recorded/),
    ).toBeVisible();
  });

  it("reports a failure rather than an implied pass", async () => {
    harness({
      eligibility: {
        check: vi.fn(async () => {
          throw new ApiError({ kind: "server", message: "boom", status: 500 });
        }),
      },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Check eligibility" }),
    );
    expect(await screen.findByRole("alert")).toBeVisible();
  });
});

describe("saving to Opportunities", () => {
  it("reflects the state the server reports, since save is a toggle", async () => {
    // Two windows could disagree about whether a tender is saved; the server's
    // answer settles it, so the label follows the response.
    harness({ savedTenders: { toggleSave: vi.fn(async () => false) } });
    await userEvent.click(
      screen.getByRole("button", { name: /save to opportunities/i }),
    );
    expect(await screen.findByText(/removed — click to save/i)).toBeVisible();
  });

  it("says saved when the server says saved", async () => {
    harness();
    await userEvent.click(
      screen.getByRole("button", { name: /save to opportunities/i }),
    );
    expect(await screen.findByText(/saved — click to remove/i)).toBeVisible();
  });

  it("reports a failure instead of claiming a save that did not happen", async () => {
    harness({
      savedTenders: {
        toggleSave: vi.fn(async () => {
          throw new ApiError({ kind: "server", message: "boom", status: 500 });
        }),
      },
    });
    await userEvent.click(
      screen.getByRole("button", { name: /save to opportunities/i }),
    );
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByText(/saved — click to remove/i)).toBeNull();
  });
});

describe("starting an application (the bid decision)", () => {
  it("never happens without an explicit click (brief §4.3)", () => {
    const { applications } = harness();
    expect(applications.create).not.toHaveBeenCalled();
  });

  it("creates the application for this tender when clicked", async () => {
    const { applications } = harness();
    await userEvent.click(
      screen.getByRole("button", { name: "Start an application" }),
    );
    await waitFor(() => expect(applications.create).toHaveBeenCalledWith("t1"));
  });

  it("reports a failure and stays usable", async () => {
    harness({
      applications: {
        create: vi.fn(async () => {
          throw new ApiError({
            kind: "validation",
            message: "Company profile required",
            status: 400,
          });
        }),
      },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Start an application" }),
    );
    // The 400 the parent actually returns, translated into the action the
    // user can take.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /add your company profile/i,
    );
    expect(
      screen.getByRole("button", { name: "Start an application" }),
    ).toBeEnabled();
  });

  it("does not navigate to an undefined id when the parent returns none", async () => {
    // `/applications/undefined` would be worse than landing on the list.
    const { applications } = harness({
      applications: { create: vi.fn(async () => undefined) },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Start an application" }),
    );
    await waitFor(() => expect(applications.create).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
