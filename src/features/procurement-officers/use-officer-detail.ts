/**
 * Officer detail state (TASK-1.7, design.md §UI).
 *
 * Local-first: the unmasked official values from the sync feed's local
 * index are the display source; the server detail refresh (`GET
 * /api/v1/procurement-officers/[id]`) contributes organisation address,
 * evidence summary and tender rows, and is coalesced per officer.
 *
 * Honest degradation:
 * - Server contact values are MASKED; they are used only when the local
 *   index has nothing (never synced), and rendered with a "masked" marker.
 * - A failed refresh keeps the local record and lands in the `error` phase.
 * - The organisation profile link resolves only when the organisation is
 *   the user's own company (desktop `/company` screen); otherwise there is
 *   no affordance — a dead link would be a lie (REQ-16 honesty).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SqlExecutor } from "../../db/executor";
import {
  getOfficer,
  getOfficerNote,
  getOfficerTenders,
  isOfficerSaved,
  saveOfficer,
  setOfficerNote,
  unsaveOfficer,
} from "../../db/repositories/procurement-officers";
import type {
  OfficerAssignmentRow,
  OfficerContactPointRow,
  OfficerTenderLinkRow,
} from "../../db/schema/types";
import type {
  OfficerDetail,
  OfficerTenderRow,
  OfficerTendersResult,
  OfficerAssignment,
} from "../../services/api/endpoints/procurement-officers";

export interface OfficerDetailFeed {
  get(id: string, signal?: AbortSignal): Promise<OfficerDetail>;
  getTenders(
    id: string,
    query?: { page?: number; limit?: number },
    signal?: AbortSignal,
  ): Promise<OfficerTendersResult>;
}

export interface OfficerContactView {
  id: string;
  type: string;
  value: string;
  isRoleBased: boolean;
  isOfficial: boolean;
  verificationStatus: string;
  /** True when the value is the server's masked summary, not the local index. */
  masked: boolean;
}

export interface OfficerAssignmentView {
  id: string;
  organisationId: string | null;
  organisationName: string | null;
  title: string | null;
  validFrom: string | null;
  validTo: string | null;
  isCurrent: boolean;
  confidenceScore: number | null;
}

export interface OfficerTenderView {
  tenderId: string;
  title: string | null;
  referenceNumber: string | null;
  province: string | null;
  closingDate: string | null;
  sourceUrl: string | null;
}

export interface OfficerDetailData {
  id: string;
  canonicalName: string;
  firstName: string | null;
  lastName: string | null;
  currentTitle: string | null;
  province: string | null;
  kind: string;
  status: string;
  confidenceScore: number | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  verifiedAt: string | null;
  tendersCount: number;
  organisationId: string | null;
  organisationName: string | null;
  organisationAddress: string | null;
  assignments: OfficerAssignmentView[];
  /** The current assignment; never a stale one (parent `isCurrent` ordering). */
  headlineAssignment: OfficerAssignmentView | null;
  contactPoints: OfficerContactView[];
  tenders: OfficerTenderView[];
  evidenceSummary: {
    sourceMethods: string[];
    sourceFieldCount: number;
    observedRange: { earliest: string | null; latest: string | null };
  } | null;
}

export type OfficerDetailPhase =
  "loading-local" | "refreshing" | "idle" | "error";

export interface OfficerDetailView {
  data: OfficerDetailData | null;
  phase: OfficerDetailPhase;
  saved: boolean;
  note: string;
  organisationLink: string | null;
  toggleSaved: () => Promise<void>;
  saveNote: (note: string) => Promise<void>;
  copyValue: (value: string) => Promise<boolean>;
}

export function useOfficerDetail(
  feed: OfficerDetailFeed,
  executor: SqlExecutor,
  ownerId: string | undefined,
  officerId: string | null,
  ownCompanyId?: string,
): OfficerDetailView {
  const [data, setData] = useState<OfficerDetailData | null>(null);
  const [phase, setPhase] = useState<OfficerDetailPhase>("idle");
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState("");
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!ownerId || !officerId) {
      setData(null);
      setPhase("idle");
      setSaved(false);
      setNote("");
      return;
    }
    const runId = ++runIdRef.current;
    const controller = new AbortController();
    let active = true;

    const run = async () => {
      setPhase("loading-local");
      const [local, localTenders, isSaved, storedNote] = await Promise.all([
        getOfficer(executor, ownerId, officerId),
        getOfficerTenders(executor, ownerId, officerId),
        isOfficerSaved(executor, ownerId, officerId),
        getOfficerNote(executor, ownerId, officerId),
      ]);
      if (!active || runIdRef.current !== runId) return;
      if (local) setSaved(isSaved);
      if (local) setNote(storedNote ?? "");
      if (!local) {
        setData(null);
        setPhase("idle");
        return;
      }
      setData(
        mergeOfficerDetail(
          local.officer,
          local.contactPoints,
          local.assignments,
          localTenders,
          null,
          null,
        ),
      );

      try {
        setPhase("refreshing");
        const [server, serverTenders] = await Promise.all([
          feed.get(officerId, controller.signal),
          feed.getTenders(officerId, { page: 1, limit: 20 }, controller.signal),
        ]);
        if (!active || runIdRef.current !== runId) return;
        setData(
          mergeOfficerDetail(
            local.officer,
            local.contactPoints,
            local.assignments,
            localTenders,
            server,
            serverTenders.tenders,
          ),
        );
        setPhase("idle");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!active || runIdRef.current !== runId) return;
        setPhase("error");
      }
    };

    void run().catch(() => {
      if (active && runIdRef.current === runId) setPhase("error");
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [executor, feed, officerId, ownerId]);

  const toggleSaved = useCallback(async () => {
    if (!ownerId || !officerId) return;
    if (saved) {
      await unsaveOfficer(executor, ownerId, officerId);
      setSaved(false);
    } else {
      await saveOfficer(executor, ownerId, officerId);
      setSaved(true);
    }
  }, [executor, officerId, ownerId, saved]);

  const saveNote = useCallback(
    async (nextNote: string) => {
      if (!ownerId || !officerId) return;
      await setOfficerNote(executor, ownerId, officerId, nextNote);
      setNote(nextNote);
    },
    [executor, officerId, ownerId],
  );

  const copyValue = useCallback(async (value: string) => {
    if (!navigator.clipboard?.writeText) return false;
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }, []);

  const organisationLink =
    data && ownCompanyId && data.organisationId === ownCompanyId
      ? "/company"
      : null;

  return {
    data,
    phase,
    saved,
    note,
    organisationLink,
    toggleSaved,
    saveNote,
    copyValue,
  };
}

