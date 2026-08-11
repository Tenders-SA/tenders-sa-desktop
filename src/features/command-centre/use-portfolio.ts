/**
 * The Command Centre's one read of the user's own portfolio (R-V10).
 *
 * Before Slice 8 `DeadlinePanel` owned this fetch and rendered three numbers
 * from it, discarding every status, closing date and estimated value it had
 * just been given. Three of the six visuals on this screen are drawn from
 * exactly that discarded data, so the fetch is hoisted here and shared
 * rather than repeated: the charts cost no extra request.
 *
 * `/api/v1/dashboard/summary` is deliberately not used — the live
 * deployment answers `{}` for it (see `dashboard.ts`'s header and
 * `dashboard-live-data.md`). This is the same pair of routes the web
 * dashboard feeds from.
 */

import { useAsync, type AsyncState } from "../../hooks/use-async";
import type {
  Application,
  ApplicationsEndpoint,
} from "../../services/api/endpoints/applications";
import type {
  DocumentsEndpoint,
  DocumentStats,
} from "../../services/api/endpoints/documents";

export interface Portfolio {
  applications: Application[];
  stats: DocumentStats | undefined;
}

export type PortfolioState = AsyncState<Portfolio> & { reload: () => void };

export function usePortfolio(
  applications: ApplicationsEndpoint,
  documents: DocumentsEndpoint,
): PortfolioState {
  return useAsync(
    async (signal) => {
      const [list, stats] = await Promise.all([
        applications.list({ limit: 50 }, signal),
        documents.getStats(signal),
      ]);
      return { applications: list.applications, stats };
    },
    [applications, documents],
  );
}

/** The statuses the parent counts as an active application. */
const ACTIVE_STATUSES = new Set(["DRAFT", "SUBMITTED", "UNDER_REVIEW"]);

/** Non-archived applications in an active status. */
export function activeApplications(applications: Application[]): Application[] {
  return applications.filter(
    (application) =>
      !application.isArchived && ACTIVE_STATUSES.has(application.status),
  );
}
