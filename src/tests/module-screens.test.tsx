/**
 * Screen tests for the workflow modules.
 *
 * Refs: REQ-16, REQ-A8, A11Y-A1, REL-A1, brief §4.2, §4.3
 *
 * These concentrate on the claims a screen makes rather than its markup: that
 * an empty state does not assert something the payload never said, that a
 * missing company profile is reported as such rather than as "no matches",
 * that nothing offers to submit a bid, and that a schema failure renders as a
 * handled state instead of a blank page.
 */

import { describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ApiError } from "../services/api/errors";
import { TenderRadar } from "../features/radar/TenderRadar";
import { Opportunities } from "../features/opportunities/Opportunities";
import { ApplicationWorkspace } from "../features/applications/ApplicationWorkspace";
import { ResponseBlueprintPanel } from "../features/applications/workspace/ResponseBlueprintPanel";
import { CompanyProfileScreen } from "../features/company/CompanyProfile";
import { DocumentVault } from "../features/documents/DocumentVault";
import { Calendar } from "../features/calendar/Calendar";
import { NotificationsScreen } from "../features/notifications/Notifications";
import { collectFactorRows } from "../features/radar/match-factor-rows";
import { sortByUrgency } from "../features/documents/document-order";
import { formatTimestamp } from "../features/command-centre/activity-format";
import type { RecommendationsEndpoint } from "../services/api/endpoints/recommendations";
import type { SavedTendersEndpoint } from "../services/api/endpoints/saved-tenders";
import type { ApplicationsEndpoint } from "../services/api/endpoints/applications";
import type { CompanyEndpoint } from "../services/api/endpoints/company";
import type { SubscriptionEndpoint } from "../services/api/endpoints/subscription";
import type { DocumentsEndpoint } from "../services/api/endpoints/documents";
import type { PlannerEndpoint } from "../services/api/endpoints/planner";
import type { NotificationsEndpoint } from "../services/api/endpoints/notifications";
import type { CompanyDocument } from "../services/api/endpoints/documents";
import type { SaveDownloadPort } from "../services/storage/save-download";
import type { DocumentActionPort } from "../services/storage/document-actions";

const wrap = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Tender Radar screen", () => {
  const recommendation = {
    id: "r1",
    tenderId: "t1",
    tender: {
      id: "t1",
      title: "Bridge repairs",
      referenceNumber: "RFQ-1",
      description: null,
      closingDate: "2099-01-01T00:00:00.000Z",
      estimatedValue: 500_000,
      province: "Gauteng",
      sourceOrganization: "SANRAL",
      status: "ACTIVE",
    },
    score: 82,
    baseScore: 78,
    reasoning: "Strong industry and province match",
    factors: { industry: { score: 20, maxScore: 25 } },
    improvementAreas: ["CIDB grade 6 required"],
    calculatedAt: "2026-07-29T00:00:00.000Z",
    matchCategory: "highly_qualified" as const,
  };

  function endpoint(result: unknown): RecommendationsEndpoint {
    return {
      list: vi.fn(async () => result),
      explain: vi.fn(),
      newCount: vi.fn(),
      refresh: vi.fn(async () => {}),
      scanScenario: vi.fn(),
    } as unknown as RecommendationsEndpoint;
  }

  function fullRadar(
    overrides: {
      recommendations?: RecommendationsEndpoint;
      savedTenders?: SavedTendersEndpoint;
      company?: CompanyEndpoint;
      subscription?: SubscriptionEndpoint;
    } = {},
  ) {
    return (
      <TenderRadar
        recommendations={
          overrides.recommendations ??
          endpoint({
            state: "ready",
            recommendations: [recommendation],
            hasMore: false,
            offset: 0,
            limit: 50,
          })
        }
        savedTenders={
          overrides.savedTenders ??
          ({
            listAllIds: vi.fn(async () => ["t1"]),
            toggleSave: vi.fn(),
          } as unknown as SavedTendersEndpoint)
        }
        company={
          overrides.company ??
          ({
            getExtendedProfile: vi.fn(async () => ({
              company: { id: "c1", name: "Acme", industryCodes: [] },
              profile: null,
            })),
          } as unknown as CompanyEndpoint)
        }
        subscription={
          overrides.subscription ??
          ({
            getStatus: vi.fn(async () => ({
              kind: "subscribed",
              subscription: { tier: "professional" },
            })),
          } as unknown as SubscriptionEndpoint)
        }
      />
    );
  }

  it("composes the full 30-score workspace from existing endpoint owners", async () => {
    const recommendations = endpoint({
      state: "ready",
      recommendations: [recommendation],
      hasMore: false,
      offset: 0,
      limit: 50,
    });
    wrap(fullRadar({ recommendations }));

    expect(await screen.findByText("82% match")).toBeVisible();
    expect(recommendations.list).toHaveBeenCalledWith(
      { minScore: 30, limit: 50 },
      expect.any(AbortSignal),
    );
  });

  it("keeps matches visible when profile and saved reads fail", async () => {
    wrap(
      fullRadar({
        savedTenders: {
          listAllIds: vi.fn(async () => {
            throw new Error("saved down");
          }),
        } as unknown as SavedTendersEndpoint,
        company: {
          getExtendedProfile: vi.fn(async () => {
            throw new Error("profile down");
          }),
        } as unknown as CompanyEndpoint,
      }),
    );

    expect(await screen.findByText("82% match")).toBeVisible();
    expect(
      screen.getByText(/saved status is temporarily unavailable/i),
    ).toBeVisible();
    expect(
      screen.getByText(/profile guidance is temporarily unavailable/i),
    ).toBeVisible();
  });

  it("does not turn an entitlement outage into a free-tier state", async () => {
    wrap(
      fullRadar({
        subscription: {
          getStatus: vi.fn(async () => {
            throw new ApiError({
              kind: "server",
              message: "billing down",
              status: 500,
            });
          }),
        } as unknown as SubscriptionEndpoint,
      }),
    );

    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByText(/upgrade/i)).toBeNull();
  });

  it("renders the paid Radar hierarchy and post-cap headline counts", async () => {
    wrap(fullRadar());
    expect(
      await screen.findByRole("heading", { name: /your tender radar/i }),
    ).toBeVisible();
    expect(screen.getByText(/professional · up to 50 matches/i)).toBeVisible();
    expect(screen.getByText(/radar last calculated/i)).toBeVisible();
    expect(
      screen.getByText("All matches").nextElementSibling,
    ).toHaveTextContent("1");
    const qualifiedMetric = screen
      .getAllByText("Highly qualified")
      .find((element) => element.tagName === "DT");
    expect(qualifiedMetric?.nextElementSibling).toHaveTextContent("1");
  });

  it("renders a real free-tier state with existing desktop destinations", async () => {
    wrap(
      fullRadar({
        subscription: {
          getStatus: vi.fn(async () => ({ kind: "none" })),
        } as unknown as SubscriptionEndpoint,
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: /tender radar is available on starter and above/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /browse tenders/i }),
    ).toHaveAttribute("href", "/tenders");
    expect(
      screen.getByRole("link", { name: /view plan details/i }),
    ).toHaveAttribute("href", "/settings");
  });

  it("filters through accessible score-band tabs and resets honestly", async () => {
    const potential = {
      ...recommendation,
      id: "r2",
      tenderId: "t2",
      tender: {
        ...recommendation.tender,
        id: "t2",
        title: "Potential roadworks",
      },
      score: 55,
      matchCategory: "good_match" as const,
    };
    wrap(
      fullRadar({
        recommendations: endpoint({
          state: "ready",
          recommendations: [recommendation, potential],
          hasMore: false,
          offset: 0,
          limit: 50,
        }),
      }),
    );

    const user = userEvent.setup();
    await screen.findByText("82% match");
    await user.click(screen.getByRole("tab", { name: /potential \(1\)/i }));
    expect(screen.getByText("Potential roadworks")).toBeVisible();
    expect(screen.queryByText("82% match")).toBeNull();
    await user.click(screen.getByRole("button", { name: /reset filters/i }));
    expect(screen.getByText("82% match")).toBeVisible();
  });

  it("reveals full-route matches in local groups of 15", async () => {
    const recommendations = Array.from({ length: 16 }, (_, index) => ({
      ...recommendation,
      id: `r-${index}`,
      tenderId: `t-${index}`,
      tender: {
        ...recommendation.tender,
        id: `t-${index}`,
        title: `Radar item ${index + 1}`,
      },
      score: 82 - index / 10,
    }));
    wrap(
      fullRadar({
        recommendations: endpoint({
          state: "ready",
          recommendations,
          hasMore: false,
          offset: 0,
          limit: 50,
        }),
      }),
    );

    expect(await screen.findByText("Radar item 15")).toBeVisible();
    expect(screen.queryByText("Radar item 16")).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: /load 15 more/i }),
    );
    expect(screen.getByText("Radar item 16")).toBeVisible();
  });

  it("renders missing and invalid card facts without inventing values", async () => {
    const partial = {
      ...recommendation,
      tender: {
        ...recommendation.tender,
        closingDate: "not-a-date",
        estimatedValue: null,
        sourceOrganization: null,
        province: null,
      },
      factors: null,
      reasoning: null,
      improvementAreas: null,
    };
    wrap(
      fullRadar({
        recommendations: endpoint({
          state: "ready",
          recommendations: [partial],
          hasMore: false,
          offset: 0,
          limit: 50,
        }),
      }),
    );

    expect(await screen.findByText(/closing date unknown/i)).toBeVisible();
    expect(screen.getByText(/value not recorded/i)).toBeVisible();
    expect(screen.getByText(/buyer not recorded/i)).toBeVisible();
    expect(
      screen.queryByText(/eligible only|not relevant|joint venture/i),
    ).toBeNull();
  });

  it("adopts the server-returned saved state after one toggle", async () => {
    const toggleSave = vi.fn(async () => false);
    wrap(
      fullRadar({
        savedTenders: {
          listAllIds: vi.fn(async () => ["t1"]),
          toggleSave,
        } as unknown as SavedTendersEndpoint,
      }),
    );

    const user = userEvent.setup();
    const button = await screen.findByRole("button", {
      name: /remove bridge repairs from saved tenders/i,
    });
    await user.click(button);
    expect(toggleSave).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(/bridge repairs removed from saved tenders/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /save bridge repairs/i }),
    ).toBeVisible();
  });

  it("disables save controls while initial saved state is unavailable", async () => {
    wrap(
      fullRadar({
        savedTenders: {
          listAllIds: vi.fn(async () => {
            throw new Error("saved down");
          }),
          toggleSave: vi.fn(),
        } as unknown as SavedTendersEndpoint,
      }),
    );

    expect(
      await screen.findByRole("button", { name: /save bridge repairs/i }),
    ).toBeDisabled();
  });

  it("keeps the known saved state when a toggle fails", async () => {
    wrap(
      fullRadar({
        savedTenders: {
          listAllIds: vi.fn(async () => []),
          toggleSave: vi.fn(async () => {
            throw new Error("save down");
          }),
        } as unknown as SavedTendersEndpoint,
      }),
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /save bridge repairs/i }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not update saved state/i,
    );
    expect(
      screen.getByRole("button", { name: /save bridge repairs/i }),
    ).toBeVisible();
  });

  it("shows six-signal profile guidance and the deterministic top gap", async () => {
    wrap(
      fullRadar({
        company: {
          getExtendedProfile: vi.fn(async () => ({
            company: {
              id: "c1",
              name: "Acme",
              registrationNumber: "2020/1",
              bbbeeLevel: 2,
              industryCodes: ["4100"],
              annualTurnover: 5_000_000,
            },
            profile: { cidbGrading: "6CE", companyType: "PRIVATE_COMPANY" },
          })),
        } as unknown as CompanyEndpoint,
      }),
    );

    expect(
      await screen.findByRole("complementary", {
        name: /radar profile guidance/i,
      }),
    ).toBeVisible();
    expect(screen.getByText("100%")).toBeVisible();
    expect(screen.getByText(/profile 100% complete/i)).toBeVisible();
    expect(screen.getByText("Registration number")).toBeVisible();
    expect(screen.getByText("Company type")).toBeVisible();
    expect(screen.getAllByText("CIDB grade 6 required")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: /review company profile/i }),
    ).toHaveAttribute("href", "/company");
  });

  it("applies a paid server scenario temporarily and restores the previous sort", async () => {
    const recommendations = endpoint({
      state: "ready",
      recommendations: [recommendation],
      hasMore: false,
      offset: 0,
      limit: 50,
    });
    recommendations.scanScenario = vi.fn(async () => ({
      scenarioType: "standard" as const,
      scannedCount: 1,
      current: { highlyQualified: 1, potential: 0, nearMiss: 0, total: 1 },
      scenario: { highlyQualified: 1, potential: 0, nearMiss: 0, total: 1 },
      delta: { averageDelta: 8, improvedCount: 1, topMovers: [] },
      rows: [
        {
          id: "r1",
          title: "Bridge repairs",
          currentScore: 82,
          scenarioScore: 90,
          delta: 8,
        },
      ],
    }));
    wrap(fullRadar({ recommendations }));
    const user = userEvent.setup();

    const sort = await screen.findByLabelText(/sort matches/i);
    await user.selectOptions(sort, "highest_value");
    await user.click(
      screen.getByRole("button", { name: /open scenario preview/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /run scenario scan/i }),
    );

    expect(await screen.findByText("90% match")).toBeVisible();
    expect(screen.getByText(/projected \+8 points/i)).toBeVisible();
    expect(sort).toHaveValue("best_match");
    await user.click(
      screen.getByRole("button", {
        name: /exit scenario and restore base scores/i,
      }),
    );
    expect(screen.getByText("82% match")).toBeVisible();
    expect(sort).toHaveValue("highest_value");
  });

  it("does not present scenario scanning to Starter accounts", async () => {
    wrap(
      fullRadar({
        subscription: {
          getStatus: vi.fn(async () => ({
            kind: "subscribed",
            subscription: { tier: "starter" },
          })),
        } as unknown as SubscriptionEndpoint,
      }),
    );
    await screen.findByRole("heading", { name: /your tender radar/i });
    expect(
      screen.queryByRole("button", { name: /open scenario preview/i }),
    ).toBeNull();
  });

  it("reports a denied scenario without altering the base score", async () => {
    const recommendations = endpoint({
      state: "ready",
      recommendations: [recommendation],
      hasMore: false,
      offset: 0,
      limit: 50,
    });
    recommendations.scanScenario = vi.fn(async () => {
      throw new ApiError({ kind: "forbidden", message: "denied", status: 403 });
    });
    wrap(fullRadar({ recommendations }));

    await userEvent.click(
      await screen.findByRole("button", { name: /open scenario preview/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /run scenario scan/i }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /base radar scores are unchanged/i,
    );
    expect(screen.getByText("82% match")).toBeVisible();
  });

  it("shows the score as a number and as a band", async () => {
    // The band is what a user acts on; a bare percentage invites false
    // precision about a server-side heuristic.
    wrap(
      <TenderRadar
        embedded
        recommendations={endpoint({
          state: "ready",
          recommendations: [recommendation],
          hasMore: false,
          offset: 0,
          limit: 20,
        })}
      />,
    );
    expect(await screen.findByText("82%")).toBeVisible();
    expect(screen.getByText("Strong match")).toBeVisible();
  });

  it("sends the user to their company profile when there is none", async () => {
    // NOT "no matches": matching had nothing to compare against, and the fix
    // is the profile rather than a wider search.
    wrap(
      <TenderRadar
        embedded
        recommendations={endpoint({
          state: "no_company_profile",
          recommendations: [],
          hasMore: false,
          offset: 0,
          limit: 20,
        })}
      />,
    );
    expect(
      await screen.findByRole("heading", {
        name: /add your company profile to see matches/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /company profile/i }),
    ).toHaveAttribute("href", "/company");
  });

  it("distinguishes an empty result from a missing profile", async () => {
    wrap(
      <TenderRadar
        embedded
        recommendations={endpoint({
          state: "empty",
          recommendations: [],
          hasMore: false,
          offset: 0,
          limit: 20,
        })}
      />,
    );
    expect(
      await screen.findByText(/no prioritised opportunities are available/i),
    ).toBeVisible();
    expect(screen.queryByText(/add your company profile/i)).toBeNull();
  });

  it("shows the gaps that explain a score", async () => {
    wrap(
      <TenderRadar
        embedded
        recommendations={endpoint({
          state: "ready",
          recommendations: [recommendation],
          hasMore: false,
          offset: 0,
          limit: 20,
        })}
      />,
    );
    expect(await screen.findByText("CIDB grade 6 required")).toBeVisible();
  });

  it("reports a failure rather than an empty radar", async () => {
    const failing = {
      list: vi.fn(async () => {
        throw new ApiError({ kind: "server", message: "boom", status: 500 });
      }),
      refresh: vi.fn(),
    } as unknown as RecommendationsEndpoint;
    wrap(<TenderRadar embedded recommendations={failing} />);
    expect(await screen.findByRole("alert")).toBeVisible();
  });
});

