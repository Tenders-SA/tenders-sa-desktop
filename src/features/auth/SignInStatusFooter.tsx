/**
 * Build and reachability, under the sign-in form (R-V5).
 *
 * A desktop application can fail to sign a user in for a reason that has
 * nothing to do with their password, and unlike a website it cannot rely on
 * the browser to say so. Showing connectivity *before* the attempt means a
 * user on a dropped connection stops typing instead of spending attempts
 * against an IP-keyed rate limit they cannot see.
 *
 * Deliberately **not** `role="status"`: nothing has failed, and the gated
 * build already owns the one live region on this screen ("sign-in is not yet
 * available in this build"). A second one would announce itself over the
 * first.
 */

import { useConnectivity } from "../../hooks/use-connectivity";
import { API_BASE_URL } from "../../app/config/load-config";

/** Hostname only. A full URL here would be noise, and a path would be wrong. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function SignInStatusFooter({
  apiBaseUrl = API_BASE_URL,
  version = __APP_VERSION__,
}: {
  apiBaseUrl?: string;
  version?: string;
}) {
  const connectivity = useConnectivity();
  const online = connectivity === "online";

  return (
    <div className="mt-6 flex flex-col gap-1 text-xs text-muted-foreground">
      <p>
        v{version} · {hostOf(apiBaseUrl)}
      </p>
      <p className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            online ? "bg-success" : "bg-muted-foreground"
          }`}
        />
        {/* The word carries the state, not the dot: colour is never the sole
            means of conveying information (WCAG 1.4.1). */}
        {online
          ? "Connected"
          : "Offline — sign-in needs a connection to Tenders-SA."}
      </p>
    </div>
  );
}
