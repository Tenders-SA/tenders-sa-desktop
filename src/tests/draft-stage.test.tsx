import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DraftStage } from "../features/applications/workflow/DraftStage";
import { UnsavedChangesDialog } from "../features/applications/workflow/UnsavedChangesDialog";
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
            {
              key: "capability statement",
              title: "Capability Statement",
              brief: "Show the company's relevant capability.",
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

    await user.click(
      screen.getByRole("button", { name: /capability statement/i }),
    );
    expect(
      screen.getByRole("textbox", { name: "Edit Capability Statement" }),
    ).toHaveValue("");
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "Capability Statement",
    );

    await user.click(
      screen.getByRole("button", { name: /technical proposal/i }),
    );

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

  it("guards dirty Close with Stay, Discard and Save choices", async () => {
    const user = userEvent.setup();
    const save = vi.fn(async () => ({ ok: true, key: "technical" }));
    const endpoint = {
      getResponseBlueprint: vi.fn(async () => ({
        blueprint: {
          tenderId: "t1",
          responseDocuments: [
            { key: "technical", title: "Technical Proposal" },
          ],
        },
        responseDocs: { technical: "Existing response" },
      })),
      saveResponseDocument: save,
      generateResponseDocument: vi.fn(),
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

    const editor = await screen.findByRole("textbox", {
      name: "Edit Technical Proposal",
    });
    fireEvent.change(editor, { target: { value: "Unsaved response" } });
    fireEvent(
      window,
      new Event("beforeunload", { bubbles: false, cancelable: true }),
    );

    await user.click(screen.getByRole("button", { name: "Close editor" }));
    const warning = screen.getByRole("alertdialog", {
      name: "Save your changes?",
    });
    expect(warning).toBeVisible();
    expect(screen.getByRole("button", { name: "Stay" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Stay" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(editor).toHaveValue("Unsaved response");

    await user.click(screen.getByRole("button", { name: "Close editor" }));
    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith("a1", "technical", "Unsaved response"),
    );
    expect(await screen.findByText("Returned to plan")).toBeVisible();
  });
});

describe("UnsavedChangesDialog", () => {
  it("stays open and keeps the decision available after a failed save", async () => {
    const user = userEvent.setup();
    render(
      <UnsavedChangesDialog
        onSave={vi.fn(async () => {
          throw new Error("offline");
        })}
        onDiscard={vi.fn()}
        onStay={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(
      await screen.findByText(/could not save this document/i),
    ).toBeVisible();
    expect(screen.getByRole("alertdialog")).toBeVisible();
    expect(screen.getByRole("button", { name: "Discard" })).toBeEnabled();
  });
});
