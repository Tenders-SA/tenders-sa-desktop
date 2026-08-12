import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { QualifyStage } from "../features/applications/workflow/QualifyStage";
import type {
  ApplicationDetail,
  ApplicationsEndpoint,
} from "../services/api/endpoints/applications";
import type { EligibilityEndpoint } from "../services/api/endpoints/eligibility";

const application = {
  id: "a1",
  status: "IN_PROGRESS",
  tender: {
    id: "t1",
    title: "Electrical maintenance",
    referenceNumber: "RFQ-1",
    sourceOrganization: "City",
    requirements: ["Electrical contractor registration"],
  },
  company: {
    id: "c1",
    name: "Example Electrical",
    bbbeeLevel: null,
    industryCodes: ["Electrical"],
    provincesOperating: ["Gauteng"],
  },
} as unknown as ApplicationDetail;

describe("QualifyStage", () => {
  it("keeps eligibility explicit and preserves the partial result", async () => {
    const user = userEvent.setup();
    const check = vi.fn(async () => ({
      eligible: "partial" as const,
      score: 50,
      checks: [
        {
          criterion: "B-BBEE level",
          required: 2,
          user: null,
          pass: false,
        },
      ],
      blockers: [],
      suggestions: ["Update the company profile"],
    }));
    const applications = {
      getComplianceGaps: vi.fn(async () => ({ gaps: [] })),
    } as unknown as ApplicationsEndpoint;

    render(
      <MemoryRouter>
        <QualifyStage
          application={application}
          applicationId="a1"
          applications={applications}
          eligibility={{ check } as unknown as EligibilityEndpoint}
        />
      </MemoryRouter>,
    );

    expect(check).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: /review or update company profile/i }),
    ).toHaveAttribute("href", "/company");
    expect(screen.getByText("Not recorded")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: /check eligibility/i }),
    );

    expect(
      await screen.findByText(
        "Your company meets some criteria — see the gaps below",
      ),
    ).toBeVisible();
    expect(check).toHaveBeenCalledTimes(1);
  });
});
