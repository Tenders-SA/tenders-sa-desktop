/**
 * Formatting for the activity feed and notification timestamps.
 *
 * Kept out of the component file so both the feed and the notifications
 * screen can import it without either pulling in the other's rendering.
 */

/** The parent's own activity `type` values, as words. */
export function describeActivityType(type: string): string {
  switch (type) {
    case "application":
      return "Application";
    case "match":
      return "Tender match";
    case "notification":
      return "Notification";
    default: {
      const words = type.replace(/_/g, " ").toLowerCase().trim();
      return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Update";
    }
  }
}

/**
 * A relative time, or a stated absence.
 *
 * Never returns "Invalid Date": an entry with a bad timestamp should still be
 * readable, because the entry itself is the information. A future timestamp
 * falls back to the date rather than rendering "in -3 minutes".
 */
export function formatTimestamp(
  timestamp: string,
  now: Date = new Date(),
): string {
  const when = new Date(timestamp);
  if (Number.isNaN(when.getTime())) return "Date unknown";

  const seconds = Math.round((now.getTime() - when.getTime()) / 1000);
  if (seconds < 0) return when.toLocaleDateString("en-ZA");
  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;

  return when.toLocaleDateString("en-ZA");
}
