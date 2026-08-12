import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DraftStage } from "../features/applications/workflow/DraftStage";
import type { ApplicationsEndpoint } from "../services/api/endpoints/applications";

describe("DraftStage", () => {
  it("opens a full-screen dialog and edits the generated response through existing contracts", async () => {
    const user = userEvent.setup();
    const save = vi.fn(async () => ({ ok: true, key: "technical" }));
    const endpoint = {
      getResponseBlueprint: vi.fn(async () => ({
        blueprint: {
          tenderId: "t1",
          responseDocuments: [
            {
              key: "technical",
              title: "Technical Proposal",
              brief: "Address the technical specification.",
              requiredBy: "Technical returnable",
            },
          ],
        },
        responseDocs: { technical: "Existing response" },
        responseDocStatus: { technical: { state: "ready" } },
      })),
      saveResponseDocument: save,
      generateResponseDocument: vi.fn(async () => ({
        key: "technical",
        status: "generating",
      })),
    } as unknown as ApplicationsEndpoint;

    render(
      <MemoryRouter initialEntries={["/applications/a1/draft/technical"]}>
        <Routes>
          <Route
            path="/applications/:applicationId/draft/:documentKey"
            element={
              <DraftStage
                applicationId="a1"
                documentKey="technical"
                endpoint={endpoint}
              />
            }
          />
          <Route
            path="/applications/:applicationId/plan"
            element={<p>Returned to plan</p>}
          />
        </Routes>
      </MemoryRouter>,
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Technical Proposal",
    });
    expect(dialog).toHaveClass("fixed", "inset-0");
    expect(
      screen.getByText("Address the technical specification."),
    ).toBeVisible();

    const editor = screen.getByRole("textbox", {
      name: "Edit Technical Proposal",
    });
    fireEvent.change(editor, { target: { value: "Our delivery method" } });
    await user.click(screen.getByRole("button", { name: "Heading" }));
    expect(editor).toHaveValue("## Our delivery method");

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        "a1",
        "technical",
        "## Our delivery method",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Close editor" }));
    expect(await screen.findByText("Returned to plan")).toBeVisible();
  });
});