describe("match factor rows", () => {
  it("omits a factor matching did not evaluate", () => {
    // An absent factor is not a zero. Rendering `0/10` would tell the user
    // they failed a check that never ran.
    const rows = collectFactorRows({ industry: { score: 20, maxScore: 25 } });
    expect(rows.map((r) => r.label)).toEqual(["Industry"]);
  });

  it("skips a factor with no maximum rather than dividing by zero", () => {
    expect(collectFactorRows({ bbbee: { score: 0, maxScore: 0 } })).toEqual([]);
  });

  it("clamps a percentage that would overflow its track", () => {
    const [row] = collectFactorRows({ value: { score: 30, maxScore: 10 } });
    expect(row.percentage).toBe(100);
  });

  it("keeps the raw numbers alongside the bar (A11Y-1)", () => {
    const [row] = collectFactorRows({ province: { score: 7, maxScore: 10 } });
    expect(row.score).toBe(7);
    expect(row.maxScore).toBe(10);
  });
});

describe("Opportunities screen", () => {
  function endpoint(tenders: unknown[]): SavedTendersEndpoint {
    return {
      list: vi.fn(async () => ({
        tenders,
        total: tenders.length,
        page: 1,
        totalPages: 1,
        closedCount: 0,
      })),
      toggleSave: vi.fn(),
    } as unknown as SavedTendersEndpoint;
  }

  it("invites the user to save something when the shortlist is empty", async () => {
    wrap(<Opportunities endpoint={endpoint([])} />);
    expect(
      await screen.findByRole("heading", { name: /not saved any tenders/i }),
    ).toBeVisible();
  });

  /**
   * The first request must not narrow. `activeOnly=true` currently 500s on the
   * parent (see `prompts/saved-tenders-activeonly-500.md`), so a narrowing
   * default makes the screen unopenable. Pinned so the default is not restored
   * before that parent defect ships.
   */
  it("does not narrow the first request", async () => {
    const ep = endpoint([]);
    wrap(<Opportunities endpoint={ep} />);
    await waitFor(() => expect(ep.list).toHaveBeenCalled());
    expect(ep.list).toHaveBeenCalledWith(
      expect.objectContaining({ activeOnly: false, futureOnly: false }),
      expect.anything(),
    );
  });

  /**
   * The capability is preserved, not deleted: ticking the box must still send
   * both flags unchanged, so the parent defect stays reproducible in one click
   * rather than being hidden by the desktop.
   */
  it("still filters server-side when the open-only box is ticked", async () => {
    const ep = endpoint([]);
    wrap(<Opportunities endpoint={ep} />);
    await waitFor(() => expect(ep.list).toHaveBeenCalled());

    await userEvent.click(
      screen.getByRole("checkbox", { name: /only tenders still open/i }),
    );

    await waitFor(() =>
      expect(ep.list).toHaveBeenCalledWith(
        expect.objectContaining({ activeOnly: true, futureOnly: true }),
        expect.anything(),
      ),
    );
  });
});

describe("Application workspace", () => {
  const detail = {
    id: "a1",
    tenderId: "t1",
    status: "DRAFT",
    submittedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
    notes: null,
    isArchived: false,
    tender: {
      id: "t1",
      title: "Security services",
      referenceNumber: "RFQ-3",
      sourceOrganization: "Dept of Health",
      closingDate: "2099-01-01T00:00:00.000Z",
      estimatedValue: 900_000,
      province: "Gauteng",
      requirements: ["Tax clearance", "CIDB 4"],
    },
    company: { id: "c1", name: "Acme", bbbeeLevel: 2 },
  };

  function endpoint(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      get: vi.fn(async () => detail),
      validate: vi.fn(async () => ({
        ready: false,
        blockers: ["Missing tax clearance"],
        warnings: [],
      })),
      // Never-settling defaults keep the pre-cockpit assertions on the
      // header/detail content; cockpit tests override them below.
      getCockpit: vi.fn(() => new Promise<never>(() => {})),
      getComplianceGaps: vi.fn(() => new Promise<never>(() => {})),
      getResearch: vi.fn(() => new Promise<never>(() => {})),
      getWorkspaceStage: vi.fn(() => new Promise<never>(() => {})),
      updateWorkspace: vi.fn(() => new Promise<never>(() => {})),
      getAdditionalInfo: vi.fn(() => new Promise<never>(() => {})),
      saveAdditionalInfo: vi.fn(() => new Promise<never>(() => {})),
      getResponseBlueprint: vi.fn(() => new Promise<never>(() => {})),
      ...overrides,
    } as unknown as ApplicationsEndpoint;
  }

  it("puts the tender requirements and the company side by side", async () => {
    wrap(<ApplicationWorkspace endpoint={endpoint()} applicationId="a1" />);
    expect(await screen.findByText("Tax clearance")).toBeVisible();
    expect(screen.getByText("Acme")).toBeVisible();
    const backLinks = screen.getAllByRole("link", {
      name: "Back to applications",
    });
    expect(backLinks).toHaveLength(1);
    expect(backLinks[0].querySelector("svg")).not.toBeNull();
  });

  it("says requirements were not extracted rather than implying none exist", async () => {
    // The parent nulls these when parsing fails, so an empty panel must not
    // read as "this tender asks for nothing".
    const ep = endpoint({
      get: vi.fn(async () => ({
        ...detail,
        tender: { ...detail.tender, requirements: null },
      })),
    });
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    expect(
      await screen.findByText(/no requirements have been extracted/i),
    ).toBeVisible();
  });

  it("does not run the readiness check until asked", async () => {
    // It is a POST that recomputes server-side; running it on every visit
    // would spend work the user did not ask for.
    const ep = endpoint();
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    await screen.findByText("Tax clearance");
    expect(ep.validate).not.toHaveBeenCalled();
  });

  it("reports blockers when the check is run", async () => {
    const ep = endpoint();
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    await screen.findByText("Tax clearance");
    await userEvent.click(
      screen.getByRole("button", { name: "Check readiness" }),
    );
    expect(await screen.findByText("Missing tax clearance")).toBeVisible();
    expect(screen.getByText(/not ready to submit/i)).toBeVisible();
  });

  it("never offers to submit, even when nothing is outstanding (brief §4.3)", async () => {
    const ep = endpoint({
      validate: vi.fn(async () => ({
        ready: true,
        blockers: [],
        warnings: [],
      })),
    });
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    await screen.findByText("Tax clearance");
    await userEvent.click(
      screen.getByRole("button", { name: "Check readiness" }),
    );
    await screen.findByText(/no outstanding items/i);
    // Human approval is required for final submission packs, so there must be
    // no control that commits one.
    expect(screen.queryByRole("button", { name: /^submit/i })).toBeNull();
    expect(screen.getByText(/remains a manual step/i)).toBeVisible();
  });
});

const workspaceDetail = {
  id: "a1",
  tenderId: "t1",
  status: "DRAFT",
  submittedAt: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z",
  notes: null,
  isArchived: false,
  tender: {
    id: "t1",
    title: "Security services",
    referenceNumber: "RFQ-3",
    sourceOrganization: "Dept of Health",
    closingDate: "2099-01-01T00:00:00.000Z",
    estimatedValue: 900_000,
    province: "Gauteng",
    requirements: ["Tax clearance", "CIDB 4"],
  },
  company: { id: "c1", name: "Acme", bbbeeLevel: 2 },
};

