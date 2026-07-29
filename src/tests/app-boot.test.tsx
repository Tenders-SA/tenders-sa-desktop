/**
 * Start-up smoke test.
 *
 * THE regression this exists for: `App.tsx` calls `loadConfig` at **module
 * scope**, before React mounts. When required config fields had no defaults
 * that call threw, and the packaged application opened a completely empty
 * window — no message, no error, nothing. Every installer was affected,
 * because `.env` is gitignored and so no packaged build has one.
 *
 * Rendering `<App />` with no `VITE_*` values is therefore the single most
 * valuable assertion in the suite: it is the difference between an application
 * that starts and one that does not.
 *
 * The Tauri bridges are mocked because this runs in jsdom, not in a Tauri
 * runtime — without them the keychain and SQL plugins throw on import.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: { load: vi.fn(async () => ({ execute: vi.fn(), select: vi.fn() })) },
}));

describe("application start-up", () => {
  it("mounts and shows the shell with no VITE_ configuration", async () => {
    const App = (await import("../App")).default;
    render(<App />);
    // Anything but a blank window. Either the shell or the login form is a
    // pass; the config-failure screen is not.
    const body = document.body.textContent ?? "";
    expect(body.trim().length).toBeGreaterThan(0);
    expect(body).not.toContain("could not start");
    // A heading proves real UI mounted rather than an empty container.
    expect(screen.getByRole("heading")).toBeVisible();
  });
});
