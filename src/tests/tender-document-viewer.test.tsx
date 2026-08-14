import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TenderDocumentViewer } from "../features/tenders/TenderDocumentViewer";
import type { TenderDetail } from "../services/api/endpoints/tenders";

const tender: TenderDetail = {
  id: "t1",
  title: "Rainwater harvesting services",
  referenceNumber: "RFQ-1",
  sourceOrganization: "City",
  closingDate: "2026-09-01",
  documents: [
    {
      id: "d1",
      fileName: "8f31ab45_rainwater-harvesting-contract.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      processingStatus: "processed",
      summary: "The contract defines the required works.",
      keyPoints: ["Provide maintenance", "Submit warranties"],
      analyses: [
        {
          id: "analysis-1",
          submissionGuidelines: "Submit through the portal.",
          evaluationCriteria: "Price and technical capability.",
          importantDates: "Briefing on 20 August.",
          contactInformation: "tenders@example.test",
          technicalSpecifications: "10,000 litre storage capacity.",
          financialRequirements: "Fixed-price quotation.",
          complianceRequirements: "Valid tax status required.",
          confidenceScore: 0.91,
        },
      ],
    },
    {
      id: "d2",
      fileName: "pricing_schedule.xlsx",
      processingStatus: "pending",
    },
  ],
};

describe("TenderDocumentViewer", () => {
  it("shows the selected source beside only that document's extracted analysis", async () => {
    const endpoint = {
      downloadTenderDocument: vi.fn(async () => ({
        bytes: new Uint8Array([1, 2, 3]),
        filename: "contract.docx",
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })),
    };
    const onSelectDocument = vi.fn();
    render(
      <TenderDocumentViewer
        tender={tender}
        selectedDocumentId="d1"
        endpoint={endpoint}
        onSelectDocument={onSelectDocument}
        onBack={vi.fn()}
      />,
    );

    expect(
      screen.getAllByText("Rainwater Harvesting Contract").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("The contract defines the required works."),
    ).toBeVisible();
    expect(screen.getByText("Submit through the portal.")).toBeVisible();
    expect(screen.getByText("Valid tax status required.")).toBeVisible();
    expect(screen.getByText("91%")).toBeVisible();
    expect(await screen.findByText("Preview unavailable")).toBeVisible();
    expect(endpoint.downloadTenderDocument).toHaveBeenCalledWith(
      "d1",
      expect.any(AbortSignal),
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Pricing Schedule/ }),
    );
    expect(onSelectDocument).toHaveBeenCalledWith("d2");
  });

  it("lets keyboard users collapse and restore both supporting panes", async () => {
    const endpoint = {
      downloadTenderDocument: vi.fn(async () => ({
        bytes: new Uint8Array([1]),
        filename: "contract.docx",
        contentType: "application/octet-stream",
      })),
    };
    render(
      <TenderDocumentViewer
        tender={tender}
        selectedDocumentId="d1"
        endpoint={endpoint}
        onSelectDocument={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(endpoint.downloadTenderDocument).toHaveBeenCalled(),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Hide documents" }),
    );
    expect(
      screen.queryByRole("complementary", { name: "Tender documents" }),
    ).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Hide analysis" }),
    );
    expect(
      screen.queryByRole("complementary", { name: "Extracted analysis" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Show documents" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Show analysis" })).toBeVisible();
  });
});
