/**
 * Updater hook and banner tests (desktop-app-updater T4/T5).
 *
 * The Tauri plugin modules are mocked because these run in jsdom, not a
 * Tauri runtime. The assertions that matter are the contract surface:
 * a found update surfaces with its version, a null and a rejected check
 * both render "nothing" (a failed check must never read as "no update"),
 * the interval re-checks, and an install that fails anywhere leaves the
 * app running with the banner actionable again.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  downloadAndInstall: vi.fn(),
  relaunch: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: mocks.check,
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: mocks.relaunch,
}));

import { useUpdater } from "../hooks/use-updater";
import { UpdateBanner } from "../features/updates/UpdateBanner";
import type { Update } from "@tauri-apps/plugin-updater";

function fakeUpdate(version = "0.1.1") {
  return {
    version,
    downloadAndInstall: mocks.downloadAndInstall,
  } as unknown as Update;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("useUpdater", () => {
  it("surfaces an update with its version when check finds one", async () => {
    mocks.check.mockResolvedValueOnce(fakeUpdate("0.1.1"));
    const { result } = renderHook(() => useUpdater());
    await act(async () => {});
    expect(result.current.available).toBe(true);
    expect(result.current.version).toBe("0.1.1");
  });

  it("renders nothing when check reports no update", async () => {
    mocks.check.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useUpdater());
    await act(async () => {});
    expect(result.current.available).toBe(false);
  });

  it("swallows a failed check without surfacing an update (H5)", async () => {
    mocks.check.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useUpdater());
    await act(async () => {});
    expect(result.current.available).toBe(false);
  });

  it("re-checks on the 6-hour interval and can surface a later release", async () => {
    vi.useFakeTimers();
    mocks.check.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useUpdater());
    await act(async () => {});
    expect(mocks.check).toHaveBeenCalledTimes(1);

    mocks.check.mockResolvedValueOnce(fakeUpdate("0.1.2"));
    await act(async () => {
      vi.advanceTimersByTime(6 * 60 * 60 * 1000);
    });
    await act(async () => {});
    expect(mocks.check).toHaveBeenCalledTimes(2);
    expect(result.current.available).toBe(true);
    expect(result.current.version).toBe("0.1.2");
  });

  it("installs: downloads, installs, then relaunches (DEC-4)", async () => {
    mocks.check.mockResolvedValueOnce(fakeUpdate());
    mocks.downloadAndInstall.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useUpdater());
    await act(async () => {});

    await act(async () => {
      await result.current.install();
    });
    expect(mocks.downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(mocks.relaunch).toHaveBeenCalledTimes(1);
  });

  it("a failed install returns to idle without relaunching", async () => {
    mocks.check.mockResolvedValueOnce(fakeUpdate());
    mocks.downloadAndInstall.mockRejectedValueOnce(new Error("bad signature"));
    const { result } = renderHook(() => useUpdater());
    await act(async () => {});

    await act(async () => {
      await result.current.install();
    });
    expect(mocks.relaunch).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
    expect(result.current.available).toBe(true);
  });

  it("ignores install() when no update is available", async () => {
    mocks.check.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useUpdater());
    await act(async () => {});

    await act(async () => {
      await result.current.install();
    });
    expect(mocks.downloadAndInstall).not.toHaveBeenCalled();
    expect(mocks.relaunch).not.toHaveBeenCalled();
  });
});

describe("UpdateBanner", () => {
  it("renders nothing when no update is available", async () => {
    mocks.check.mockResolvedValueOnce(null);
    render(<UpdateBanner />);
    await act(async () => {});
    expect(screen.queryByText(/update .* is available/i)).toBeNull();
  });

  it("shows the version and an actionable button when an update exists", async () => {
    mocks.check.mockResolvedValueOnce(fakeUpdate("0.1.1"));
    render(<UpdateBanner />);
    await act(async () => {});
    expect(
      screen.getByText(/update 0\.1\.1 is available/i),
    ).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /update & restart/i });
    expect(button).not.toBeDisabled();
  });

  it("disables the button and relabels while downloading", async () => {
    mocks.check.mockResolvedValueOnce(fakeUpdate());
    mocks.downloadAndInstall.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 50)),
    );
    mocks.relaunch.mockResolvedValueOnce(undefined);
    render(<UpdateBanner />);
    await act(async () => {});

    act(() => {
      void screen.getByRole("button", { name: /update & restart/i }).click();
    });
    expect(screen.getByRole("button", { name: /downloading/i })).toBeDisabled();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 75));
    });
    expect(screen.getByRole("button", { name: /restarting/i })).toBeDisabled();
  });

  it("a failed install leaves the banner actionable (H5)", async () => {
    mocks.check.mockResolvedValueOnce(fakeUpdate());
    mocks.downloadAndInstall.mockRejectedValueOnce(
      new Error("verification failed"),
    );
    render(<UpdateBanner />);
    await act(async () => {});

    act(() => {
      void screen.getByRole("button", { name: /update & restart/i }).click();
    });
    await act(async () => {});

    expect(mocks.relaunch).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /update & restart/i }),
    ).not.toBeDisabled();
  });
});
