/**
 * Document ordering, separate from the screen so it stays testable without
 * rendering.
 */

import type { CompanyDocument } from "../../services/api/endpoints/documents";

/**
 * Expired first, then expiring, then the rest; within a band, soonest first.
 *
 * The parent orders by document type then upload date, which buries an
 * expired certificate in the middle of the list. Expiry is what blocks a bid,
 * so it leads.
 */
export function sortByUrgency(documents: CompanyDocument[]): CompanyDocument[] {
  const rank = (document: CompanyDocument): number => {
    switch (document.expiryStatus) {
      case "expired":
        return 0;
      case "expiring":
        return 1;
      default:
        return 2;
    }
  };
  // A copy: mutating the array from the endpoint would surprise a caller that
  // still holds it.
  return [...documents].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return (a.daysUntilExpiry ?? Infinity) - (b.daysUntilExpiry ?? Infinity);
  });
}
