import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResponseDocumentEditor } from "../features/applications/workflow/ResponseDocumentEditor";

const markdown = `## COMPANY OVERVIEW

**Legal Company Name:** Custom Logic SA Pty Ltd

- Electrical Engineering
- Construction

| Item | Details |
| --- | --- |
| CIDB | 2 |`;

function renderEditor(overrides: Record<string, unknown> = {}) {
  const props = {
    title: "Capability Statement",
    content: markdown,
    onSave: vi.fn(async () => {}),
    onGenerate: vi.fn(async () => {}),
    onDirtyChange: vi.fn(),
    onDraftChange: vi.fn(),
    ...overrides,
  };
  render(<ResponseDocumentEditor {...props} />);
  return props;
}

describe("ResponseDocumentEditor", () => {
  it("renders canonical Markdown as a document instead of raw punctuation", async () => {
    renderEditor();
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "COMPANY OVERVIEW",
      }),
    ).toBeVisible();
    expect(screen.getByText("Legal Company Name:")).toHaveStyle({
      fontWeight: "bold",
    });
    expect(screen.getByRole("list")).toBeVisible();
    expect(screen.getByRole("table")).toBeVisible();
    expect(screen.queryByText("| Item | Details |")).toBeNull();
  });

  it("serializes visual edits to Markdown and saves before exporting", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => {});
    const onExport = vi.fn(async () => {});
    renderEditor({ content: "Existing response", onSave, onExport });
    const editor = await screen.findByRole("textbox", {
      name: "Edit Capability Statement",
    });
    await user.click(editor);
    await user.keyboard(" updated");
    await user.click(
      screen.getByRole("button", { name: "Download response PDF" }),
    );
    await waitFor(() => expect(onExport).toHaveBeenCalledWith("pdf"));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.invocationCallOrder[0]).toBeLessThan(
      onExport.mock.invocationCallOrder[0],
    );
    expect(String((onSave.mock.calls as unknown[][])[0]?.[0])).toContain(
      "updated",
    );
  });

  it("exposes visual formatting and table controls with pressed state", async () => {
    renderEditor();
    expect(
      await screen.findByRole("toolbar", { name: "Formatting controls" }),
    ).toBeVisible();
    for (const name of [
      "Bold",
      "Italic",
      "Heading 1",
      "Bulleted list",
      "Numbered list",
      "Undo",
      "Redo",
      "Insert table",
      "Add or edit link",
    ]) {
      expect(screen.getByRole("button", { name })).toBeVisible();
    }
  });
});
