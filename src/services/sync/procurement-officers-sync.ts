/**
 * Procurement Officer Directory sync runner (TASK-1.4).
 *
 * Consumes the parent's cursor-paginated export feed
 * (`GET /api/v1/procurement-officers/sync?cursor=&limit=200`) and rebuilds
 * the local FTS index one officer at a time. The parent audits every feed
 * page; this runner deliberately writes no local audit rows.
 *
 * Terminal states are distinct (REQ-15/REQ-16):
 * - 404 → `featureState: "off"`            (parent beta flag off)
 * - 403 → `featureState: "entitlement-missing"` (no apiAccess entitlement;
 *          local index stays read-only at its last good state)
 * Transient ApiErrors (offline/timeout/server) surface as `error` while
 * `featureState` stays `"active"` — pages already applied keep their
 * persisted cursor, so the next run resumes.
 */

import type { SqlExecutor } from "../../db/executor";
import {
  applyTombstone,
  getSyncState,
  setSyncState,
  upsertOfficer,
  type OfficerIngest,
} from "../../db/repositories/procurement-officers";
import { ApiError } from "../api/errors";
import type {
  OfficerSyncQuery,
  OfficerSyncResult,
  OfficerSyncRow,
} from "../api/endpoints/procurement-officers";

export type OfficerFeatureState =
  | "active"
  | "off"
  | "entitlement-missing";

export interface OfficerSyncOutcome {
  featureState: OfficerFeatureState;
  appliedRows: number;
  tombstones: number;
  pages: number;
  /** Set only for transient failures; `featureState` stays `"active"`. */
  error?: ApiError;
}

/** Feed port — `ProcurementOfficersEndpoint` satisfies this structurally. */
export interface OfficerSyncFeed {
  sync(query: OfficerSyncQuery, signal?: AbortSignal): Promise<OfficerSyncResult>;
}

const SYNC_PAGE_LIMIT = 200;

export interface OfficerSyncRunnerDeps {
  feed: OfficerSyncFeed;
  executor: SqlExecutor;
  ownerId: string;
  now?: () => string;
}

export class OfficerSyncRunner {
  private readonly feed: OfficerSyncFeed;
  private readonly executor: SqlExecutor;
  private readonly ownerId: string;
  private readonly now: () => string;
  private inFlight: Promise<OfficerSyncOutcome> | null = null;

  constructor(deps: OfficerSyncRunnerDeps) {
    this.feed = deps.feed;
    this.executor = deps.executor;
    this.ownerId = deps.ownerId;
    this.now = deps.now ?? (() => new Date().toISOString());
  }

  /**
   * Runs the cursor loop. Concurrent calls share one in-flight run
   * (no overlapping syncs, design.md §Performance).
   */
  sync(): Promise<OfficerSyncOutcome> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.run().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async run(): Promise<OfficerSyncOutcome> {
    const state = await getSyncState(this.executor, this.ownerId);
    let cursor = state?.cursor ?? undefined;
    let appliedRows = 0;
    let tombstones = 0;
    let pages = 0;

    try {
      for (;;) {
        const page = await this.feed.sync({
          cursor,
          limit: SYNC_PAGE_LIMIT,
        });
        pages += 1;

        for (const row of page.rows) {
          if (row.suppressed) {
            await applyTombstone(this.executor, this.ownerId, row.id);
            tombstones += 1;
          } else {
            await upsertOfficer(this.executor, this.ownerId, toOfficerIngest(row));
            appliedRows += 1;
          }
        }

        await setSyncState(this.executor, this.ownerId, page.nextCursor, this.now());
        cursor = page.nextCursor ?? undefined;

        if (!page.hasMore) {
          return { featureState: "active", appliedRows, tombstones, pages };
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.kind === "not-found") {
          // Beta flag off: never persist anything; last good index stays.
          return { featureState: "off", appliedRows, tombstones, pages };
        }
        if (err.kind === "forbidden") {
          // Entitlement revoked mid-run: pages already applied keep their
          // persisted cursor; index is read-only from here.
          return {
            featureState: "entitlement-missing",
            appliedRows,
            tombstones,
            pages,
          };
        }
        return { featureState: "active", appliedRows, tombstones, pages, error: err };
      }
      throw err;
    }
  }
}

/** Feed rows map 1:1 onto the repository ingest; the feed carries no tender links. */
export function toOfficerIngest(row: OfficerSyncRow): OfficerIngest {
  return {
    id: row.id,
    canonicalName: row.canonicalName,
    firstName: row.firstName,
    lastName: row.lastName,
    currentTitle: row.currentTitle,
    currentOrganisationId: row.currentOrganisationId,
    province: row.province,
    kind: row.kind,
    status: row.status,
    confidenceScore: row.confidenceScore,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    verifiedAt: row.verifiedAt,
    suppressed: false,
    updatedAt: row.updatedAt,
    contactPoints: row.contactPoints.map((point) => ({
      id: point.id,
      type: point.type,
      value: point.value,
      isRoleBased: point.isRoleBased,
      isOfficial: point.isOfficial,
      verificationStatus: point.verificationStatus,
    })),
    assignments: row.assignments.map((assignment) => ({
      id: assignment.id,
      organisationId: assignment.organisationId,
      organisationName: assignment.organisationName,
      title: assignment.title,
      validFrom: assignment.validFrom,
      validTo: assignment.validTo,
      isCurrent: assignment.isCurrent,
      confidenceScore: assignment.confidenceScore,
    })),
    tenderLinks: [],
  };
}