/**
 * Local rows are snake_case; the server detail payload is camelCase.
 * Branching on the shape keeps the merge honest about which source won.
 */
function toAssignmentView(
  a: OfficerAssignmentRow | OfficerAssignment,
): OfficerAssignmentView {
  if ("isCurrent" in a) {
    return {
      id: a.id,
      organisationId: a.organisationId,
      organisationName: a.organisationName,
      title: a.title,
      validFrom: a.validFrom,
      validTo: a.validTo,
      isCurrent: a.isCurrent,
      confidenceScore: a.confidenceScore,
    };
  }
  return {
    id: a.id,
    organisationId: a.organisation_id,
    organisationName: a.organisation_name,
    title: a.title,
    validFrom: a.valid_from,
    validTo: a.valid_to,
    isCurrent: a.is_current === 1,
    confidenceScore: a.confidence_score,
  };
}

/**
 * Local values are unmasked and authoritative for contacts and assignments;
 * the server refresh contributes organisation address, evidence summary and
 * rich tender rows. Server rows never overwrite unmasked local values.
 */
export function mergeOfficerDetail(
  officer: {
    id: string;
    canonical_name: string;
    first_name: string | null;
    last_name: string | null;
    current_title: string | null;
    current_organisation_id: string | null;
    province: string | null;
    kind: string;
    status: string;
    confidence_score: number | null;
    first_seen_at: string | null;
    last_seen_at: string | null;
    verified_at: string | null;
  },
  localContacts: OfficerContactPointRow[],
  localAssignments: OfficerAssignmentRow[],
  localTenders: OfficerTenderLinkRow[],
  server: OfficerDetail | null,
  serverTenders: OfficerTenderRow[] | null,
): OfficerDetailData {
  const assignments = orderAssignments(
    (localAssignments.length > 0
      ? localAssignments
      : (server?.assignments ?? [])
    ).map(toAssignmentView),
  );

  const contacts: OfficerContactView[] =
    localContacts.length > 0
      ? localContacts.map((c) => ({
          id: c.id,
          type: c.type,
          value: c.value,
          isRoleBased: c.is_role_based === 1,
          isOfficial: c.is_official === 1,
          verificationStatus: c.verification_status,
          masked: false,
        }))
      : (server?.contactPoints ?? []).map((c) => ({
          id: c.id,
          type: c.type,
          value: c.value,
          isRoleBased: c.isRoleBased,
          isOfficial: c.isOfficial,
          verificationStatus: c.verificationStatus,
          masked: true,
        }));

  const tenders: OfficerTenderView[] =
    serverTenders && serverTenders.length > 0
      ? serverTenders.map((t) => ({
          tenderId: t.tenderId,
          title: t.title,
          referenceNumber: t.referenceNumber,
          province: t.province,
          closingDate: t.closingDate,
          sourceUrl: t.sourceUrl,
        }))
      : localTenders.map((t) => ({
          tenderId: t.tender_id,
          title: null,
          referenceNumber: null,
          province: null,
          closingDate: null,
          sourceUrl: null,
        }));

  const headlineAssignment = assignments[0] ?? null;

  return {
    id: officer.id,
    canonicalName: officer.canonical_name,
    firstName: officer.first_name,
    lastName: officer.last_name,
    currentTitle: server?.currentTitle ?? officer.current_title,
    province: server?.province ?? officer.province,
    kind: officer.kind,
    status: server?.status ?? officer.status,
    confidenceScore: server?.confidenceScore ?? officer.confidence_score,
    firstSeenAt: server?.firstSeenAt ?? officer.first_seen_at,
    lastSeenAt: server?.lastSeenAt ?? officer.last_seen_at,
    verifiedAt: server?.verifiedAt ?? officer.verified_at,
    tendersCount: server?.tendersCount ?? 0,
    organisationId:
      server?.currentOrganisationId ?? officer.current_organisation_id,
    organisationName:
      server?.organisationName ?? headlineAssignment?.organisationName ?? null,
    organisationAddress: server?.organisationAddress ?? null,
    assignments,
    headlineAssignment,
    contactPoints: contacts,
    tenders,
    evidenceSummary: server?.evidenceSummary ?? null,
  };
}

/**
 * Headline assignment must never be stale: current wins, then most recent
 * `validFrom`, regardless of what the server returned in any other order.
 */
export function orderAssignments(
  assignments: OfficerAssignmentView[],
): OfficerAssignmentView[] {
  return [...assignments].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    const aFrom = a.validFrom
      ? Date.parse(a.validFrom)
      : Number.NEGATIVE_INFINITY;
    const bFrom = b.validFrom
      ? Date.parse(b.validFrom)
      : Number.NEGATIVE_INFINITY;
    if (aFrom !== bFrom) return bFrom - aFrom;
    return a.id.localeCompare(b.id);
  });
}