const workspaceCockpit = {
  application: { id: "a1", status: "DRAFT", readinessScore: 80 },
  tender: {
    id: "t1",
    title: "Security services",
    closingDate: "2026-08-25T10:00:00.000Z",
  },
  company: {
    id: "c1",
    name: "Acme",
    profileCompleteness: 100,
    hasProfile: true,
  },
  matching: null,
  readiness: {
    score: 80,
    overall: "ready",
    factors: [{ name: "Company profile", score: 100, status: "good" }],
  },
  urgency: {
    level: "normal",
    color: "#eab308",
    pulsing: false,
    daysRemaining: 17,
    hoursRemaining: 408,
    percentageRemaining: 20,
    message: "Closes 25 August 2026",
  },
  generationStatus: null,
  qualityChecks: [
    {
      id: "q1",
      category: "compliance",
      status: "pass",
      message: "Tax clearance valid",
    },
  ],
  valueEstimate: {
    estimatedMin: 450_000,
    estimatedMax: 720_000,
    estimatedMedian: 581_900,
    confidenceScore: 82,
    confidenceLevel: "high",
    methodology: "award-history",
    currency: "ZAR",
    sampleSize: 4,
  },
  analysisStatus: {
    status: "complete",
    progress: 100,
    message: "Analysis complete",
  },
  checklistState: [
    {
      id: "c1",
      label: "Company profile",
      completed: true,
      category: "Profile",
    },
    {
      id: "c2",
      label: "Tax clearance",
      completed: false,
      category: "Compliance",
    },
  ],
  events: [
    {
      id: "e1",
      title: "Site visit",
      eventDate: "2026-08-12T09:00:00.000Z",
      eventType: "SITE_VISIT",
      isCompleted: false,
      source: "tender",
    },
  ],
  documentState: [],
};

const workspaceGaps = {
  gaps: [
    {
      id: "g1",
      category: "Finance",
      severity: "important",
      label: "B-BBEE certificate missing",
      detail: "Required for evaluation",
      tenderRequirement: "B-BBEE",
      companyStatus: "missing",
      canAutoFix: false,
    },
  ],
  summary: { blocking: 0, important: 1, strengths: 5, info: 0, score: 100 },
};

const workspaceResearch = {
  organisation: {
    id: "o1",
    name: "Msinsi Holding (SOC)",
    organizationType: "State-owned company",
    tenderCount: 14,
    activeTenderCount: 3,
    awardCount: 6,
    csdNumber: "M123456789",
  },
  competitors: [
    { supplierName: "BridgeCo", totalValue: 12_000_000, awardCount: 4 },
    { supplierName: "Structura", totalValue: 8_000_000, awardCount: 2 },
  ],
  provinceHealth: {
    province: "North West",
    score: 50,
    activityLevel: "CAUTION",
  },
  eligibility: {
    cidb: { status: "pass", detail: "Grade 4" },
    taxClearance: { status: "fail", detail: "Expired" },
  },
};

describe("ApplicationWorkspace — workspace cockpit", () => {
  function endpoint(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      get: vi.fn(async () => workspaceDetail),
      validate: vi.fn(async () => ({
        ready: false,
        blockers: [],
        warnings: [],
      })),
      getCockpit: vi.fn(async () => workspaceCockpit),
      getComplianceGaps: vi.fn(async () => workspaceGaps),
      getResearch: vi.fn(async () => workspaceResearch),
      getWorkspaceStage: vi.fn(async () => "add_information"),
      updateWorkspace: vi.fn(async () => ({ success: true })),
      getAdditionalInfo: vi.fn(async () => ({
        values: {},
        fields: [],
        unfilledRequired: 0,
      })),
      saveAdditionalInfo: vi.fn(async () => ({ persisted: true })),
      getResponseBlueprint: vi.fn(async () => ({ blueprint: null })),
      ...overrides,
    } as unknown as ApplicationsEndpoint;
  }

  it("renders the cockpit panels from live-shaped payloads", async () => {
    wrap(<ApplicationWorkspace endpoint={endpoint()} applicationId="a1" />);
    expect(await screen.findByText(/add information/i)).toBeVisible();
    expect(screen.getByText(/closes 25 august 2026/i)).toBeVisible();
    expect(screen.getByText(/17 days to close/i)).toBeVisible();
    expect(screen.getByText("Tax clearance valid")).toBeVisible();
    expect(screen.getByText(/R\s*581\s*900/)).toBeVisible();
    expect(screen.getByText(/1 of 2 complete/i)).toBeVisible();
    expect(screen.getByText("Site visit")).toBeVisible();
    expect(
      await screen.findByText(/b-bbee certificate missing/i),
    ).toBeVisible();
    expect(screen.getByText("Msinsi Holding (SOC)")).toBeVisible();
    expect(screen.getByText("BridgeCo")).toBeVisible();
  });

  it("opens from the ready cockpit while the full application detail is still loading", async () => {
    const neverSettles = new Promise<never>(() => undefined);
    wrap(
      <ApplicationWorkspace
        endpoint={endpoint({ get: vi.fn(() => neverSettles) })}
        applicationId="a1"
      />,
    );

    expect(await screen.findByText(/add information/i)).toBeVisible();
    expect(
      screen.getByText(/checking for updates — showing the saved workspace/i),
    ).toBeVisible();
    expect(screen.queryByText(/loading this application/i)).toBeNull();
  });

  it("keeps every established assistance capability reachable without implicit mutations", async () => {
    const ep = endpoint();
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);

    expect(await screen.findByText(/add information/i)).toBeVisible();
    expect(screen.getByText("Tax clearance valid")).toBeVisible();
    expect(screen.getByText(/1 of 2 complete/i)).toBeVisible();
    expect(screen.getByText("Site visit")).toBeVisible();
    expect(
      await screen.findByText(/b-bbee certificate missing/i),
    ).toBeVisible();
    expect(screen.getByText("Msinsi Holding (SOC)")).toBeVisible();
    expect(
      screen.getByText(/no response blueprint for this tender yet/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Check readiness" }),
    ).toBeVisible();

    expect(ep.get).toHaveBeenCalledWith("a1", expect.anything());
    expect(ep.getCockpit).toHaveBeenCalledWith("a1", expect.anything());
    expect(ep.getComplianceGaps).toHaveBeenCalledWith("a1", expect.anything());
    expect(ep.getResearch).toHaveBeenCalledWith("a1", expect.anything());
    expect(ep.getAdditionalInfo).toHaveBeenCalledWith("a1", expect.anything());
    expect(ep.getResponseBlueprint).toHaveBeenCalledWith(
      "a1",
      expect.anything(),
    );
    expect(ep.validate).not.toHaveBeenCalled();
    expect(ep.updateWorkspace).not.toHaveBeenCalled();
    expect(ep.saveAdditionalInfo).not.toHaveBeenCalled();
  });

  it("renders one panel's error while the others still render", async () => {
    const ep = endpoint({
      getComplianceGaps: vi.fn(async () => {
        throw new ApiError({
          kind: "server",
          message: "gaps route is down",
        });
      }),
    });
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    expect(
      await screen.findByText(/could not load the compliance gaps right now/i),
    ).toBeVisible();
    expect(screen.getByText("Msinsi Holding (SOC)")).toBeVisible();
    expect(screen.queryByText(/b-bbee certificate missing/i)).toBeNull();
  });

  it("sends the exact PATCH bodies for stage move and status change", async () => {
    const update = vi.fn(async () => ({ success: true, persisted: true }));
    wrap(
      <ApplicationWorkspace
        endpoint={endpoint({ updateWorkspace: update })}
        applicationId="a1"
      />,
    );
    await screen.findByText(/add information/i);
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /move to stage/i }),
      "fix_readiness",
    );
    await userEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(update).toHaveBeenCalledWith("a1", "stage", {
      stage: "fix_readiness",
      baseStage: "add_information",
    });

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /change status/i }),
      "SUBMITTED",
    );
    await userEvent.click(screen.getByRole("button", { name: "Set status" }));
    expect(update).toHaveBeenCalledWith("a1", "status", {
      status: "SUBMITTED",
    });
  });

  it("shows the parent's error and allowed transitions verbatim on a 400", async () => {
    const update = vi.fn(async () => {
      throw new ApiError({
        kind: "validation",
        message: "Invalid status transition: DRAFT -> SUBMITTED",
        status: 400,
        allowed: ["DRAFT"],
      });
    });
    wrap(
      <ApplicationWorkspace
        endpoint={endpoint({ updateWorkspace: update })}
        applicationId="a1"
      />,
    );
    await screen.findByText(/add information/i);
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /change status/i }),
      "SUBMITTED",
    );
    await userEvent.click(screen.getByRole("button", { name: "Set status" }));
    expect(await screen.findByText(/invalid status transition/i)).toBeVisible();
    expect(screen.getByText(/allowed transitions: draft/i)).toBeVisible();
  });

  it("offers no restore control, because the parent restore action is broken", async () => {
    wrap(<ApplicationWorkspace endpoint={endpoint()} applicationId="a1" />);
    await screen.findByText(/add information/i);
    expect(screen.queryByRole("button", { name: /restore/i })).toBeNull();
  });
});

describe("ApplicationWorkspace — additional-information panel", () => {
  const fields = [
    {
      id: "bidContactPerson",
      label: "Bid contact person",
      type: "text",
      required: true,
    },
    {
      id: "declarationsAccepted",
      label: "I confirm the declarations for this bid",
      type: "checkbox",
      required: true,
    },
    {
      id: "deliveryAddress",
      label: "Delivery / branch address (North West)",
      type: "textarea",
      required: true,
    },
    {
      id: "pricingBasis",
      label: "Fixed price / escalation basis",
      type: "email",
      required: false,
    },
    {
      id: "bidContactPhone",
      label: "Bid contact phone",
      type: "tel",
      required: false,
    },
    {
      id: "futureField",
      label: "A field the parent may add later",
      type: "newType",
      required: false,
    },
  ];

  const info = {
    values: { bidContactPerson: "Sipho Dlamini", declarationsAccepted: false },
    fields,
    unfilledRequired: 2,
  };

  function endpoint(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      get: vi.fn(async () => workspaceDetail),
      validate: vi.fn(async () => ({
        ready: false,
        blockers: [],
        warnings: [],
      })),
      getCockpit: vi.fn(async () => workspaceCockpit),
      getComplianceGaps: vi.fn(async () => workspaceGaps),
      getResearch: vi.fn(async () => workspaceResearch),
      getWorkspaceStage: vi.fn(async () => "add_information"),
      updateWorkspace: vi.fn(async () => ({ success: true })),
      getAdditionalInfo: vi.fn(async () => info),
      saveAdditionalInfo: vi.fn(async () => ({
        persisted: true,
        unfilledRequired: 1,
      })),
      getResponseBlueprint: vi.fn(async () => ({ blueprint: null })),
      ...overrides,
    } as unknown as ApplicationsEndpoint;
  }

  it("renders the live-verified fields with their persisted values", async () => {
    wrap(<ApplicationWorkspace endpoint={endpoint()} applicationId="a1" />);
    const contact = await screen.findByLabelText(/bid contact person/i);
    expect(contact).toBeInstanceOf(HTMLInputElement);
    expect(contact).toHaveValue("Sipho Dlamini");
    expect(
      screen.getByRole("checkbox", { name: /confirm the declarations/i }),
    ).not.toBeChecked();
    expect(screen.getByLabelText(/delivery \/ branch address/i)).toBeInstanceOf(
      HTMLTextAreaElement,
    );
    expect(
      screen.getByLabelText(/fixed price \/ escalation basis/i),
    ).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByLabelText(/bid contact phone/i)).toBeInstanceOf(
      HTMLInputElement,
    );
    expect(screen.getByLabelText(/may add later/i)).toBeInstanceOf(
      HTMLInputElement,
    );
    expect(screen.getByText(/1\/3 required/i)).toBeVisible();
  });

  it("sends the exact values and shows the saved badge — and never auto-saves", async () => {
    const save = vi.fn(async () => ({ persisted: true, unfilledRequired: 1 }));
    wrap(
      <ApplicationWorkspace
        endpoint={endpoint({ saveAdditionalInfo: save })}
        applicationId="a1"
      />,
    );
    await screen.findByLabelText(/bid contact person/i);
    expect(save).not.toHaveBeenCalled();

    await userEvent.type(
      screen.getByLabelText(/bid contact phone/i),
      "082 555 1234",
    );
    expect(save).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Save answers" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith("a1", {
      bidContactPerson: "Sipho Dlamini",
      declarationsAccepted: false,
      bidContactPhone: "082 555 1234",
    });
    expect(await screen.findByText(/saved · 1 required left/i)).toBeVisible();
  });

  it("keeps the answers and explains when the save fails", async () => {
    const save = vi.fn(async () => {
      throw new ApiError({ kind: "validation", message: "Invalid values" });
    });
    wrap(
      <ApplicationWorkspace
        endpoint={endpoint({ saveAdditionalInfo: save })}
        applicationId="a1"
      />,
    );
    await screen.findByLabelText(/bid contact person/i);
    await userEvent.type(
      screen.getByLabelText(/bid contact phone/i),
      "082 555 1234",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save answers" }));
    // A 400 on this route is the parent's "company profile required" signal —
    // the platform never shows the server's developer-facing error string.
    expect(
      await screen.findByText(
        /add your company profile to see the additional information/i,
      ),
    ).toBeVisible();
    expect(screen.getByLabelText(/bid contact phone/i)).toHaveValue(
      "082 555 1234",
    );
  });

  it("explains pre-migration answers survive on this device only", async () => {
    const save = vi.fn(async () => ({ persisted: false }));
    wrap(
      <ApplicationWorkspace
        endpoint={endpoint({ saveAdditionalInfo: save })}
        applicationId="a1"
      />,
    );
    await screen.findByLabelText(/bid contact person/i);
    await userEvent.type(
      screen.getByLabelText(/bid contact phone/i),
      "082 555 1234",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save answers" }));
    expect(
      await screen.findByText(/not saved — kept on this device/i),
    ).toBeVisible();
  });

  it("keeps the typed answers visible after a successful save", async () => {
    wrap(
      <ApplicationWorkspace
        endpoint={endpoint({
          saveAdditionalInfo: vi.fn(async () => ({
            persisted: true,
            unfilledRequired: 0,
          })),
        })}
        applicationId="a1"
      />,
    );
    await screen.findByLabelText(/bid contact person/i);
    const phone = screen.getByLabelText(/bid contact phone/i);
    expect(phone).toHaveValue("");

    await userEvent.type(phone, "082 555 1234");
    await userEvent.click(screen.getByRole("button", { name: "Save answers" }));
    await screen.findByText(/saved/i);

    // The saved answers must survive the save: the panel re-seeds from the
    // pre-save fetch, never from the values the user just typed (regression:
    // the draft was re-seeded from stale `info.values` the moment the dirty
    // flag flipped, wiping the form).
    expect(screen.getByLabelText(/bid contact phone/i)).toHaveValue(
      "082 555 1234",
    );
    expect(screen.getByLabelText(/bid contact person/i)).toHaveValue(
      "Sipho Dlamini",
    );
  });

  it("degrades only this panel when its route fails", async () => {
    const ep = endpoint({
      getAdditionalInfo: vi.fn(async () => {
        throw new ApiError({
          kind: "server",
          message: "additional-info route is down",
        });
      }),
    });
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    expect(
      await screen.findByText(
        /could not load the additional information right now/i,
      ),
    ).toBeVisible();
    expect(screen.getByText("Msinsi Holding (SOC)")).toBeVisible();
  });
});

