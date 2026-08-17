import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { OfficerDetailPanel } from "../features/procurement-officers/OfficerDetailPanel";
import type {
  OfficerDetailData,
  OfficerDetailView,
} from "../features/procurement-officers/use-officer-detail";

function detailData(overrides: Partial<OfficerDetailData> = {}): OfficerDetailData {
  return {
    id: "officer-1",
    canonicalName: "Thabo Mokoena",
    firstName: "Thabo",
    lastName: "Mokoena",
    currentTitle: "Supply Chain Manager",
    province: "Gauteng",
    kind: "officer",
    status: "verified",
    confidenceScore: 0.95,
    firstSeenAt: "2025-01-01T00:00:00.000Z",
    lastSeenAt: "2025-06-01T00:00:00.000Z",
    verifiedAt: "2025-03-01T00:00:00.000Z",
    tendersCount: 1,
    organisationId: "org-9",
    organisationName: "Department of Water Affairs",
    organisationAddress: "Private Bag X313, Pretoria",
    assignments: [
      {
        id: "a-1",
        organisationId: "org-9",
        organisationName: "Department of Water Affairs",
        title: "Supply Chain Manager",
        validFrom: "2024-01-01T00:00:00.000Z",
        validTo: null,
        isCurrent: true,
        confidenceScore: 0.9,
      },
    ],
    headlineAssignment: {
      id: "a-1",
      organisationId: "org-9",
      organisationName: "Department of Water Affairs",
      title: "Supply Chain Manager",
      validFrom: "2024-01-01T00:00:00.000Z",
      validTo: null,
      isCurrent: true,
      confidenceScore: 0.9,
    },
    contactPoints: [
      { id: "cp-1", type: "email", value: "thabo@dwa.gov.za", isRoleBased: false, isOfficial: true, verificationStatus: "verified", masked: false },
      { id: "cp-2", type: "telephone", value: "0123456789", isRoleBased: false, isOfficial: true, verificationStatus: "verified", masked: false },
    ],
    tenders: [
      { tenderId: "t-1", title: "Water infrastructure maintenance", referenceNumber: "DWA/2025/01", province: "Gauteng", closingDate: "2025-12-01T12:00:00.000Z", sourceUrl: null },
    ],
    evidenceSummary: null,
    ...overrides,
  };
}

function view(overrides: Partial<OfficerDetailView> = {}): OfficerDetailView {
  return {
    data: detailData(),
    phase: "idle",
    saved: false,
    note: "",
    organisationLink: null,
    toggleSaved: vi.fn(async () => {}),
    saveNote: vi.fn(async () => {}),
    copyValue: vi.fn(async () => true),
    ...overrides,
  };
}

