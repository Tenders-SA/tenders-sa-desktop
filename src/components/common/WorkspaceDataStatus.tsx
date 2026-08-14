import { useConnectivity } from "../../hooks/use-connectivity";

export function WorkspaceDataStatus({
  stale = false,
  refreshing = false,
  refreshFailed = false,
  subject = "saved data",
}: {
  stale?: boolean;
  refreshing?: boolean;
  refreshFailed?: boolean;
  subject?: string;
}) {
  const connectivity = useConnectivity();
  if (!stale && !refreshing && !refreshFailed) return null;

  const message = refreshFailed
    ? `Update failed — showing ${subject}.`
    : connectivity === "offline"
      ? `Offline — showing ${subject}.`
      : refreshing
        ? `Checking for updates — showing ${subject}.`
        : `Showing ${subject}; an update may be available.`;

  return (
    <p
      role="status"
      aria-live="polite"
      className="text-xs text-muted-foreground"
    >
      {message}
    </p>
  );
}