describe("ApplicationWorkspace — tender document downloads (Slice 7)", () => {
  const workspaceDetailWithDocs = {
    ...workspaceDetail,
    tender: {
      ...workspaceDetail.tender,
      documents: [
        {
          id: "d1",
          fileName: "Advert.pdf",
          documentCategory: "Advertisement",
        },
        { id: "d2", fileName: "SBD4.docx" },
      ],
    },
  };

  const pdfBytes = new Uint8Array([37, 80, 68, 70, 1, 2, 3]);

  function endpoint(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      get: vi.fn(async () => workspaceDetailWithDocs),
      validate: vi.fn(async () => ({
        ready: false,
        blockers: [],
        warnings: [],
      })),
      getCockpit: vi.fn(async () => workspaceCockpit),
      getComplianceGaps: vi.fn(async () => workspaceGaps),
      getResearch: vi.fn(async () => workspaceResearch),
      getWorkspaceStage: vi.fn(async () => "add_information"),
      updateWorkspace: vi.fn(async () => ({ success: true })),
      getAdditionalInfo: vi.fn(async () => ({ values: {}, fields: [] })),
      saveAdditionalInfo: vi.fn(async () => ({ persisted: true })),
      getResponseBlueprint: vi.fn(async () => ({ blueprint: null })),
      ...overrides,
    } as unknown as ApplicationsEndpoint;
  }

  function documentsClient(rejectWith?: unknown) {
    return {
      downloadTenderDocument: rejectWith
        ? vi.fn(async () => {
            throw rejectWith;
          })
        : vi.fn(async () => ({
            bytes: pdfBytes,
            filename: "Advert.pdf",
            contentType: "application/pdf",
          })),
    };
  }

  function savePort(
    overrides: Partial<SaveDownloadPort> = {},
  ): SaveDownloadPort {
    return {
      saveDialog: vi.fn(async () => "C:\\Users\\you\\Downloads\\Advert.pdf"),
      writeBytes: vi.fn(async () => {}),
      ...overrides,
    };
  }

  function documentActionPort(
    overrides: Partial<DocumentActionPort> = {},
  ): DocumentActionPort {
    return {
      chooseDirectory: vi.fn(async () => null),
      joinPath: vi.fn(async (...parts: string[]) => parts.join("\\")),
      writeBytes: vi.fn(async () => {}),
      ...overrides,
    };
  }

  it("lists the documents with a Download button each", async () => {
    wrap(
      <ApplicationWorkspace
        endpoint={endpoint()}
        applicationId="a1"
        documents={documentsClient()}
      />,
    );
    expect(await screen.findByText(/tender documents \(2\)/i)).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Download" })).toHaveLength(2);
    expect(screen.getByText("Advert.pdf · Advertisement")).toBeVisible();
    expect(screen.getByText("SBD4.docx")).toBeVisible();
  });

  it("saves a downloaded document to the user-picked path", async () => {
    const port = savePort();
    wrap(
      <ApplicationWorkspace
        endpoint={endpoint()}
        applicationId="a1"
        documents={documentsClient()}
        savePort={port}
      />,
    );
    await screen.findByText(/tender documents \(2\)/i);

    const [download] = screen.getAllByRole("button", { name: "Download" });
    await userEvent.click(download);

    await waitFor(() =>
      expect(port.writeBytes).toHaveBeenCalledWith(
        "C:\\Users\\you\\Downloads\\Advert.pdf",
        pdfBytes,
      ),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("routes Open to the authenticated internal document viewer", async () => {
    const documents = documentsClient();
    function LocationProbe() {
      return (
        <output aria-label="current route">{useLocation().pathname}</output>
      );
    }
    render(
      <MemoryRouter>
        <ApplicationWorkspace
          endpoint={endpoint()}
          applicationId="a1"
          documents={documents}
        />
        <LocationProbe />
      </MemoryRouter>,
    );
    await screen.findByText(/tender documents \(2\)/i);

    const [open] = screen.getAllByRole("button", { name: "Open" });
    await userEvent.click(open);
    expect(screen.getByLabelText("current route")).toHaveTextContent(
      "/tenders/t1/documents/d1",
    );
    expect(documents.downloadTenderDocument).not.toHaveBeenCalled();
  });

  it("reports an honest partial result while attempting every document", async () => {
    const actionPort = documentActionPort({
      chooseDirectory: vi.fn(async () => "C:\\Downloads"),
    });
    const downloadTenderDocument = vi.fn(async (id: string) => {
      if (id === "d1") throw new Error("failed");
      return {
        bytes: pdfBytes,
        filename: "SBD4.docx",
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
    });
    wrap(
      <ApplicationWorkspace
        endpoint={endpoint()}
        applicationId="a1"
        documents={{ downloadTenderDocument }}
        documentActionPort={actionPort}
      />,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Download all" }),
    );

    expect(
      await screen.findByText("Downloaded 1 of 2 documents; 1 failed."),
    ).toBeVisible();
    expect(downloadTenderDocument).toHaveBeenCalledTimes(2);
    expect(actionPort.writeBytes).toHaveBeenCalledTimes(1);
  });

  it("stays silent when the save dialog is cancelled", async () => {
    const port = savePort({ saveDialog: vi.fn(async () => null) });
    wrap(
      <ApplicationWorkspace
        endpoint={endpoint()}
        applicationId="a1"
        documents={documentsClient()}
        savePort={port}
      />,
    );
    await screen.findByText(/tender documents \(2\)/i);

    const [download] = screen.getAllByRole("button", { name: "Download" });
    await userEvent.click(download);

    await waitFor(() => expect(download).toBeEnabled());
    expect(port.writeBytes).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("explains the entitlement 403 as a plan limit", async () => {
    wrap(
      <ApplicationWorkspace
        endpoint={endpoint()}
        applicationId="a1"
        documents={documentsClient(
          new ApiError({
            kind: "forbidden",
            status: 403,
            message: "entitlement required",
          }),
        )}
      />,
    );
    await screen.findByText(/tender documents \(2\)/i);

    const [download] = screen.getAllByRole("button", { name: "Download" });
    await userEvent.click(download);

    expect(
      await screen.findByText(/your plan does not include this document/i),
    ).toBeVisible();
  });
});

describe("ApplicationWorkspace — response blueprint panel", () => {
  const blueprint = {
    tenderId: "t1",
    industry: { id: "i1", name: "Construction" },
    requiredUserDocuments: [
      {
        name: "Tax Clearance Certificate",
        canonicalType: "tax-clearance",
        source: "compliance",
        mandatory: true,
      },
      {
        name: "B-BBEE Certificate / Affidavit",
        canonicalType: "b-bbee",
        source: "compliance",
        mandatory: true,
      },
      {
        name: "CSD Registration Report",
        canonicalType: "csd",
        source: "compliance",
        mandatory: true,
      },
      {
        name: "CIDB Registration Certificate",
        canonicalType: "cidb",
        source: "compliance",
        mandatory: true,
      },
      {
        name: "Public Liability Insurance",
        canonicalType: "other",
        source: "industry",
        mandatory: true,
      },
      {
        name: "Company Profile",
        canonicalType: "company-profile",
        source: "analysis",
        mandatory: true,
      },
      {
        name: "Tax Clearance Pin",
        canonicalType: "tax-clearance",
        source: "analysis",
        mandatory: false,
      },
      {
        name: "Annual Financial Statements",
        canonicalType: "financials",
        source: "analysis",
        mandatory: false,
      },
      {
        name: "SHEQ Policy",
        canonicalType: "sheq",
        source: "industry",
        mandatory: false,
      },
      {
        name: "Quality Plan",
        canonicalType: "other",
        source: "analysis",
        mandatory: false,
      },
      {
        name: "Reference Letters",
        canonicalType: "other",
        source: "analysis",
        mandatory: false,
      },
      {
        name: "SARS Import/Export Code",
        canonicalType: "other",
        source: "industry",
        mandatory: false,
      },
    ],
    responseDocuments: [
      {
        key: "cover_letter",
        title: "Cover Letter",
        kind: "cover_letter",
        brief: "A professional SA business cover letter.",
        mandatory: true,
      },
      {
        key: "technical_proposal",
        title: "Technical / Works Proposal",
        kind: "technical",
        brief: "Respond to the technical specifications.",
        requiredBy: "Technical specifications",
        mandatory: true,
      },
    ],
    steps: [
      {
        key: "gather-returnables",
        title: "Gather required documents & returnables",
        detail: "Obtain and complete every mandatory returnable.",
        category: "documents",
        mandatory: true,
        source: "derived",
      },
      {
        key: "submit",
        title: "Submit the bid",
        detail: "Method: Electronic / portal",
        dueDate: "2026-08-25T10:00:00.000Z",
        category: "submission",
        mandatory: true,
        source: "analysis",
      },
    ],
    submission: {
      method: "Electronic / portal",
      deadline: "2026-08-25T10:00:00.000Z",
      contact: "Ms P Dlamini, 012 345 6789",
    },
    risks: [
      "Closing in ~2 working days — prioritise mandatory returnables immediately.",
    ],
    confidence: "high",
    generatedBy: "deterministic",
  };

  function endpoint(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      get: vi.fn(async () => workspaceDetail),
      validate: vi.fn(async () => ({
        ready: false,
        blockers: [],
        warnings: [],
      })),
      getCockpit: vi.fn(async () => workspaceCockpit),
      getComplianceGaps: vi.fn(async () => workspaceGaps),
      getResearch: vi.fn(async () => workspaceResearch),
      getWorkspaceStage: vi.fn(async () => "add_information"),
      updateWorkspace: vi.fn(async () => ({ success: true })),
      getAdditionalInfo: vi.fn(async () => ({
        values: {},
        fields: [],
        unfilledRequired: 0,
      })),
      saveAdditionalInfo: vi.fn(async () => ({ persisted: true })),
      getResponseBlueprint: vi.fn(async () => ({
        blueprint,
        hasAnalysis: true,
        enriched: false,
        responseDocs: { cover_letter: "# Draft" },
        responseDocStatus: {
          technical_proposal: {
            state: "generating",
            startedAt: 1,
            updatedAt: 1,
          },
        },
      })),
      generateResponseDocument: vi.fn(async () => ({
        key: "cover_letter",
        status: "generating",
      })),
      saveResponseDocument: vi.fn(async () => ({
        ok: true,
        key: "cover_letter",
      })),
      enrichBlueprint: vi.fn(async () => ({ blueprint, enriched: true })),
      ...overrides,
    } as unknown as ApplicationsEndpoint;
  }

  it("renders the blueprint sections from a live-shaped payload", async () => {
    wrap(<ApplicationWorkspace endpoint={endpoint()} applicationId="a1" />);
    expect(await screen.findByText("Cover Letter")).toBeVisible();
    // The full required-document set renders (12 entries; the last proves count).
    expect(screen.getByText("SARS Import/Export Code")).toBeVisible();
    expect(screen.getAllByText(/tax clearance/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/gather required documents/i)).toBeVisible();
    expect(screen.getByText("Electronic / portal")).toBeVisible();
    expect(screen.getByText(/prioritise mandatory returnables/i)).toBeVisible();
    expect(screen.getByText("high")).toBeVisible();
    expect(screen.getByText("Standard plan")).toBeVisible();
  });

  it("shows per-key document state: saved, generating, and none", async () => {
    wrap(<ApplicationWorkspace endpoint={endpoint()} applicationId="a1" />);
    expect(await screen.findByText("Saved")).toBeVisible();
    // The chip and the disabled action button both say it (R-A-1).
    expect(screen.getAllByText("Generating…").length).toBeGreaterThan(0);
  });

  it("shows a failed generation with component-owned copy, not the raw error", async () => {
    const ep = endpoint({
      getResponseBlueprint: vi.fn(async () => ({
        blueprint,
        responseDocs: {},
        responseDocStatus: {
          cover_letter: {
            state: "failed",
            startedAt: 1,
            updatedAt: 1,
            error: "AI service was busy",
          },
        },
      })),
    });
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    expect(await screen.findByText("Failed")).toBeVisible();
    expect(
      screen.getByText(/this document could not be generated/i),
    ).toBeVisible();
    // The parent's raw error string is never rendered verbatim (RH-5).
    expect(screen.queryByText("AI service was busy")).toBeNull();
  });

  it("shows an honest empty state for a null blueprint", async () => {
    const ep = endpoint({
      getResponseBlueprint: vi.fn(async () => ({ blueprint: null })),
    });
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    expect(
      await screen.findByText(/no response blueprint for this tender yet/i),
    ).toBeVisible();
  });

  it("degrades only this panel when its route fails", async () => {
    const ep = endpoint({
      getResponseBlueprint: vi.fn(async () => {
        throw new ApiError({
          kind: "server",
          message: "blueprint route is down",
        });
      }),
    });
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    expect(
      await screen.findByText(
        /could not load the response blueprint right now/i,
      ),
    ).toBeVisible();
    expect(screen.getByText("Msinsi Holding (SOC)")).toBeVisible();
  });

  it("marks the plan AI-tailored when the parent says it is", async () => {
    const ep = endpoint({
      getResponseBlueprint: vi.fn(async () => ({
        blueprint: { ...blueprint, generatedBy: "ai" },
        enriched: true,
      })),
    });
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    expect(await screen.findByText("AI-tailored")).toBeVisible();
  });

  it("generates on an explicit press: 202 → Generating… → poll → Saved, no loading flash", async () => {
    const getBlueprint = vi
      .fn()
      .mockResolvedValueOnce({
        blueprint,
        responseDocs: {},
        responseDocStatus: {},
      })
      .mockResolvedValueOnce({
        blueprint,
        responseDocs: { cover_letter: "# Generated draft" },
        responseDocStatus: {
          cover_letter: { state: "ready", startedAt: 1, updatedAt: 1 },
        },
      });
    const generate = vi.fn(async () => ({
      key: "cover_letter",
      title: "Cover Letter",
      status: "generating",
    }));
    vi.useFakeTimers();
    const ep = endpoint({
      getResponseBlueprint: getBlueprint,
      generateResponseDocument: generate,
    });
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    await act(async () => {});
    await act(async () => {});
    expect(
      screen.getByRole("button", { name: "Generate Cover Letter" }),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Generate Cover Letter" }),
    );
    await act(async () => {});
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith("a1", "cover_letter", undefined);
    // Chip + disabled action button both read "Generating…".
    expect(screen.getAllByText("Generating…").length).toBeGreaterThan(0);
    // The follow-up refresh fetches directly: the panel never flashes loading.
    expect(screen.queryByText(/loading the response blueprint/i)).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    await act(async () => {});
    expect(getBlueprint).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Saved")).toBeVisible();
    expect(screen.queryByText(/loading the response blueprint/i)).toBeNull();

    // No further ticks once nothing is generating.
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    expect(getBlueprint).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("stops the follow-up refresh after the bounded tick budget", async () => {
    const generatingPayload = {
      blueprint,
      responseDocs: {},
      responseDocStatus: {
        cover_letter: { state: "generating", startedAt: 1, updatedAt: 1 },
      },
    };
    const getBlueprint = vi
      .fn()
      .mockResolvedValueOnce({
        blueprint,
        responseDocs: {},
        responseDocStatus: {},
      })
      .mockResolvedValue(generatingPayload);
    vi.useFakeTimers();
    const ep = endpoint({
      getResponseBlueprint: getBlueprint,
      generateResponseDocument: vi.fn(async () => ({
        key: "cover_letter",
        status: "generating",
      })),
    });
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    await act(async () => {});
    await act(async () => {});
    fireEvent.click(
      screen.getByRole("button", { name: "Generate Cover Letter" }),
    );
    await act(async () => {});
    expect(getBlueprint).toHaveBeenCalledTimes(1);

    // 15 ticks ≈ 60 s is the whole budget; the 16th window is silent.
    await act(async () => {
      vi.advanceTimersByTime(4000 * 15);
    });
    await act(async () => {});
    expect(getBlueprint).toHaveBeenCalledTimes(16);
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    expect(getBlueprint).toHaveBeenCalledTimes(16);
    vi.useRealTimers();
  });

  it("explains a 402 as needing a paid plan, not a profile", async () => {
    const generate = vi.fn(async () => {
      throw new ApiError({
        kind: "payment-required",
        status: 402,
        code: "SUBSCRIPTION_REQUIRED",
        message: "Subscription required",
      });
    });
    const ep = endpoint({
      generateResponseDocument: generate,
      getResponseBlueprint: vi.fn(async () => ({
        blueprint,
        responseDocs: {},
        responseDocStatus: {},
      })),
    });
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    expect(
      await screen.findByRole("button", { name: "Generate Cover Letter" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Generate Cover Letter" }),
    );
    expect(
      await screen.findByText(/generating this document needs a paid plan/i),
    ).toBeVisible();
    expect(screen.queryByText("Generating…")).toBeNull();
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("explains a 409 as incomplete additional information", async () => {
    const generate = vi.fn(async () => {
      throw new ApiError({
        kind: "validation",
        status: 409,
        code: "PRECONDITIONS_NOT_MET",
        message: "Generation preconditions not met",
      });
    });
    const ep = endpoint({
      generateResponseDocument: generate,
      getResponseBlueprint: vi.fn(async () => ({
        blueprint,
        responseDocs: {},
        responseDocStatus: {},
      })),
    });
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    expect(
      await screen.findByRole("button", { name: "Generate Cover Letter" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Generate Cover Letter" }),
    );
    expect(
      await screen.findByText(
        /complete the required additional information before generating/i,
      ),
    ).toBeVisible();
    expect(screen.queryByText("Generating…")).toBeNull();
  });

  it("saves an edited document and shows Saved immediately", async () => {
    const save = vi.fn(async () => ({ ok: true, key: "cover_letter" }));
    wrap(
      <ApplicationWorkspace
        endpoint={endpoint({ saveResponseDocument: save })}
        applicationId="a1"
      />,
    );
    expect(await screen.findByText("Saved")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Edit Cover Letter" }));
    const textarea = screen.getByRole("textbox", {
      name: /edit cover letter/i,
    });
    expect(textarea).toHaveValue("# Draft");
    fireEvent.change(textarea, { target: { value: "# Rewritten" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Cover Letter" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith("a1", "cover_letter", "# Rewritten");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getAllByText("Saved").length).toBeGreaterThan(0);
  });

  it("cancelling an edit discards the draft without saving", async () => {
    const save = vi.fn(async () => ({ ok: true, key: "cover_letter" }));
    wrap(
      <ApplicationWorkspace
        endpoint={endpoint({ saveResponseDocument: save })}
        applicationId="a1"
      />,
    );
    expect(await screen.findByText("Saved")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Edit Cover Letter" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: /edit cover letter/i }),
      { target: { value: "# Discarded" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel editing Cover Letter" }),
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps the editor open and explains when a save fails", async () => {
    const save = vi.fn(async () => {
      throw new ApiError({ kind: "server", message: "boom" });
    });
    wrap(
      <ApplicationWorkspace
        endpoint={endpoint({ saveResponseDocument: save })}
        applicationId="a1"
      />,
    );
    expect(await screen.findByText("Saved")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Edit Cover Letter" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: /edit cover letter/i }),
      { target: { value: "# Rewritten" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Cover Letter" }));
    expect(
      await screen.findByText(/could not load this document right now/i),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: /edit cover letter/i }),
    ).toHaveValue("# Rewritten");
  });

  it("offers Regenerate on a saved document and starts the same flow", async () => {
    const generate = vi.fn(async () => ({
      key: "cover_letter",
      status: "generating",
    }));
    wrap(
      <ApplicationWorkspace
        endpoint={endpoint({ generateResponseDocument: generate })}
        applicationId="a1"
      />,
    );
    expect(await screen.findByText("Saved")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Regenerate Cover Letter" }),
    );
    await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    expect(generate).toHaveBeenCalledWith("a1", "cover_letter", undefined);
  });

  it("retries a failed generation", async () => {
    const generate = vi.fn(async () => ({
      key: "cover_letter",
      status: "generating",
    }));
    const ep = endpoint({
      generateResponseDocument: generate,
      getResponseBlueprint: vi.fn(async () => ({
        blueprint,
        responseDocs: {},
        responseDocStatus: {
          cover_letter: {
            state: "failed",
            startedAt: 1,
            updatedAt: 1,
            error: "AI service was busy",
          },
        },
      })),
    });
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    expect(
      await screen.findByRole("button", { name: "Retry Cover Letter" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry Cover Letter" }));
    await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
  });

  it("deep-analyses on an explicit press: one POST, then the plan reloads AI-tailored", async () => {
    const enrich = vi.fn(async () => ({ blueprint, enriched: true }));
    const getBlueprint = vi
      .fn()
      .mockResolvedValueOnce({
        blueprint,
        enriched: false,
        responseDocs: {},
        responseDocStatus: {},
      })
      .mockResolvedValueOnce({
        blueprint: { ...blueprint, generatedBy: "ai" },
        enriched: true,
        responseDocs: {},
        responseDocStatus: {},
      });
    const ep = endpoint({
      enrichBlueprint: enrich,
      getResponseBlueprint: getBlueprint,
    });
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    expect(
      await screen.findByRole("button", { name: "Deep-analyse" }),
    ).toBeVisible();
    expect(screen.getByText("Standard plan")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Deep-analyse" }));
    expect(await screen.findByText("Analysing…")).toBeVisible();
    expect(enrich).toHaveBeenCalledTimes(1);
    expect(enrich).toHaveBeenCalledWith("a1");

    // Success reloads the panel; the GET reports the cached enrichment, so
    // provenance flips to AI-tailored from the single source of truth.
    expect(await screen.findByText("AI-tailored")).toBeVisible();
    expect(getBlueprint).toHaveBeenCalledTimes(2);
  });

  it("is disabled while analysing, so a re-press cannot start a second pass", async () => {
    let release: () => void = () => {};
    const enrich = vi.fn(
      () =>
        new Promise<{ blueprint: unknown; enriched: boolean }>((resolve) => {
          release = () => resolve({ blueprint, enriched: true });
        }),
    );
    const ep = endpoint({ enrichBlueprint: enrich });
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    expect(
      await screen.findByRole("button", { name: "Deep-analyse" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Deep-analyse" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Analysing…" })).toBeDisabled(),
    );
    // A re-press on the disabled button cannot start a second pass.
    fireEvent.click(screen.getByRole("button", { name: "Analysing…" }));
    await act(async () => {
      release();
    });
    expect(enrich).toHaveBeenCalledTimes(1);
  });

  it("explains a 402 as needing the Professional plan", async () => {
    const enrich = vi.fn(async () => {
      throw new ApiError({
        kind: "payment-required",
        status: 402,
        message: "Pro plan required",
      });
    });
    const ep = endpoint({ enrichBlueprint: enrich });
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    expect(
      await screen.findByRole("button", { name: "Deep-analyse" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Deep-analyse" }));
    expect(
      await screen.findByText(/deep-analyse needs the professional plan/i),
    ).toBeVisible();
    // The standard plan stays rendered — the failure is not fatal.
    expect(screen.getByText("Standard plan")).toBeVisible();
    expect(screen.getByText("Cover Letter")).toBeVisible();
  });

  it("shows the analysis-triggered message with the standard plan intact", async () => {
    const enrich = vi.fn(async () => ({
      blueprint,
      enriched: false,
      reason: "analysis_triggered",
    }));
    const ep = endpoint({ enrichBlueprint: enrich });
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    expect(
      await screen.findByRole("button", { name: "Deep-analyse" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Deep-analyse" }));
    expect(
      await screen.findByText(
        /the tender is still being analysed — try deep-analyse again shortly/i,
      ),
    ).toBeVisible();
    expect(screen.getByText("Standard plan")).toBeVisible();
  });

  it("shows the ai-unavailable message with the standard plan intact", async () => {
    const enrich = vi.fn(async () => ({
      blueprint,
      enriched: false,
      reason: "ai_unavailable",
    }));
    const ep = endpoint({ enrichBlueprint: enrich });
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    expect(
      await screen.findByRole("button", { name: "Deep-analyse" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Deep-analyse" }));
    expect(
      await screen.findByText(
        /ai analysis is unavailable right now — the standard plan is shown/i,
      ),
    ).toBeVisible();
    expect(screen.getByText("Standard plan")).toBeVisible();
  });

  it("explains a server failure on deep-analyse", async () => {
    const enrich = vi.fn(async () => {
      throw new ApiError({ kind: "server", status: 500, message: "boom" });
    });
    const ep = endpoint({ enrichBlueprint: enrich });
    wrap(<ApplicationWorkspace endpoint={ep} applicationId="a1" />);
    expect(
      await screen.findByRole("button", { name: "Deep-analyse" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Deep-analyse" }));
    expect(
      await screen.findByText(/could not load the deep-analyse right now/i),
    ).toBeVisible();
    expect(screen.getByText("Cover Letter")).toBeVisible();
  });
});

describe("ResponseBlueprintPanel — export package (Slice 6)", () => {
  const blueprintPayload = {
    blueprint: {
      tenderId: "t1",
      industry: { id: "i1", name: "Construction" },
      responseDocuments: [
        { key: "cover_letter", title: "Cover Letter", mandatory: true },
      ],
      steps: [],
      risks: [],
      confidence: "high",
      generatedBy: "deterministic",
    },
    hasAnalysis: true,
    enriched: false,
    responseDocs: { cover_letter: "# Draft" },
    responseDocStatus: {},
  };

  function panelEndpoint(
    exportWorkspacePackage: (
      id: string,
      format: "pdf" | "docx",
    ) => Promise<{
      bytes: Uint8Array;
      filename: string;
      contentType: string;
    }>,
  ) {
    return {
      getResponseBlueprint: vi.fn(async () => blueprintPayload),
      exportWorkspacePackage,
      generateResponseDocument: vi.fn(async () => ({
        key: "cover_letter",
        status: "generating",
      })),
      saveResponseDocument: vi.fn(async () => ({
        ok: true,
        key: "cover_letter",
      })),
      enrichBlueprint: vi.fn(async () => ({
        blueprint: blueprintPayload.blueprint,
        enriched: true,
      })),
    } as unknown as Parameters<typeof ResponseBlueprintPanel>[0]["endpoint"];
  }

  const pdfResult = {
    bytes: new Uint8Array([37, 80, 68, 70, 1, 2, 3]),
    filename: "proposal-RFQ-001.pdf",
    contentType: "application/pdf",
  };

  it("offers PDF and DOCX after opening the Export choice", async () => {
    wrap(
      <ResponseBlueprintPanel
        endpoint={panelEndpoint(vi.fn())}
        applicationId="a1"
        savePort={{
          saveDialog: vi.fn(async () => null),
          writeBytes: vi.fn(async () => {}),
        }}
      />,
    );
    expect(await screen.findByRole("button", { name: "Export" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "PDF" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(screen.getByRole("button", { name: "PDF" })).toBeVisible();
    expect(screen.getByRole("button", { name: "DOCX" })).toBeVisible();
  });

  it("exports once per press: PDF → Exporting… → bytes saved under the parsed filename", async () => {
    const exportFn = vi.fn(async () => pdfResult);
    const saveDialog = vi.fn(async () => "C:\\Exports\\proposal-RFQ-001.pdf");
    const writeBytes = vi.fn(async () => {});
    wrap(
      <ResponseBlueprintPanel
        endpoint={panelEndpoint(exportFn)}
        applicationId="a1"
        savePort={{ saveDialog, writeBytes }}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Export" }));
    fireEvent.click(await screen.findByRole("button", { name: "PDF" }));

    expect(await screen.findByText("Exporting…")).toBeVisible();
    expect(exportFn).toHaveBeenCalledTimes(1);
    expect(exportFn).toHaveBeenCalledWith("a1", "pdf");
    expect(await screen.findByRole("button", { name: "Export" })).toBeVisible();
    await waitFor(() =>
      expect(writeBytes).toHaveBeenCalledWith(
        "C:\\Exports\\proposal-RFQ-001.pdf",
        pdfResult.bytes,
      ),
    );
  });

  it("sends docx when DOCX is chosen", async () => {
    const exportFn = vi.fn(async () => ({
      ...pdfResult,
      filename: "proposal-RFQ-001.docx",
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }));
    wrap(
      <ResponseBlueprintPanel
        endpoint={panelEndpoint(exportFn)}
        applicationId="a1"
        savePort={{
          saveDialog: vi.fn(async () => "C:\\Exports\\proposal-RFQ-001.docx"),
          writeBytes: vi.fn(async () => {}),
        }}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Export" }));
    fireEvent.click(await screen.findByRole("button", { name: "DOCX" }));

    await waitFor(() => expect(exportFn).toHaveBeenCalledWith("a1", "docx"));
  });

  it("treats a cancelled save dialog as a silent no-op", async () => {
    const writeBytes = vi.fn(async () => {});
    wrap(
      <ResponseBlueprintPanel
        endpoint={panelEndpoint(vi.fn(async () => pdfResult))}
        applicationId="a1"
        savePort={{ saveDialog: vi.fn(async () => null), writeBytes }}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Export" }));
    fireEvent.click(await screen.findByRole("button", { name: "PDF" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Export" })).toBeVisible(),
    );
    expect(writeBytes).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("explains the 409 nothing-to-export gate honestly", async () => {
    const exportFn = vi.fn(async () => {
      throw new ApiError({
        kind: "validation",
        status: 409,
        message: "Generate your proposal documents before exporting.",
      });
    });
    wrap(
      <ResponseBlueprintPanel
        endpoint={panelEndpoint(exportFn)}
        applicationId="a1"
        savePort={{
          saveDialog: vi.fn(async () => null),
          writeBytes: vi.fn(async () => {}),
        }}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Export" }));
    fireEvent.click(await screen.findByRole("button", { name: "PDF" }));

    expect(
      await screen.findByText(
        /generate your proposal documents before exporting/i,
      ),
    ).toBeVisible();
    expect(screen.getByText("Cover Letter")).toBeVisible();
  });

  it("explains a server failure on export", async () => {
    const exportFn = vi.fn(async () => {
      throw new ApiError({ kind: "server", status: 500, message: "boom" });
    });
    wrap(
      <ResponseBlueprintPanel
        endpoint={panelEndpoint(exportFn)}
        applicationId="a1"
        savePort={{
          saveDialog: vi.fn(async () => null),
          writeBytes: vi.fn(async () => {}),
        }}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Export" }));
    fireEvent.click(await screen.findByRole("button", { name: "PDF" }));

    expect(
      await screen.findByText(/could not export right now/i),
    ).toBeVisible();
    expect(screen.getByText("Cover Letter")).toBeVisible();
  });
});

describe("Company profile screen", () => {
  /**
   * Spec: desktop-company-profile-full-record (Slice 11)
   *
   * The screen now reads the whole record from `/profile/extended`; the bare
   * `/profile` read survives only for the company timestamps that route does
   * not serialise. `getCidb` is gone — its route has no GET handler.
   */
  function endpoint(
    company: unknown,
    extras: {
      profile?: unknown;
      experiences?: unknown[];
      keyPersonnel?: unknown[];
      completeness?: { score: number; missingFields: string[] };
      overrides?: Record<string, unknown>;
    } = {},
  ): CompanyEndpoint {
    const record =
      company === undefined
        ? undefined
        : {
            company,
            profile: extras.profile ?? null,
            experiences: extras.experiences ?? [],
            keyPersonnel: extras.keyPersonnel ?? [],
            completeness: extras.completeness,
          };
    return {
      getProfile: vi.fn(async () => company),
      getExtendedRecord: vi.fn(async () => record),
      getExtendedProfile: vi.fn(async () => undefined),
      getExperiences: vi.fn(async () => extras.experiences ?? []),
      getPersonnel: vi.fn(async () => extras.keyPersonnel ?? []),
      updateProfile: vi.fn(async (update) => ({
        company: { id: "c1", ...update },
        profileCompleteness: 82,
        matchingTriggered: true,
      })),
      saveExtendedProfile: vi.fn(async () => ({
        message: "Company profile saved successfully",
        profile: { id: "profile-1" },
      })),
      setCidbGrading: vi.fn(async () => {}),
      createExperience: vi.fn(async () => ({ id: "e-new" })),
      updateExperience: vi.fn(async () => ({ id: "e1" })),
      deleteExperience: vi.fn(async () => {}),
      createPersonnel: vi.fn(async () => ({ id: "p-new" })),
      updatePersonnel: vi.fn(async () => ({ id: "p1" })),
      deletePersonnel: vi.fn(async () => {}),
      ...extras.overrides,
    } as unknown as CompanyEndpoint;
  }

  const fullCompany = {
    id: "c1",
    name: "Example Civils",
    registrationNumber: "2020/123456/07",
    taxNumber: "9876543210",
    bbbeeLevel: 2,
    bbbeeCertificateUrl: "https://docs.example.org/bbbee.pdf",
    industryCodes: ["4100"],
    provincesOperating: ["Gauteng"],
    companySize: "SMALL",
    annualTurnover: 12_000_000,
    certifications: ["ISO 9001"],
    capabilitiesDescription: "Roads and stormwater.",
  };

  const fullProfile = {
    id: "profile-1",
    companyType: "PTY_LTD",
    profileDocument: "https://docs.example.org/profile.pdf",
    profileText: "Twenty years of municipal civils.",
    equipmentAssets: [{ name: "TLB", quantity: 3, value: 900_000 }],
    operationalCapacity: {
      staffCount: 48,
      vehicleCount: 12,
      premisesOwned: true,
      premisesSize: "2000m2",
    },
    cidbGrading: "6CE",
    professionalBodies: [{ name: "SAICE", membershipNumber: "SAICE-114" }],
    completenessScore: 83,
    missingFields: ["Tax Number"],
    updatedAt: "2026-08-01T08:00:00.000Z",
  };

  const fullExperience = {
    id: "e1",
    projectName: "Depot upgrade",
    clientName: "City of Tshwane",
    clientType: "Government",
    contractValue: 4_500_000,
    currency: "ZAR",
    startDate: "2025-02-01T00:00:00.000Z",
    completionDate: "2025-11-30T00:00:00.000Z",
    referenceContact: "T. Mokoena",
    referenceEmail: "t.mokoena@example.org",
    description: "Full depot rebuild.",
    categoryRelevance: ["construction"],
    provinceRelevance: ["Gauteng"],
    completionCertUrl: "https://docs.example.org/cert.pdf",
    referenceLetterUrl: "https://docs.example.org/letter.pdf",
  };

  const fullPerson = {
    id: "p1",
    fullName: "N. Dlamini",
    role: "Project Manager",
    department: "Delivery",
    qualifications: "BSc Civil Engineering",
    certifications: [{ name: "PrEng", issuer: "ECSA" }],
    yearsExperience: 14,
    cvUrl: "https://docs.example.org/cv.pdf",
    email: "n.dlamini@example.org",
    phone: "+27 12 000 0000",
  };

  function fullRecordEndpoint(overrides: Record<string, unknown> = {}) {
    return endpoint(fullCompany, {
      profile: fullProfile,
      experiences: [fullExperience],
      keyPersonnel: [fullPerson],
      completeness: { score: 83, missingFields: ["Tax Number"] },
      overrides,
    });
  }

  /** A dashboard panel by its heading, for scoping its own controls. */
  function panel(title: string) {
    return screen
      .getByRole("heading", { name: title, level: 2 })
      .closest("section") as HTMLElement;
  }

  /** The "Company profile" panel's own Edit control, not the page header's. */
  function profilePanel() {
    return panel("Company profile");
  }

  /** Every panel written by `POST /profile/extended`. */
  const DETAIL_PANELS = [
    "Company profile",
    "Operational capacity",
    "Equipment and assets",
    "Professional bodies",
  ];

  it("explains that matching needs a profile when there is none", async () => {
    wrap(<CompanyProfileScreen endpoint={endpoint(undefined)} />);
    expect(
      await screen.findByRole("heading", { name: /no company profile yet/i }),
    ).toBeVisible();
  });

  it("says a field is not recorded rather than rendering a blank", async () => {
    wrap(
      <CompanyProfileScreen
        endpoint={endpoint({
          id: "c1",
          name: "Acme",
          industryCodes: [],
          provincesOperating: [],
          certifications: [],
        })}
      />,
    );
    await screen.findByText("Acme");
    expect(screen.getAllByText("Not recorded").length).toBeGreaterThan(0);
  });

  it("loads every core field into a deliberate editor and saves typed values", async () => {
    const client = endpoint({
      id: "c1",
      name: "Acme",
      registrationNumber: "2020/123",
      taxNumber: "9876",
      bbbeeLevel: 3,
      companySize: "Small",
      annualTurnover: 1_000_000,
      industryCodes: ["Construction", "Civil engineering"],
      provincesOperating: ["Gauteng"],
      certifications: ["ISO 9001"],
      capabilitiesDescription: "Road and bridge construction",
    });
    wrap(<CompanyProfileScreen endpoint={client} />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit company profile" }),
    );
    expect(screen.getByDisplayValue("Acme")).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "Market footprint" }),
    );
    expect(screen.getByLabelText(/industry codes and sectors/i)).toHaveValue(
      "Construction\nCivil engineering",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Company details" }),
    );

    await userEvent.clear(screen.getByLabelText(/annual turnover/i));
    await userEvent.type(screen.getByLabelText(/annual turnover/i), "2500000");
    await userEvent.click(
      screen.getByRole("button", { name: "Save company profile" }),
    );

    await waitFor(() =>
      expect(client.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Acme",
          annualTurnover: 2_500_000,
          industryCodes: ["Construction", "Civil engineering"],
          provincesOperating: ["Gauteng"],
        }),
      ),
    );
    expect(
      await screen.findByText(/Tender matches are being refreshed/i),
    ).toBeVisible();
  });

  it("cancels an edit without writing the canonical profile", async () => {
    const client = endpoint({
      id: "c1",
      name: "Acme",
      industryCodes: [],
      provincesOperating: [],
      certifications: [],
    });
    wrap(<CompanyProfileScreen endpoint={client} />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit company profile" }),
    );
    await userEvent.clear(screen.getByDisplayValue("Acme"));
    await userEvent.type(
      screen.getByLabelText(/company name/i),
      "Changed draft",
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(client.updateProfile).not.toHaveBeenCalled();
    expect(await screen.findByText("Acme")).toBeVisible();
  });

  it("shows certifications for the company's field and preserves custom evidence", async () => {
    const client = endpoint({
      id: "c1",
      name: "Acme Digital",
      industryCodes: ["ict", "ICT-001"],
      provincesOperating: ["Gauteng"],
      certifications: ["legacy-partner-status"],
    });
    wrap(<CompanyProfileScreen endpoint={client} />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Edit company profile" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Bid capability" }),
    );

    expect(screen.getByText("POPIA Compliance")).toBeVisible();
    expect(
      screen.getByText("ISO 27001 (Information Security Management)"),
    ).toBeVisible();
    expect(screen.queryByText("PSIRA Registration")).not.toBeInTheDocument();
    expect(
      screen.getByLabelText(/other certifications already held/i),
    ).toHaveValue("legacy-partner-status");

    await userEvent.click(screen.getByLabelText(/POPIA Compliance/i));
    await userEvent.click(
      screen.getByRole("button", { name: "Save company profile" }),
    );
    await waitFor(() =>
      expect(client.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          industryCodes: ["ict", "ICT-001"],
          certifications: ["legacy-partner-status", "popia"],
        }),
      ),
    );
  });

  // Spec: desktop-company-profile-full-record (Slice 11)

  it("shows the whole company record, not a portion of it", async () => {
    wrap(<CompanyProfileScreen endpoint={fullRecordEndpoint()} />);
    await screen.findByText("Example Civils");

    // Company-level fields that were never displayed before.
    expect(screen.getByText("9876543210")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "View certificate" }),
    ).toBeVisible();

    // The extended profile, none of which the screen used to reach.
    expect(screen.getByText("Private company (Pty) Ltd")).toBeVisible();
    expect(screen.getByText("6CE")).toBeVisible();
    expect(screen.getByText("Twenty years of municipal civils.")).toBeVisible();
    // Matched on the detail rather than the name: the name also appears in a
    // nested emphasis span, so a bare /TLB/ matches two elements.
    expect(screen.getByText(/3 units/)).toBeVisible();
    expect(screen.getByText(/SAICE-114/)).toBeVisible();
    expect(screen.getByText("48")).toBeVisible();
    expect(screen.getByText("2000m2")).toBeVisible();
  });

  it("renders the experience fields the old field names silently dropped", async () => {
    // `contractValue` and `completionDate` — previously read as `value` and
    // `endDate`, so the amount never rendered at all.
    wrap(<CompanyProfileScreen endpoint={fullRecordEndpoint()} />);
    await screen.findByText("Depot upgrade");

    // `Intl` groups with a narrow no-break space, so match any separator
    // class rather than pasting the literal character into the source.
    expect(screen.getByText(/4\D?500\D?000/)).toBeVisible();
    expect(screen.getByText("City of Tshwane")).toBeVisible();
    expect(screen.getByText("Government")).toBeVisible();
    expect(screen.getByText("t.mokoena@example.org")).toBeVisible();
    expect(screen.getByText("Full depot rebuild.")).toBeVisible();
    expect(screen.getByRole("link", { name: "View letter" })).toBeVisible();
  });

  it("renders personnel qualifications, which the singular spelling never matched", async () => {
    wrap(<CompanyProfileScreen endpoint={fullRecordEndpoint()} />);
    await screen.findByText("N. Dlamini");

    expect(screen.getByText("BSc Civil Engineering")).toBeVisible();
    expect(screen.getByText("Delivery")).toBeVisible();
    expect(screen.getByText("14")).toBeVisible();
    expect(screen.getByText("n.dlamini@example.org")).toBeVisible();
    expect(screen.getByText(/PrEng · ECSA/)).toBeVisible();
  });

  it("shows completeness as a score and a list of what is still missing", async () => {
    wrap(<CompanyProfileScreen endpoint={fullRecordEndpoint()} />);
    expect(await screen.findByText("83%")).toBeVisible();
    expect(screen.getByText("Still missing")).toBeVisible();
    expect(screen.getByText("Tax Number")).toBeVisible();
  });

  it("offers profile setup instead of failing writes when there is no profile row", async () => {
    // The record routes answer 400 without a CompanyProfile row, so the add
    // affordances are gated rather than letting the parent reject.
    wrap(<CompanyProfileScreen endpoint={endpoint(fullCompany)} />);
    await screen.findByText("Example Civils");

    expect(
      screen.getByRole("button", { name: "Set up company profile" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Add project" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add team member" }),
    ).not.toBeInTheDocument();
  });

  it("carries untouched profile fields through a single-field save", async () => {
    // `POST /profile/extended` replaces all seven fields, so a body that omits
    // one erases it. Editing the profile text must still send the CIDB grade.
    const client = fullRecordEndpoint();
    wrap(<CompanyProfileScreen endpoint={client} />);
    await screen.findByText("Example Civils");

    await userEvent.click(
      within(profilePanel()).getByRole("button", { name: "Edit" }),
    );
    const text = screen.getByLabelText(/company profile text/i);
    await userEvent.clear(text);
    await userEvent.type(text, "Rewritten profile.");
    await userEvent.click(
      screen.getByRole("button", { name: "Save company profile detail" }),
    );

    await waitFor(() =>
      expect(client.saveExtendedProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          profileText: "Rewritten profile.",
          cidbGrading: "6CE",
          companyType: "PTY_LTD",
          profileDocument: "https://docs.example.org/profile.pdf",
        }),
      ),
    );
    const [sent] = (
      client.saveExtendedProfile as unknown as {
        mock: { calls: [Record<string, unknown>][] };
      }
    ).mock.calls[0];
    expect(sent.equipmentAssets).toEqual([
      { name: "TLB", quantity: 3, value: 900_000 },
    ]);
  });

  it("routes a CIDB-only change through the narrow single-field endpoint", async () => {
    const client = fullRecordEndpoint();
    wrap(<CompanyProfileScreen endpoint={client} />);
    await screen.findByText("Example Civils");

    await userEvent.click(
      within(profilePanel()).getByRole("button", { name: "Edit" }),
    );
    const cidb = screen.getByLabelText(/cidb grading/i);
    await userEvent.clear(cidb);
    await userEvent.type(cidb, "7CE");
    await userEvent.click(
      screen.getByRole("button", { name: "Save company profile detail" }),
    );

    await waitFor(() =>
      expect(client.setCidbGrading).toHaveBeenCalledWith("7CE"),
    );
    expect(client.saveExtendedProfile).not.toHaveBeenCalled();
  });

  it("adds a project experience", async () => {
    const client = fullRecordEndpoint();
    wrap(<CompanyProfileScreen endpoint={client} />);
    await screen.findByText("Example Civils");

    await userEvent.click(screen.getByRole("button", { name: "Add project" }));
    await userEvent.type(
      screen.getByLabelText(/project name/i),
      "Water reticulation",
    );
    await userEvent.click(screen.getByRole("button", { name: "Add project" }));

    await waitFor(() =>
      expect(client.createExperience).toHaveBeenCalledWith(
        expect.objectContaining({ projectName: "Water reticulation" }),
      ),
    );
    expect(await screen.findByText("Project added.")).toBeVisible();
  });

  it("refuses to submit an experience the update route would later reject", async () => {
    // The create route would silently null this email, leaving a record the
    // parent then refuses to update.
    const client = fullRecordEndpoint();
    wrap(<CompanyProfileScreen endpoint={client} />);
    await screen.findByText("Example Civils");

    await userEvent.click(screen.getByRole("button", { name: "Add project" }));
    await userEvent.type(screen.getByLabelText(/project name/i), "Depot");
    await userEvent.type(
      screen.getByLabelText(/reference email/i),
      "not-an-email",
    );
    await userEvent.click(screen.getByRole("button", { name: "Add project" }));

    expect(client.createExperience).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/must be a valid email address/i),
    ).toBeVisible();
  });

  it("edits an existing experience through the update route", async () => {
    const client = fullRecordEndpoint();
    wrap(<CompanyProfileScreen endpoint={client} />);
    await screen.findByText("Depot upgrade");

    const row = screen.getByText("Depot upgrade").closest("li") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));
    const name = screen.getByLabelText(/project name/i);
    await userEvent.clear(name);
    await userEvent.type(name, "Depot upgrade phase 2");
    await userEvent.click(screen.getByRole("button", { name: "Save project" }));

    await waitFor(() =>
      expect(client.updateExperience).toHaveBeenCalledWith(
        "e1",
        expect.objectContaining({ projectName: "Depot upgrade phase 2" }),
      ),
    );
  });

  it("confirms inline before deleting a record", async () => {
    const client = fullRecordEndpoint();
    wrap(<CompanyProfileScreen endpoint={client} />);
    await screen.findByText("Depot upgrade");

    const row = screen.getByText("Depot upgrade").closest("li") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Remove" }));
    expect(client.deleteExperience).not.toHaveBeenCalled();
    expect(screen.getByText("Remove this project?")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(client.deleteExperience).toHaveBeenCalledWith("e1"),
    );
  });

  it("adds a team member", async () => {
    const client = fullRecordEndpoint();
    wrap(<CompanyProfileScreen endpoint={client} />);
    await screen.findByText("Example Civils");

    await userEvent.click(
      screen.getByRole("button", { name: "Add team member" }),
    );
    await userEvent.type(screen.getByLabelText(/full name/i), "S. Naidoo");
    await userEvent.type(screen.getByLabelText(/^role/i), "Quantity Surveyor");
    await userEvent.click(
      screen.getByRole("button", { name: "Add team member" }),
    );

    await waitFor(() =>
      expect(client.createPersonnel).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: "S. Naidoo",
          role: "Quantity Surveyor",
        }),
      ),
    );
  });

  it("reports a failed mutation in its own words, never the parent's", async () => {
    const client = fullRecordEndpoint({
      deleteExperience: vi.fn(async () => {
        throw new ApiError({
          kind: "server",
          message: "PrismaClientKnownRequestError P2025",
          status: 500,
        });
      }),
    });
    wrap(<CompanyProfileScreen endpoint={client} />);
    await screen.findByText("Depot upgrade");

    const row = screen.getByText("Depot upgrade").closest("li") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Remove" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByRole("alert")).toBeVisible();
    expect(
      screen.queryByText(/PrismaClientKnownRequestError/),
    ).not.toBeInTheDocument();
  });

  it("shows an undocumented JSON shape rather than hiding or crashing on it", async () => {
    // These are `Json?` columns, so a row written by another path can hold
    // anything. Dropping it would be a quiet data loss on this screen.
    const client = endpoint(fullCompany, {
      profile: {
        ...fullProfile,
        equipmentAssets: [{ name: "Grader" }, { label: "legacy", units: 2 }],
      },
    });
    wrap(<CompanyProfileScreen endpoint={client} />);
    await screen.findByText("Example Civils");

    expect(screen.getByText(/Grader/)).toBeVisible();
    expect(screen.getByText(/Label: legacy/)).toBeVisible();
  });

  it("offers an edit control on every panel the profile editor writes", async () => {
    // One route writes all four, so all four must look editable. With the
    // control on only one of them the other three read as read-only.
    wrap(<CompanyProfileScreen endpoint={fullRecordEndpoint()} />);
    await screen.findByText("Example Civils");

    for (const title of DETAIL_PANELS) {
      expect(
        within(panel(title)).getByRole("button", { name: "Edit" }),
      ).toBeVisible();
    }
  });

  it("opens the profile editor from any of those panels", async () => {
    for (const title of ["Operational capacity", "Equipment and assets"]) {
      const client = fullRecordEndpoint();
      const view = wrap(<CompanyProfileScreen endpoint={client} />);
      await screen.findByText("Example Civils");

      await userEvent.click(
        within(panel(title)).getByRole("button", { name: "Edit" }),
      );
      // The one editor, carrying every field the route writes.
      expect(screen.getByLabelText(/company type/i)).toBeVisible();
      expect(screen.getByLabelText(/staff/i)).toBeVisible();
      expect(
        screen.getByRole("button", { name: "Add equipment" }),
      ).toBeVisible();
      expect(
        screen.getByRole("button", { name: "Add professional body" }),
      ).toBeVisible();
      view.unmount();
    }
  });

  it("keeps equipment rows it cannot present as fields when saving", async () => {
    // `POST /profile/extended` replaces the whole column, so writing back only
    // the rows the editor understood would delete the rest.
    const client = endpoint(fullCompany, {
      profile: {
        ...fullProfile,
        equipmentAssets: [{ name: "Grader" }, { label: "legacy", units: 2 }],
      },
    });
    wrap(<CompanyProfileScreen endpoint={client} />);
    await screen.findByText("Example Civils");

    await userEvent.click(
      within(panel("Equipment and assets")).getByRole("button", {
        name: "Edit",
      }),
    );
    expect(screen.getByText(/cannot edit/i)).toBeVisible();

    const text = screen.getByLabelText(/company profile text/i);
    await userEvent.clear(text);
    await userEvent.type(text, "Changed.");
    await userEvent.click(
      screen.getByRole("button", { name: "Save company profile detail" }),
    );

    await waitFor(() => expect(client.saveExtendedProfile).toHaveBeenCalled());
    const [sent] = (
      client.saveExtendedProfile as unknown as {
        mock: { calls: [Record<string, unknown>][] };
      }
    ).mock.calls[0];
    expect(sent.equipmentAssets).toEqual([
      { name: "Grader" },
      { label: "legacy", units: 2 },
    ]);
  });

  it("keeps personnel certifications it cannot present as fields", async () => {
    const client = endpoint(fullCompany, {
      profile: fullProfile,
      keyPersonnel: [
        {
          ...fullPerson,
          certifications: [{ name: "PrEng", issuer: "ECSA" }, { code: "XYZ" }],
        },
      ],
    });
    wrap(<CompanyProfileScreen endpoint={client} />);
    await screen.findByText("N. Dlamini");

    const row = screen.getByText("N. Dlamini").closest("li") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Save team member" }),
    );

    await waitFor(() => expect(client.updatePersonnel).toHaveBeenCalled());
    const [, sent] = (
      client.updatePersonnel as unknown as {
        mock: { calls: [string, Record<string, unknown>][] };
      }
    ).mock.calls[0];
    expect(sent.certifications).toEqual([
      { name: "PrEng", issuer: "ECSA" },
      { code: "XYZ" },
    ]);
  });
});

describe("Document vault", () => {
  const expiring: CompanyDocument = {
    id: "d1",
    documentType: "TAX_CLEARANCE",
    fileUrl: "/api/v1/documents/d1",
    expiryStatus: "expiring",
    daysUntilExpiry: 10,
  };
  const expired: CompanyDocument = {
    id: "d2",
    documentType: "BBBEE_CERTIFICATE",
    fileUrl: "/api/v1/documents/d2",
    expiryStatus: "expired",
    daysUntilExpiry: -5,
  };

  function vaultSavePort(
    overrides: Partial<SaveDownloadPort> = {},
  ): SaveDownloadPort {
    return {
      saveDialog: vi.fn(async () => "C:\\Downloads\\Tax-clearance.pdf"),
      writeBytes: vi.fn(async () => {}),
      ...overrides,
    };
  }

  function endpoint(documents: CompanyDocument[]): DocumentsEndpoint {
    return {
      list: vi.fn(async () => ({
        documents,
        total: documents.length,
        page: 1,
        totalPages: 1,
      })),
      getStats: vi.fn(async () => ({ totalDocuments: documents.length })),
      getDownloadUrl: vi.fn(),
      downloadTenderDocument: vi.fn(async () => ({
        bytes: new Uint8Array([37, 80, 68, 70]),
        filename: "Tax-clearance.pdf",
        contentType: "application/pdf",
      })),
    } as unknown as DocumentsEndpoint;
  }

  it("states expiry as text, not colour alone (A11Y-1)", async () => {
    wrap(<DocumentVault endpoint={endpoint([expired])} />);
    expect(await screen.findByText("Expired 5 days ago")).toBeVisible();
  });

  it("says no expiry is recorded rather than implying validity", async () => {
    wrap(
      <DocumentVault
        endpoint={endpoint([
          { id: "d3", documentType: "OTHER", fileUrl: "/x" },
        ])}
      />,
    );
    expect(await screen.findByText("No expiry recorded")).toBeVisible();
  });

  it("downloads a company document to the user-picked path", async () => {
    const documents = endpoint([expiring]);
    const port = vaultSavePort({
      saveDialog: vi.fn(async () => "C:\\Downloads\\Tax-clearance.pdf"),
    });
    wrap(<DocumentVault endpoint={documents} savePort={port} />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Download" }),
    );

    await waitFor(() =>
      expect(port.writeBytes).toHaveBeenCalledWith(
        "C:\\Downloads\\Tax-clearance.pdf",
        new Uint8Array([37, 80, 68, 70]),
      ),
    );
    expect(documents.downloadTenderDocument).toHaveBeenCalledWith("d1");
    expect(screen.getByText(/uploading documents is done/i)).toBeVisible();
  });

  it("treats a cancelled Vault save as a silent no-op", async () => {
    const port = vaultSavePort({ saveDialog: vi.fn(async () => null) });
    wrap(<DocumentVault endpoint={endpoint([expiring])} savePort={port} />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Download" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Download" })).toBeEnabled(),
    );
    expect(port.writeBytes).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the Vault usable and explains a download failure", async () => {
    const documents = endpoint([expiring]);
    documents.downloadTenderDocument = vi.fn(async () => {
      throw new ApiError({ kind: "server", status: 500, message: "boom" });
    });
    wrap(<DocumentVault endpoint={documents} savePort={vaultSavePort()} />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Download" }),
    );
    expect(
      await screen.findByText(/could not load this document right now/i),
    ).toBeVisible();
    expect(screen.getByText("Expires in 10 days")).toBeVisible();
  });

  it("puts expired documents first, because they block a bid", () => {
    expect(sortByUrgency([expiring, expired]).map((d) => d.id)).toEqual([
      "d2",
      "d1",
    ]);
  });

  it("does not mutate the array it was given", () => {
    const input = [expiring, expired];
    sortByUrgency(input);
    expect(input.map((d) => d.id)).toEqual(["d1", "d2"]);
  });
});

describe("Calendar", () => {
  function endpoint(events: unknown[]): PlannerEndpoint {
    return {
      listEvents: vi.fn(async () => events),
      listSuggested: vi.fn(),
    } as unknown as PlannerEndpoint;
  }

  it("puts overdue events in their own group above the rest", async () => {
    wrap(
      <Calendar
        endpoint={endpoint([
          {
            id: "e1",
            title: "Site visit",
            description: null,
            eventDate: "2020-01-01T00:00:00.000Z",
            eventType: "SITE_VISIT",
            isCompleted: false,
          },
        ])}
      />,
    );
    expect(await screen.findByText(/overdue \(1\)/i)).toBeVisible();
  });

  it("labels an event the platform added itself (brief §4.2)", async () => {
    wrap(
      <Calendar
        endpoint={endpoint([
          {
            id: "e2",
            title: "Closing date",
            description: null,
            eventDate: "2099-01-01T00:00:00.000Z",
            eventType: "CLOSING_DATE",
            isCompleted: false,
            isAutoGenerated: true,
          },
        ])}
      />,
    );
    expect(await screen.findByText("added automatically")).toBeVisible();
  });

  it("tells a signed-out user to sign in rather than showing an empty calendar", async () => {
    // The route answers 200 with authenticated:false, which the endpoint turns
    // into an unauthorized error precisely so this copy appears.
    const failing = {
      listEvents: vi.fn(async () => {
        throw new ApiError({ kind: "unauthorized", message: "no session" });
      }),
    } as unknown as PlannerEndpoint;
    wrap(<Calendar endpoint={failing} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/sign in/i);
  });
});

describe("Notifications screen", () => {
  function endpoint(read: boolean) {
    return {
      list: vi.fn(async () => ({
        notifications: [
          {
            id: "n1",
            type: "TENDER_CLOSING_SOON",
            title: null,
            message: "Closes in 2 days",
            read,
            createdAt: new Date().toISOString(),
          },
        ],
        total: 1,
        offset: 0,
        limit: 20,
        hasMore: false,
        unreadCount: read ? 0 : 1,
      })),
      markRead: vi.fn(async () => {}),
      markAllRead: vi.fn(async () => {}),
      unreadCount: vi.fn(),
    } as unknown as NotificationsEndpoint;
  }

  it("derives a heading from the type when there is no title", async () => {
    wrap(<NotificationsScreen endpoint={endpoint(false)} />);
    expect(await screen.findByText("Tender closing soon")).toBeVisible();
  });

  it("states unread rather than only styling it (A11Y-1)", async () => {
    wrap(<NotificationsScreen endpoint={endpoint(false)} />);
    expect(await screen.findByText("Unread")).toBeVisible();
  });

  it("offers no mark-read control on something already read", async () => {
    wrap(<NotificationsScreen endpoint={endpoint(true)} />);
    await screen.findByText("Tender closing soon");
    expect(screen.queryByRole("button", { name: "Mark read" })).toBeNull();
  });

  it("re-reads from the server after marking read, so the count cannot drift", async () => {
    const ep = endpoint(false);
    wrap(<NotificationsScreen endpoint={ep} />);
    await screen.findByText("Tender closing soon");
    await userEvent.click(screen.getByRole("button", { name: "Mark read" }));
    await waitFor(() => expect(ep.markRead).toHaveBeenCalledWith("n1"));
    // Two loads: the initial one and the reload after the mutation.
    await waitFor(() => expect(ep.list).toHaveBeenCalledTimes(2));
  });
});

describe("timestamp formatting", () => {
  const now = new Date("2026-07-29T12:00:00.000Z");

  it("reads recent times relatively", () => {
    expect(formatTimestamp("2026-07-29T11:30:00.000Z", now)).toBe(
      "30 minutes ago",
    );
  });

  it("falls back to a date for anything over a week", () => {
    expect(formatTimestamp("2026-06-01T12:00:00.000Z", now)).toContain("2026");
  });

  it("says the date is unknown rather than rendering Invalid Date", () => {
    expect(formatTimestamp("not-a-date", now)).toBe("Date unknown");
  });

  it("does not render a negative age for a future timestamp", () => {
    expect(formatTimestamp("2026-08-01T12:00:00.000Z", now)).not.toContain("-");
  });
});
