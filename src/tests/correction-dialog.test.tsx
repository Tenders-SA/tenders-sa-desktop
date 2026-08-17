import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CorrectionDialog, type CorrectionFieldOption } from "../features/procurement-officers/CorrectionDialog";

const fields: CorrectionFieldOption[] = [
  { field: "email", label: "Email", value: "thabo@dwa.gov.za" },
  { field: "title", label: "Current title", value: "Supply Chain Manager" },
];

function renderDialog(overrides: Partial<Parameters<typeof CorrectionDialog>[0]> = {}) {
  const props = {
    open: true,
    officerName: "Thabo Mokoena",
    fields,
    phase: "idle" as const,
    status: null,
    errorMessage: null,
    onSubmit: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<CorrectionDialog {...props} />);
  return props;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CorrectionDialog", () => {
  it("renders the field selector, reason input and submit action", () => {
    renderDialog();
    expect(
      screen.getByRole("heading", { name: "Report incorrect information" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Field")).toBeVisible();
    expect(screen.getByLabelText("Reason")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Report incorrect information" }),
    ).toBeDisabled();
  });

  it("submits the selected field with the typed reason", async () => {
    const { onSubmit } = renderDialog();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Field"), "title");
    await user.type(screen.getByLabelText("Reason"), "He left this role");
    await user.click(
      screen.getByRole("button", { name: "Report incorrect information" }),
    );

    expect(onSubmit).toHaveBeenCalledWith(
      "title",
      "Supply Chain Manager",
      "He left this role",
    );
  });

  it("cancels without submitting", async () => {
    const { onSubmit, onClose } = renderDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the pending-review status after a successful submit", () => {
    renderDialog({ phase: "submitted", status: "pending" });
    expect(screen.getByText(/Correction filed — status: pending/)).toBeVisible();
    expect(screen.getByText(/stays hidden until a later sync/)).toBeVisible();
    expect(screen.queryByLabelText("Reason")).not.toBeInTheDocument();
  });

  it("surfaces a server rejection without hiding the form", () => {
    renderDialog({
      phase: "error",
      errorMessage: "The server rejected this correction (validation).",
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/rejected/);
    expect(screen.getByLabelText("Reason")).toBeVisible();
  });

  it("renders nothing when closed", () => {
    renderDialog({ open: false });
    expect(screen.queryByText("Report incorrect information")).not.toBeInTheDocument();
  });
});