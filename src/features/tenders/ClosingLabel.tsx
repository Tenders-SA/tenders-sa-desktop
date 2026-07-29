import { daysUntilClosing } from "../../services/api/endpoints/tenders";

/**
 * Deadline urgency, as text — never colour alone (A11Y-1).
 *
 * Shared by the list and the detail screen so a tender cannot appear to
 * close on two different schedules depending on where you look at it.
 */
export function ClosingLabel({ closingDate }: { closingDate: string }) {
  const days = daysUntilClosing(closingDate);

  if (days === null) {
    // An unparseable date must not render as a number a user might act on.
    return <span className="text-muted-foreground">Closing date unknown</span>;
  }
  if (days < 0) {
    return <span className="text-muted-foreground">Closed</span>;
  }
  if (days === 0) {
    return <span className="font-medium text-destructive">Closes today</span>;
  }
  if (days <= 7) {
    return (
      <span className="font-medium text-warning">
        Closes in {days} {days === 1 ? "day" : "days"}
      </span>
    );
  }
  return <span className="text-muted-foreground">Closes in {days} days</span>;
}
