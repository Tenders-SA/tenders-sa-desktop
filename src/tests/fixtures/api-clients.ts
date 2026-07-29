/**
 * Stub endpoint clients for router and shell tests.
 *
 * `AppRoutes` needs every client because every advertised route must mount in
 * every build (REQ-16). Tests that care about routing, not data, use these:
 * each method returns a promise that never settles, so screens stay in their
 * loading state and no test asserts against invented data.
 *
 * A never-settling promise rather than a rejection is deliberate. A rejection
 * would make each screen render its error state, and a routing test asserting
 * "this screen mounted" would then be asserting on an error message — passing
 * for the wrong reason if the route were later removed.
 */

import { vi } from "vitest";
import type { ApiClients } from "../../app/auth-wiring";

/** A method that never resolves, so the caller stays loading. */
export function idle() {
  return vi.fn(() => new Promise<never>(() => {}));
}

export function stubApiClients(
  overrides: Partial<ApiClients> = {},
): ApiClients {
  const clients = {
    subscription: { getStatus: idle(), getFeatureAccess: idle() },
    tenders: { list: idle(), get: idle() },
    dashboard: {
      getSummary: idle(),
      getActivity: idle(),
      getActionItems: idle(),
    },
    recommendations: {
      list: idle(),
      explain: idle(),
      newCount: idle(),
      refresh: idle(),
    },
    savedTenders: { list: idle(), toggleSave: idle() },
    applications: {
      list: idle(),
      get: idle(),
      validate: idle(),
      statusForTender: idle(),
      create: idle(),
    },
    company: {
      getProfile: idle(),
      getExperiences: idle(),
      getPersonnel: idle(),
      getCidb: idle(),
    },
    documents: { list: idle(), getStats: idle(), getDownloadUrl: idle() },
    eligibility: { check: idle() },
    notifications: {
      list: idle(),
      unreadCount: idle(),
      markRead: idle(),
      markAllRead: idle(),
    },
    planner: { listEvents: idle(), listSuggested: idle() },
  } as unknown as ApiClients;

  return { ...clients, ...overrides };
}
