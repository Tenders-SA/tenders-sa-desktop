import { useUpdater } from "../../hooks/use-updater";

/**
 * Non-intrusive update banner (desktop-app-updater R-U8).
 *
 * Renders only when the updater plugin found a newer release. Nothing is
 * downloaded until the user clicks "Update & Restart" (DEC-4); a failed
 * check or a failed install simply leaves the banner in its previous
 * state and never interrupts the user (H5).
 *
 * Mounted in the composition root (src/App.tsx) outside the router so it
 * works with or without a session: an update is not gated on sign-in.
 */
export function UpdateBanner() {
  const { available, version, status, install } = useUpdater();
  if (!available) return null;

  return (
    <aside
      role="status"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg"
    >
      <span>Update {version} is available.</span>
      <button
        type="button"
        onClick={() => void install()}
        disabled={status !== "idle"}
        className="rounded-md bg-primary-foreground px-3 py-1.5 text-xs font-semibold text-primary outline-none hover:bg-primary-foreground/90 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "idle"
          ? "Update & Restart"
          : status === "downloading"
            ? "Downloading…"
            : "Restarting…"}
      </button>
    </aside>
  );
}
