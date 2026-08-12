import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReviewStage } from "../features/applications/workflow/ReviewStage";
import type {
  ApplicationsEndpoint,
  CockpitPayload,
} from "../services/api/endpoints/applications";
import type { SaveDownloadPort } from "../services/storage/save-download";

describe("ReviewStage", () => {
  it("keeps validation and export explicit and puts blockers before export", async () => {
    const user = userEvent.setup();
    const validate = vi.fn(async () => ({
      ready: false,
      blockers: ["Pricing schedule is incomplete"],
      warnings: ["Confirm the delivery date"],
    }));
    const exportPackage = vi.fn(async () => ({
      bytes: new Uint8Array([1, 2, 3]),
      filename: "proposal-a1.pdf",
      contentType: "application/pdf",
    }));
    const endpoint = {
      validate,
      getComplianceGaps: vi.fn(async () => ({ gaps: [] })),
      getResponseBlueprint: vi.fn(async () => ({
        blueprint: {
          tenderId: "t1",
          responseDocuments: [
            { key: "cover", title: "Cover Letter" },
            { key: "technical", title: "Technical Proposal" },
          ],
        },
        responseDocs: { cover: "Prepared cover" },
      })),
      generateResponseDocument: vi.fn(),
      saveResponseDocument: vi.fn(),
      exportWorkspacePackage: exportPackage,
    } as unknown as ApplicationsEndpoint;
    const savePort: SaveDownloadPort = {
      saveDialog: vi.fn(async () => "C:\\Exports\\proposal-a1.pdf"),
      writeBytes: vi.fn(async () => undefined),
    };

    render(
      <ReviewStage
        applicationId="a1"
        endpoint={endpoint}
        cockpitState={{
          status: "ready",
          value: {
            checklistState: [
              { id: "c1", label: "Confirm pricing", completed: false },
            ],
            events: [],
          } as unknown as CockpitPayload,
        }}
        savePort={savePort}
      />,
    );

    expect(validate).not.toHaveBeenCalled();
    expect(exportPackage).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/1 of 2 response documents prepared/i),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Check readiness" }));
    const blocker = await screen.findByText("Pricing schedule is incomplete");
    const exportHeading = screen.getByText("Export response package");
    expect(blocker.compareDocumentPosition(exportHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    await user.click(screen.getByRole("button", { name: "Export PDF" }));
    await waitFor(() =>
      expect(exportPackage).toHaveBeenCalledWith("a1", "pdf"),
    );
    expect(savePort.writeBytes).toHaveBeenCalled();
    expect(screen.getByText(/does not submit the bid/i)).toBeVisible();
  });
});
