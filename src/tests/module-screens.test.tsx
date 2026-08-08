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
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "../services/api/errors";
import { TenderRadar } from "../features/radar/TenderRadar";
import { Opportunities } from "../features/opportunities/Opportunities";
import { ApplicationWorkspace } from "../features/applications/ApplicationWorkspace";
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
import type { DocumentsEndpoint } from "../services/api/endpoints/documents";
import type { PlannerEndpoint } from "../services/api/endpoints/planner";
import type { NotificationsEndpoint } from "../services/api/endpoints/notifications";
import type { CompanyDocument } from "../services/api/endpoints/documents";

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
    } as unknown as RecommendationsEndpoint;
  }

  it("shows the score as a number and as a band", async () => {
    // The band is what a user acts on; a bare percentage invites false
    // precision about a server-side heuristic.
    wrap(
      <TenderRadar
        endpoint={endpoint({
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
        endpoint={endpoint({
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
        endpoint={endpoint({
          state: "empty",
          recommendations: [],
          hasMore: false,
          offset: 0,
          limit: 20,
        })}
      />,
    );
    expect(
      await screen.findByText(/no open tenders currently match/i),
    ).toBeVisible();
    expect(screen.queryByText(/add your company profile/i)).toBeNull();
  });

  it("shows the gaps that explain a score", async () => {
    wrap(
      <TenderRadar
        endpoint={endpoint({
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
    wrap(<TenderRadar endpoint={failing} />);
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
      await screen.findByRole("heading", { name: /no saved tenders/i }),
    ).toBeVisible();
  });

  it("filters server-side when the open-only box is used", async () => {
    const ep = endpoint([]);
    wrap(<Opportunities endpoint={ep} />);
    await waitFor(() => expect(ep.list).toHaveBeenCalled());
    // Default is on, so the first call already narrows.
    expect(ep.list).toHaveBeenCalledWith(
      expect.objectContaining({ activeOnly: true, futureOnly: true }),
      expect.anything(),
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
      ...overrides,
    } as unknown as ApplicationsEndpoint;
  }

  it("puts the tender requirements and the company side by side", async () => {
    wrap(<ApplicationWorkspace endpoint={endpoint()} applicationId="a1" />);
    expect(await screen.findByText("Tax clearance")).toBeVisible();
    expect(screen.getByText("Acme")).toBeVisible();
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

describe("ApplicationWorkspace — workspace cockpit", () => {
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

  const cockpit = {
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

  const gaps = {
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

  const research = {
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

  function endpoint(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      get: vi.fn(async () => detail),
      validate: vi.fn(async () => ({
        ready: false,
        blockers: [],
        warnings: [],
      })),
      getCockpit: vi.fn(async () => cockpit),
      getComplianceGaps: vi.fn(async () => gaps),
      getResearch: vi.fn(async () => research),
      getWorkspaceStage: vi.fn(async () => "add_information"),
      updateWorkspace: vi.fn(async () => ({ success: true })),
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

describe("Company profile screen", () => {
  function endpoint(profile: unknown): CompanyEndpoint {
    return {
      getProfile: vi.fn(async () => profile),
      getExperiences: vi.fn(async () => []),
      getPersonnel: vi.fn(async () => []),
      getCidb: vi.fn(),
    } as unknown as CompanyEndpoint;
  }

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

  it("does not offer a download it cannot perform (INT-4)", async () => {
    wrap(<DocumentVault endpoint={endpoint([expiring])} />);
    await screen.findByText("Expires in 10 days");
    expect(screen.queryByRole("button", { name: /download/i })).toBeNull();
    expect(screen.getByText(/done on the Tenders-SA website/i)).toBeVisible();
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
