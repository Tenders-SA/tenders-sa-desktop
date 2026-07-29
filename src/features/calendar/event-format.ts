/**
 * Calendar date formatting, separate from the screen so it stays testable
 * without rendering.
 */

/**
 * A readable date, or a stated absence.
 *
 * Never "Invalid Date": an event with an unusable date should still be
 * visible, because the event itself is the information.
 */
export function formatEventDate(eventDate: string): string {
  const when = new Date(eventDate);
  if (Number.isNaN(when.getTime())) return "Date unknown";
  return when.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
