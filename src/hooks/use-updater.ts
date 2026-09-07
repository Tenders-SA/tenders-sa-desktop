import { useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/**
 * Signed auto-update polling (desktop-app-updater R-U7).
 *
 * Checks on mount and every `CHECK_INTERVAL_MS` while the app is open. The
 * check itself runs in the Rust updater plugin, so it is not subject to the
 * webview CSP or the `http:` capability allow-list -- nothing in the pinned
 * security boundary needed to move for the updater to exist.
 *
 * Every failure is caught and ignored on purpose (H5): offline, GitHub down
 * or a malformed manifest must never render as "no update available" and
 * must never interrupt the user. The app behaves exactly as it did before
 * this feature existed whenever the check cannot complete.
 */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type UpdateStatus = "idle" | "downloading" | "ready";

export function useUpdater() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [status, setStatus] = useState<UpdateStatus>("idle");

  useEffect(() => {
    let active = true;
    const run = () => {
      check()
        .then((found) => {
          if (active && found) setUpdate(found);
        })
        .catch(() => {
          // H5: silent. A failed check is not "no update".
        });
    };
    run();
    const timer = setInterval(run, CHECK_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  async function install() {
    if (!update || status !== "idle") return;
    setStatus("downloading");
    try {
      await update.downloadAndInstall();
      setStatus("ready");
      await relaunch();
    } catch {
      // A failed download/install/relaunch must leave the app running and
      // the banner actionable again, not a relaunched or crashed window.
      setStatus("idle");
    }
  }

  return {
    available: update !== null,
    version: update?.version,
    status,
    install,
  };
}
