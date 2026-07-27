import { useEffect, useState } from "react";

export type ConnectivityState = "online" | "offline";

/**
 * Tracks browser/webview connectivity. Lives apart from the component
 * that consumes it so each module exports one kind of thing, which is
 * what React Fast Refresh needs to work reliably.
 */
export function useConnectivity(): ConnectivityState {
  const [state, setState] = useState<ConnectivityState>(() =>
    navigator.onLine ? "online" : "offline",
  );

  useEffect(() => {
    const goOnline = () => setState("online");
    const goOffline = () => setState("offline");
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return state;
}
