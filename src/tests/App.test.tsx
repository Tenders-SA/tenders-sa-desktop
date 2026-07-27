import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../App";

describe("App", () => {
  it("renders the Phase 0 placeholder shell", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Tenders-SA Desktop" }),
    ).toBeInTheDocument();
  });
});