function renderPanel(v: OfficerDetailView, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <OfficerDetailPanel view={v} onClose={onClose} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OfficerDetailPanel", () => {
  it("renders the headline assignment, organisation, contacts and tenders", () => {
    renderPanel(view());

    expect(screen.getByText("Thabo Mokoena")).toBeVisible();
    expect(screen.getByText("Current assignment")).toBeVisible();
    expect(screen.getByText("Supply Chain Manager")).toBeVisible();
    expect(screen.getByText("Current")).toBeVisible();
    expect(screen.getAllByText("Department of Water Affairs").length).toBeGreaterThan(0);
    expect(screen.getByText("Private Bag X313, Pretoria")).toBeVisible();
    expect(screen.getByText(/thabo@dwa\.gov\.za/)).toBeVisible();
    expect(screen.getByText("Water infrastructure maintenance")).toBeVisible();
  });

  it("marks stale assignments as not current and shows no badge", () => {
    const stale = view({
      data: detailData({
        assignments: [
          { id: "a-old", organisationId: null, organisationName: null, title: "Former role", validFrom: "2022-01-01T00:00:00.000Z", validTo: "2023-01-01T00:00:00.000Z", isCurrent: false, confidenceScore: null },
        ],
        headlineAssignment: {
          id: "a-old", organisationId: null, organisationName: null, title: "Former role", validFrom: "2022-01-01T00:00:00.000Z", validTo: "2023-01-01T00:00:00.000Z", isCurrent: false, confidenceScore: null,
        },
      }),
    });
    renderPanel(stale);

    expect(screen.getByText("Former role")).toBeVisible();
    expect(screen.queryByText("Current")).not.toBeInTheDocument();
  });

  it("marks masked server contacts honestly", () => {
    renderPanel(
      view({
        data: detailData({
          contactPoints: [
            { id: "cp-s", type: "email", value: "th***@dwa.gov.za", isRoleBased: false, isOfficial: true, verificationStatus: "verified", masked: true },
          ],
        }),
      }),
    );

    expect(screen.getByText(/th\*\*\*@dwa\.gov\.za/)).toBeVisible();
    expect(screen.getByText(/masked — sync to reveal/)).toBeVisible();
  });

  it("copies the official email and telephone via the actions toolbar", async () => {
    const copyValue = vi.fn(async () => true);
    renderPanel(view({ copyValue }));
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Copy email" }));
    expect(copyValue).toHaveBeenCalledWith("thabo@dwa.gov.za");

    await user.click(screen.getByRole("button", { name: "Copy telephone" }));
    expect(copyValue).toHaveBeenCalledWith("0123456789");
  });

  it("opens the email client with a mailto for the official email", () => {
    renderPanel(view());

    const emailLink = screen.getByRole("link", { name: "Email officer" });
    expect(emailLink).toHaveAttribute("href", "mailto:thabo@dwa.gov.za");
    const contactEmail = screen.getAllByRole("link", { name: "Email" })[0];
    expect(contactEmail).toHaveAttribute("href", "mailto:thabo@dwa.gov.za");
  });

  it("toggles the saved state", async () => {
    const toggleSaved = vi.fn(async () => {});
    renderPanel(view({ toggleSaved, saved: false }));
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Save officer" }));
    expect(toggleSaved).toHaveBeenCalledTimes(1);
  });

  it("shows the unsave affordance once saved", () => {
    renderPanel(view({ saved: true }));
    expect(screen.getByRole("button", { name: "Unsave officer" })).toBeVisible();
  });

  it("persists private notes through the editor", async () => {
    const saveNote = vi.fn(async () => {});
    renderPanel(view({ saveNote }));
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox", { name: "Private notes" }), "Prefers email");
    await user.click(screen.getByRole("button", { name: "Save note" }));

    expect(saveNote).toHaveBeenCalledWith("Prefers email");
  });

  it("links to the organisation profile only when the workspace company matches", () => {
    const linked = view({ organisationLink: "/company" });
    renderPanel(linked);
    expect(screen.getByRole("link", { name: "Organisation profile" })).toHaveAttribute(
      "href",
      "/company",
    );
  });

  it("offers no organisation link when the organisation is not the own company", () => {
    renderPanel(view());
    expect(screen.queryByRole("link", { name: "Organisation profile" })).not.toBeInTheDocument();
  });

  it("shows no bulk export affordance anywhere (R-P13)", () => {
    renderPanel(view());
    expect(screen.queryByText(/export/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/download/i)).not.toBeInTheDocument();
  });

  it("returns to the results list via Back", async () => {
    const onClose = vi.fn();
    renderPanel(view(), onClose);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("scrolls to the related tenders from the View tenders action", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderPanel(view());
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "View tenders" }));
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("links related tenders into the tender detail route", () => {
    renderPanel(view());
    const tenderLink = screen.getByRole("link", { name: "Water infrastructure maintenance" });
    expect(tenderLink).toHaveAttribute("href", "/tenders/t-1");
  });

  it("keeps local rows visible when the refresh failed", () => {
    renderPanel(view({ phase: "error" }));
    expect(screen.getByText(/Server refresh failed/)).toBeVisible();
    expect(screen.getByText("Thabo Mokoena")).toBeVisible();
  });
});
