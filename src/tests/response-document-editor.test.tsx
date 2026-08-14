import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    expect(screen.getByRole("combobox", { name: "Text style" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Heading 1" })).toBeNull();
    for (const name of [
      "Bold",
      "Italic",
      "Bulleted list",
      "Numbered list",
      "Undo",
      "Redo",
      "Add or edit link",
      "Table options",
    ]) {
      expect(screen.getByLabelText(name)).toBeVisible();
    }
  });

  it("groups heading and table commands into compact menus", async () => {
    const user = userEvent.setup();
    renderEditor();
    const style = await screen.findByRole("combobox", { name: "Text style" });
    await user.selectOptions(style, "1");
    expect(style).toHaveValue("1");

    await user.click(screen.getByLabelText("Table options"));
    for (const name of [
      "Insert table",
      "Add row",
      "Remove row",
      "Add column",
      "Remove column",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("submits multiline AI instructions from the bottom composer with Enter", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn(async () => {});
    renderEditor({ content: "", onGenerate });
    const composer = await screen.findByRole("textbox", {
      name: "Instructions for AI document changes",
    });
    await user.type(
      composer,
      "Make this more concise{shift>}{enter}{/shift}Keep evidence",
    );
    fireEvent.keyDown(composer, { key: "Enter", shiftKey: false });
    await waitFor(() =>
      expect(onGenerate).toHaveBeenCalledWith(
        "Make this more concise\nKeep evidence",
      ),
    );
    expect(composer).toHaveValue("");
  });

  it("does not regenerate over unsaved manual edits", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn(async () => {});
    renderEditor({ content: "Existing response", onGenerate });
    const editor = await screen.findByRole("textbox", {
      name: "Edit Capability Statement",
    });
    await user.click(editor);
    await user.keyboard(" changed");
    await user.click(
      screen.getByRole("button", { name: "Send AI instruction" }),
    );
    expect(onGenerate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /save or revert your unsaved edits/i,
    );
  });

  it("regenerates a clean existing document from the composer", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn(async () => {});
    renderEditor({ content: "Existing response", onGenerate });
    const composer = await screen.findByRole("textbox", {
      name: "Instructions for AI document changes",
    });
    await user.type(composer, "Emphasise electrical engineering");
    await user.click(
      screen.getByRole("button", { name: "Send AI instruction" }),
    );
    await waitFor(() =>
      expect(onGenerate).toHaveBeenCalledWith(
        "Emphasise electrical engineering",
      ),
    );
  });
});
