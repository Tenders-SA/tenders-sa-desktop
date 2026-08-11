/**
 * Command Centre charts (Slice 8, T5/T6 — R-V10, R-V11, R-V12).
 *
 * The three assertions that matter most here are not about pixels:
 *
 *  - the charts add **no** request (R-V10) — three of them are drawn from a
 *    payload the screen was already fetching and discarding;
 *  - the two data domains fail **independently** (R-V11) — a pulse outage
 *    must not take the user's own deadlines off the screen, and vice versa;
 *  - nothing renders an invented number (R-V12) — an omitted total is `—`,
 *    an empty pipeline is a sentence, not an empty donut.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CommandCentre } from "../features/command-centre/CommandCentre";
import {
  summarisePipeline,
  summariseRunway,
} from "../features/command-centre/pipeline-summary";
import { ApiError } from "../services/api/errors";
import { stubApiClients } from "./fixtures/api-clients";
import type { ApiClients } from "../app/auth-wiring";
import type { Application } from "../services/api/endpoints/applications";
import type { PlatformPulse } from "../services/api/endpoints/pulse";

const DAY_MS = 24 * 60 * 60 * 1000;

function application(overrides: Partial<Application> = {}): Application {
  return {
    id: Math.random().toString(36).slice(2),
    tenderId: "t1",
    status: "DRAFT",
    submittedAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    notes: null,
    isArchived: false,
    tender: {
      id: "t1",
      title: "Supply of laboratory consumables",
      referenceNumber: "RFQ-1",
      sourceOrganization: "Department of Health",
      closingDate: null,
      estimatedValue: 250_000,
      province: "Gauteng",
    },
    ...overrides,
  } as Application;
}

function pulse(overrides: Partial<PlatformPulse> = {}): PlatformPulse {
  return {
    totals: {
      activeTenders: 4812,
      newTenders30d: 1204,
      closingSoon7d: 318,
      awards30d: 642,
      awardedValue30d: 8_400_000_000,
    },
    trend: [
      { date: "2026-08-09", tenders: 40, awards: 12 },
      { date: "2026-08-10", tenders: 55, awards: 9 },
    ],
    tendersByProvince: [
      { province: "Western Cape", count: 903 },
      { province: "Gauteng", count: 1402 },
    ],
    awardsByProvince: [],
    generatedAt: "2026-08-11T06:00:00.000Z",
    ...overrides,
  };
}

function clientsWith({
  applications = [application()],
  pulseValue = pulse(),
  applicationsError,
  pulseError,
}: {
  applications?: Application[];
  pulseValue?: PlatformPulse;
  applicationsError?: unknown;
  pulseError?: unknown;
} = {}): ApiClients {
  const list = vi.fn(async () =>
    applicationsError
      ? Promise.reject(applicationsError)
      : {
          applications,
          pagination: { total: applications.length, limit: 50, offset: 0 },
        },
  );
  const getPulse = vi.fn(async () =>
    pulseError ? Promise.reject(pulseError) : pulseValue,
  );

  return stubApiClients({
    applications: { ...stubApiClients().applications, list },
    documents: {
      ...stubApiClients().documents,
      getStats: vi.fn(async () => ({ totalDocuments: 7 })),
    },
    // The stubs are structural stand-ins for endpoint classes, so the cast
    // goes through `unknown` — the same shape `stubApiClients` itself uses.
    pulse: { getPulse },
  } as unknown as Partial<ApiClients>);
}

function renderCentre(clients: ApiClients) {
  return render(
    <MemoryRouter>
      <CommandCentre clients={clients} />
    </MemoryRouter>,
  );
}

describe("Command Centre — market visuals (R-V10)", () => {
  it("shows the platform totals", async () => {
    renderCentre(clientsWith());
    const strip = await screen.findByRole("region", {
      name: "Platform activity",
    });
    expect(within(strip).getByText("4 812")).toBeInTheDocument();
    expect(within(strip).getByText("R8.4bn")).toBeInTheDocument();
  });

  it("renders an omitted total as an em dash, never as zero", async () => {
    // "No awards were published" and "nobody counted" are different claims.
    renderCentre(
      clientsWith({
        pulseValue: pulse({ totals: { activeTenders: 10 } }),
      }),
    );
    const strip = await screen.findByRole("region", {
      name: "Platform activity",
    });
    expect(within(strip).getAllByText("—").length).toBeGreaterThan(0);
    expect(within(strip).queryByText("0")).toBeNull();
  });

  it("reads the pulse exactly once for three visuals", async () => {
    const clients = clientsWith();
    renderCentre(clients);
    await screen.findByRole("region", { name: "Platform activity" });
    await waitFor(() =>
      expect(
        screen.getByRole("img", {
          name: /tenders and awards published/i,
        }),
      ).toBeInTheDocument(),
    );
    expect(clients.pulse.getPulse).toHaveBeenCalledTimes(1);
  });

  it("ranks provinces by volume rather than by payload order", async () => {
    renderCentre(clientsWith());
    const table = await screen.findByRole("table", {
      name: "Open tenders by province",
    });
    const rows = within(table).getAllByRole("rowheader");
    expect(rows[0]).toHaveTextContent("Gauteng");
  });

  it("says so when the window carries no activity", async () => {
    renderCentre(
      clientsWith({
        pulseValue: pulse({
          trend: [
            { date: "2026-08-09", tenders: 0, awards: 0 },
            { date: "2026-08-10", tenders: 0, awards: 0 },
          ],
        }),
      }),
    );
    expect(
      await screen.findByText(/No activity recorded in this window/i),
    ).toBeInTheDocument();
  });

  it("says the province breakdown is unavailable rather than drawing nothing", async () => {
    renderCentre(clientsWith({ pulseValue: pulse({ tendersByProvince: [] }) }));
    expect(
      await screen.findByText(/Province breakdown is unavailable/i),
    ).toBeInTheDocument();
  });
});

describe("Command Centre — portfolio visuals (R-V10)", () => {
  it("adds no request: the charts reuse the applications read", async () => {
    // Before Slice 8 this screen already fetched fifty applications and
    // rendered three numbers from them. The donut and the runway are drawn
    // from the rest of that same payload.
    const clients = clientsWith();
    renderCentre(clients);
    await screen.findByRole("img", { name: "Your applications by status" });

    const listCalls = (clients.applications.list as ReturnType<typeof vi.fn>)
      .mock.calls;
    const portfolioReads = listCalls.filter(
      ([query]) => (query as { limit?: number })?.limit === 50,
    );
    expect(portfolioReads).toHaveLength(1);
  });

  it("draws the pipeline donut from the user's own applications", async () => {
    renderCentre(
      clientsWith({
        applications: [
          application({ status: "DRAFT" }),
          application({ status: "SUBMITTED" }),
          application({ status: "SUBMITTED" }),
        ],
      }),
    );
    const table = await screen.findByRole("table", {
      name: "Your applications by status",
    });
    expect(
      within(table).getByRole("rowheader", { name: "Submitted" }),
    ).toBeInTheDocument();
  });

  it("shows the runway when deadlines land in the fortnight", async () => {
    const soon = new Date(Date.now() + 2 * DAY_MS).toISOString();
    renderCentre(
      clientsWith({
        applications: [
          application({
            tender: {
              ...application().tender,
              closingDate: soon,
            },
          } as Partial<Application>),
        ],
      }),
    );
    expect(
      await screen.findByRole("img", {
        name: /closing over the next 14 days/i,
      }),
    ).toBeInTheDocument();
  });

  it("explains an empty pipeline instead of drawing an empty donut (R-V12)", async () => {
    renderCentre(clientsWith({ applications: [] }));
    expect(await screen.findByText(/No applications yet/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: "Your applications by status" }),
    ).toBeNull();
  });

  it("says nothing closes rather than drawing fourteen empty days", async () => {
    renderCentre(clientsWith({ applications: [application()] }));
    expect(
      await screen.findByText(/Nothing closes in the next fortnight/i),
    ).toBeInTheDocument();
  });
});

describe("Command Centre — failure domains stay apart (R-V11)", () => {
  it("keeps the user's pipeline on screen when the pulse fails", async () => {
    renderCentre(
      clientsWith({
        pulseError: new ApiError({ kind: "server", message: "boom" }),
      }),
    );

    // The market panels report the failure...
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.length).toBeGreaterThan(0);
    // ...and the portfolio chart is still there.
    expect(
      await screen.findByRole("img", { name: "Your applications by status" }),
    ).toBeInTheDocument();
  });

  it("keeps the market on screen when the applications read fails", async () => {
    renderCentre(
      clientsWith({
        applicationsError: new ApiError({ kind: "server", message: "boom" }),
      }),
    );

    expect(
      await screen.findByRole("img", {
        name: /tenders and awards published/i,
      }),
    ).toBeInTheDocument();
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
  });
});

describe("pipeline summary", () => {
  it("counts by status and keeps zero categories", () => {
    const { slices, total } = summarisePipeline([
      application({ status: "DRAFT" }),
      application({ status: "AWARDED" }),
    ]);
    expect(total).toBe(2);
    expect(slices.find((s) => s.label === "Rejected")?.value).toBe(0);
  });

  it("excludes archived applications", () => {
    const { total } = summarisePipeline([
      application({ status: "DRAFT" }),
      application({
        status: "DRAFT",
        isArchived: true,
      } as Partial<Application>),
    ]);
    expect(total).toBe(1);
  });

  it("folds an unrecognised status into Other rather than dropping it", () => {
    // `status` is `z.string()` because the parent may add values. An
    // application that disappears from the user's own count because the
    // server renamed a status would be worse than an unlabelled slice.
    const { slices, total } = summarisePipeline([
      application({ status: "PENDING_CLARIFICATION" }),
    ]);
    expect(total).toBe(1);
    expect(slices.find((s) => s.label === "Other")?.value).toBe(1);
  });

  it("omits Other entirely when every status is known", () => {
    const { slices } = summarisePipeline([application({ status: "DRAFT" })]);
    expect(slices.some((s) => s.label === "Other")).toBe(false);
  });
});

describe("deadline runway", () => {
  const now = new Date("2026-08-11T09:00:00");

  it("buckets closings by local day across the window", () => {
    const days = summariseRunway(
      [
        application({
          tender: {
            ...application().tender,
            closingDate: "2026-08-13T10:00:00",
          },
        } as Partial<Application>),
      ],
      14,
      now,
    );
    expect(days).toHaveLength(14);
    expect(days.find((day) => day.date === "2026-08-13")?.value).toBe(1);
  });

  it("labels the first bucket Today", () => {
    expect(summariseRunway([], 14, now)[0].label).toBe("Today");
  });

  it("ignores closings outside the window and unparseable dates", () => {
    const days = summariseRunway(
      [
        application({
          tender: {
            ...application().tender,
            closingDate: "2026-12-01T10:00:00",
          },
        } as Partial<Application>),
        application({
          tender: { ...application().tender, closingDate: "not a date" },
        } as Partial<Application>),
      ],
      14,
      now,
    );
    expect(days.every((day) => day.value === 0)).toBe(true);
  });

  it("marks the first three days as urgent", () => {
    const days = summariseRunway([], 14, now);
    expect(days[0].token).toBe(4);
    expect(days[5].token).toBe(1);
  });
});
