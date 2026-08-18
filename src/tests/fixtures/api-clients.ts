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
      getActionItems: idle(),
    },
    pulse: { getPulse: idle() },
    recommendations: {
      list: idle(),
      explain: idle(),
      newCount: idle(),
      refresh: idle(),
      scanScenario: idle(),
    },
    savedTenders: { list: idle(), listAllIds: idle(), toggleSave: idle() },
    applications: {
      list: idle(),
      get: idle(),
      validate: idle(),
      statusForTender: idle(),
      create: idle(),
      getCockpit: idle(),
      getComplianceGaps: idle(),
      getResearch: idle(),
      getWorkspaceStage: idle(),
      updateWorkspace: idle(),
      getAdditionalInfo: idle(),
      saveAdditionalInfo: idle(),
      getResponseBlueprint: idle(),
      generateResponseDocument: idle(),
      saveResponseDocument: idle(),
      enrichBlueprint: idle(),
      exportWorkspacePackage: idle(),
    },
    company: {
      getProfile: idle(),
      getExtendedProfile: idle(),
      getExtendedRecord: idle(),
      updateProfile: idle(),
      saveExtendedProfile: idle(),
      setCidbGrading: idle(),
      getExperiences: idle(),
      createExperience: idle(),
      updateExperience: idle(),
      deleteExperience: idle(),
      getPersonnel: idle(),
      createPersonnel: idle(),
      updatePersonnel: idle(),
      deletePersonnel: idle(),
    },
    documents: {
      list: idle(),
      getStats: idle(),
      getDownloadUrl: idle(),
      downloadTenderDocument: idle(),
    },
    eligibility: { check: idle() },
    notifications: {
      list: idle(),
      unreadCount: idle(),
      markRead: idle(),
      markAllRead: idle(),
    },
    planner: { listEvents: idle(), listSuggested: idle() },
    preferences: { get: idle(), update: idle() },
    supplierIntelligence: { search: idle() },
    supplierProfile: {
      resolveSupplier: idle(),
      getForensicRow: idle(),
      getPublicRecord: idle(),
      getEntityContext: idle(),
      getReportAccess: idle(),
      getContacts: idle(),
      getShowcaseEntry: idle(),
      searchForensicSuppliers: idle(),
    },
    procurementOfficers: {
      search: idle(),
      get: idle(),
      getTenders: idle(),
      sync: idle(),
      submitCorrection: idle(),
    },
  } as unknown as ApiClients;

  return { ...clients, ...overrides };
}
