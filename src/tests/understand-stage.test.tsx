import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnderstandStage } from "../features/applications/workflow/UnderstandStage";
import type {
  TenderDetail,
  TendersEndpoint,
} from "../services/api/endpoints/tenders";

const tender: TenderDetail = {
  id: "t1",
  title: "Supply of office furniture",
  referenceNumber: "RFQ-2026-001",
  sourceOrganization: "Department of Public Works",
  closingDate: "2099-01-01T00:00:00.000Z",
  documentCount: 1,
  documents: [
    {
      id: "d1",
      fileName: "Specification.pdf",
      summary: "Supply and install ergonomic office furniture.",
      keyPoints: ["Provide product samples"],
    },
  ],
};

describe("UnderstandStage", () => {
  it("lazy-loads existing tender intelligence and composes the full analysis", async () => {
    const get = vi.fn(async () => tender);

    render(
      <UnderstandStage
        tenderId="t1"
        tenders={{ get } as Pick<TendersEndpoint, "get">}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
    expect(await screen.findByText("AI Summary")).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "AI-Analyzed Compliance Requirements",
      }),
    ).toBeVisible();
    expect(screen.getByText("Specification.pdf")).toBeVisible();
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith("t1", expect.any(AbortSignal)),
    );
  });

  it("renders the saved application tender when its background refresh fails", async () => {
    const get = vi.fn(async () => Promise.reject(new Error("offline")));

    render(
      <UnderstandStage
        tenderId="t1"
        savedTender={{ ...tender, province: null, estimatedValue: null }}
        tenders={{ get } as Pick<TendersEndpoint, "get">}
      />,
    );

    expect(await screen.findByText("AI Summary")).toBeVisible();
    expect(screen.getByText("Specification.pdf")).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByText(/update failed — showing saved tender analysis/i),
      ).toBeVisible(),
    );
  });
});
