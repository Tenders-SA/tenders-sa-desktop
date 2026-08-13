import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PlanStage } from "../features/applications/workflow/PlanStage";
import type { ApplicationsEndpoint } from "../services/api/endpoints/applications";
import { decodeDraftDocumentKey } from "../features/applications/workflow/document-route";

function DraftDestination() {
  const { documentKey } = useParams();
  return <p>Draft key: {decodeDraftDocumentKey(documentKey)}</p>;
}

function endpoint(): ApplicationsEndpoint {
  return {
    getAdditionalInfo: vi.fn(async () => ({
      values: {},
      fields: [],
      unfilledRequired: 0,
    })),
    saveAdditionalInfo: vi.fn(async () => ({ persisted: true })),
    getResearch: vi.fn(async () => ({})),
    getResponseBlueprint: vi.fn(async () => ({
      blueprint: {
        tenderId: "t1",
        responseDocuments: [
          {
            key: "technical proposal/works",
            title: "Technical Proposal",
            mandatory: true,
          },
        ],
        requiredUserDocuments: [{ name: "Tax clearance", mandatory: true }],
        steps: [{ key: "gather", title: "Gather evidence" }],
        risks: ["Confirm every returnable"],
      },
      responseDocs: {
        "technical proposal/works": "# Existing response",
      },
    })),
    generateResponseDocument: vi.fn(async () => ({
      key: "technical proposal/works",
      status: "generating",
    })),
    saveResponseDocument: vi.fn(async () => ({
      ok: true,
      key: "technical proposal/works",
    })),
    enrichBlueprint: vi.fn(async () => ({ enriched: false })),
    exportWorkspacePackage: vi.fn(),
  } as unknown as ApplicationsEndpoint;
}

describe("PlanStage", () => {
  it("shows the preparation hierarchy and opens Edit in the encoded Draft route", async () => {
    render(
      <MemoryRouter initialEntries={["/applications/a1/plan"]}>
        <Routes>
          <Route
            path="/applications/:applicationId/plan"
            element={<PlanStage applicationId="a1" endpoint={endpoint()} />}
          />
          <Route
            path="/applications/:applicationId/draft/:documentKey"
            element={<DraftDestination />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", {
        name: /complete the information needed for drafting/i,
      }),
    ).toBeVisible();
    expect(screen.getByText("Tax clearance")).toBeVisible();
    expect(screen.getByText("Gather evidence")).toBeVisible();
    expect(screen.queryByRole("textbox")).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: /edit technical proposal/i }),
    );
    expect(
      screen.getByText("Draft key: technical proposal/works"),
    ).toBeVisible();
  });
});
