/**
 * Procurement Officer Directory local repository (TASK-1.3).
 *
 * Owner-scoped functions over `SqlExecutor`, mirroring
 * `cache-entries.ts`/`sync-operations.ts`: parameterized statements only,
 * the parent feed is the only write source.
 *
 * There is no transaction primitive on `SqlExecutor` (each statement is a
 * plugin-sql call), so ingest is **delete-then-insert per officer**: a
 * partially failed sync self-heals on the next run because the officer's
 * rows are rebuilt wholesale, never patched in place.
 */

import type { SqlExecutor } from "../executor";
import type {
  OfficerAssignmentRow,
  OfficerContactPointRow,
  OfficerSyncStateRow,
  OfficerTenderLinkRow,
  ProcurementOfficerRow,
} from "../schema/types";

export interface OfficerContactPointIngest {
  id: string;
  type: string;
  value: string;
  isRoleBased: boolean;
  isOfficial: boolean;
  verificationStatus: string;
}

export interface OfficerAssignmentIngest {
  id: string;
  organisationId: string | null;
  organisationName: string | null;
  title: string | null;
  validFrom: string | null;
  validTo: string | null;
  isCurrent: boolean;
  confidenceScore: number | null;
}

export interface OfficerTenderLinkIngest {
  tenderId: string;
  sourceField: string | null;
  observedAt: string | null;
}

export interface OfficerIngest {
  id: string;
  canonicalName: string;
  firstName: string | null;
  lastName: string | null;
  currentTitle: string | null;
  currentOrganisationId: string | null;
  province: string | null;
  kind: string;
  status: string;
  confidenceScore: number | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  verifiedAt: string | null;
  suppressed: boolean;
  updatedAt: string;
  contactPoints: OfficerContactPointIngest[];
  assignments: OfficerAssignmentIngest[];
  /** Populated when the feed starts carrying tender references; empty today. */
  tenderLinks?: OfficerTenderLinkIngest[];
}

export interface OfficerSearchQuery {
  q?: string;
  province?: string;
  kind?: string;
  status?: string;
  limit?: number;
}

/**
 * Rebuilds one officer's full local footprint from the feed row.
 * Delete-then-insert keeps the ingest idempotent and self-healing.
 */
export async function upsertOfficer(
  executor: SqlExecutor,
  ownerId: string,
  officer: OfficerIngest,
): Promise<void> {
  await executor.execute(
    "DELETE FROM procurement_officers_fts WHERE owner_id = $1 AND officer_id = $2",
    [ownerId, officer.id],
  );
  await executor.execute(
    `INSERT INTO procurement_officers
       (owner_id, id, canonical_name, first_name, last_name, current_title,
        current_organisation_id, province, kind, status, confidence_score,
        first_seen_at, last_seen_at, verified_at, suppressed, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     ON CONFLICT(owner_id, id) DO UPDATE SET
       canonical_name = excluded.canonical_name,
       first_name = excluded.first_name,
       last_name = excluded.last_name,
       current_title = excluded.current_title,
       current_organisation_id = excluded.current_organisation_id,
       province = excluded.province,
       kind = excluded.kind,
       status = excluded.status,
       confidence_score = excluded.confidence_score,
       first_seen_at = excluded.first_seen_at,
       last_seen_at = excluded.last_seen_at,
       verified_at = excluded.verified_at,
       suppressed = excluded.suppressed,
       updated_at = excluded.updated_at`,
    [
      ownerId,
      officer.id,
      officer.canonicalName,
      officer.firstName,
      officer.lastName,
      officer.currentTitle,
      officer.currentOrganisationId,
      officer.province,
      officer.kind,
      officer.status,
      officer.confidenceScore,
      officer.firstSeenAt,
      officer.lastSeenAt,
      officer.verifiedAt,
      officer.suppressed ? 1 : 0,
      officer.updatedAt,
    ],
  );

  await executor.execute(
    "DELETE FROM officer_contact_points WHERE owner_id = $1 AND officer_id = $2",
    [ownerId, officer.id],
  );
  for (const point of officer.contactPoints) {
    await executor.execute(
      `INSERT INTO officer_contact_points
         (owner_id, officer_id, id, type, value, is_role_based, is_official, verification_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        ownerId,
        officer.id,
        point.id,
        point.type,
        point.value,
        point.isRoleBased ? 1 : 0,
        point.isOfficial ? 1 : 0,
        point.verificationStatus,
      ],
    );
  }

  await executor.execute(
    "DELETE FROM officer_assignments WHERE owner_id = $1 AND officer_id = $2",
    [ownerId, officer.id],
  );
  for (const assignment of officer.assignments) {
    await executor.execute(
      `INSERT INTO officer_assignments
         (owner_id, officer_id, id, organisation_id, organisation_name, title,
          valid_from, valid_to, is_current, confidence_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        ownerId,
        officer.id,
        assignment.id,
        assignment.organisationId,
        assignment.organisationName,
        assignment.title,
        assignment.validFrom,
        assignment.validTo,
        assignment.isCurrent ? 1 : 0,
        assignment.confidenceScore,
      ],
    );
  }

  await executor.execute(
    "DELETE FROM officer_tender_links WHERE owner_id = $1 AND officer_id = $2",
    [ownerId, officer.id],
  );
  for (const link of officer.tenderLinks ?? []) {
    await executor.execute(
      `INSERT INTO officer_tender_links
         (owner_id, officer_id, tender_id, source_field, observed_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [ownerId, officer.id, link.tenderId, link.sourceField, link.observedAt],
    );
  }

  await executor.execute(
    `INSERT INTO procurement_officers_fts (owner_id, officer_id, search_text)
     VALUES ($1, $2, $3)`,
    [ownerId, officer.id, buildSearchText(officer)],
  );
}

/**
 * POPIA boundary (design.md §7): a suppressed officer is removed from the
 * local index entirely — disputed facts never persist locally.
 */
export async function applyTombstone(
  executor: SqlExecutor,
  ownerId: string,
  officerId: string,
): Promise<void> {
  await executor.execute(
    "DELETE FROM procurement_officers_fts WHERE owner_id = $1 AND officer_id = $2",
    [ownerId, officerId],
  );
  await executor.execute(
    "DELETE FROM procurement_officers WHERE owner_id = $1 AND id = $2",
    [ownerId, officerId],
  );
  await executor.execute(
    "DELETE FROM officer_contact_points WHERE owner_id = $1 AND officer_id = $2",
    [ownerId, officerId],
  );
  await executor.execute(
    "DELETE FROM officer_assignments WHERE owner_id = $1 AND officer_id = $2",
    [ownerId, officerId],
  );
  await executor.execute(
    "DELETE FROM officer_tender_links WHERE owner_id = $1 AND officer_id = $2",
    [ownerId, officerId],
  );
}

/**
 * Local-first search: FTS5 MATCH over the denormalised `search_text`,
 * plus equality filters. An empty `q` degrades to a plain owner-scoped
 * listing (MATCH '' is an error).
 */
export async function searchOfficers(
  executor: SqlExecutor,
  ownerId: string,
  query: OfficerSearchQuery = {},
): Promise<ProcurementOfficerRow[]> {
  const limit = Math.min(50, Math.max(1, query.limit ?? 20));
  const q = query.q?.trim();
  const match = q ? toFtsMatchQuery(q) : null;

  if (!match) {
    const filters: string[] = ["owner_id = $1"];
    const params: unknown[] = [ownerId];
    if (query.province) {
      params.push(query.province);
      filters.push(`province = $${params.length}`);
    }
    if (query.kind) {
      params.push(query.kind);
      filters.push(`kind = $${params.length}`);
    }
    if (query.status) {
      params.push(query.status);
      filters.push(`status = $${params.length}`);
    }
    params.push(limit);
    return executor.select<ProcurementOfficerRow[]>(
      `SELECT * FROM procurement_officers
       WHERE ${filters.join(" AND ")}
       ORDER BY canonical_name ASC
       LIMIT $${params.length}`,
      params,
    );
  }

  const filters: string[] = [
    "owner_id = $1",
    "procurement_officers_fts MATCH $2",
  ];
  const params: unknown[] = [ownerId, match];
  if (query.province) {
    params.push(query.province);
    filters.push(`province = $${params.length}`);
  }
  if (query.kind) {
    params.push(query.kind);
    filters.push(`kind = $${params.length}`);
  }
  if (query.status) {
    params.push(query.status);
    filters.push(`status = $${params.length}`);
  }
  params.push(limit);
  return executor.select<ProcurementOfficerRow[]>(
    `SELECT procurement_officers.*
     FROM procurement_officers_fts
     JOIN procurement_officers ON
       procurement_officers.owner_id = procurement_officers_fts.owner_id
       AND procurement_officers.id = procurement_officers_fts.officer_id
     WHERE ${filters.join(" AND ")}
     ORDER BY rank
     LIMIT $${params.length}`,
    params,
  );
}

export async function getOfficerAssignments(
  executor: SqlExecutor,
  ownerId: string,
  officerId: string,
): Promise<OfficerAssignmentRow[]> {
  return executor.select<OfficerAssignmentRow[]>(
    "SELECT * FROM officer_assignments WHERE owner_id = $1 AND officer_id = $2 ORDER BY is_current DESC, valid_from DESC",
    [ownerId, officerId],
  );
}

/** Officer row + contact points + assignments, or undefined when absent. */
export async function getOfficer(
  executor: SqlExecutor,
  ownerId: string,
  officerId: string,
): Promise<
  | {
      officer: ProcurementOfficerRow;
      contactPoints: OfficerContactPointRow[];
      assignments: OfficerAssignmentRow[];
    }
  | undefined
> {
  const [officers, contactPoints, assignments] = await Promise.all([
    executor.select<ProcurementOfficerRow[]>(
      "SELECT * FROM procurement_officers WHERE owner_id = $1 AND id = $2",
      [ownerId, officerId],
    ),
    executor.select<OfficerContactPointRow[]>(
      "SELECT * FROM officer_contact_points WHERE owner_id = $1 AND officer_id = $2",
      [ownerId, officerId],
    ),
    getOfficerAssignments(executor, ownerId, officerId),
  ]);
  const officer = officers[0];
  if (!officer) return undefined;
  return { officer, contactPoints, assignments };
}

export async function getOfficerTenders(
  executor: SqlExecutor,
  ownerId: string,
  officerId: string,
): Promise<OfficerTenderLinkRow[]> {
  return executor.select<OfficerTenderLinkRow[]>(
    "SELECT * FROM officer_tender_links WHERE owner_id = $1 AND officer_id = $2 ORDER BY observed_at DESC",
    [ownerId, officerId],
  );
}

export async function saveOfficer(
  executor: SqlExecutor,
  ownerId: string,
  officerId: string,
  now: string = new Date().toISOString(),
): Promise<void> {
  await executor.execute(
    "INSERT INTO saved_officers (owner_id, officer_id, saved_at) VALUES ($1, $2, $3) ON CONFLICT(owner_id, officer_id) DO NOTHING",
    [ownerId, officerId, now],
  );
}

export async function unsaveOfficer(
  executor: SqlExecutor,
  ownerId: string,
  officerId: string,
): Promise<void> {
  await executor.execute(
    "DELETE FROM saved_officers WHERE owner_id = $1 AND officer_id = $2",
    [ownerId, officerId],
  );
}

export async function listSavedOfficers(
  executor: SqlExecutor,
  ownerId: string,
): Promise<Array<{ officer_id: string; saved_at: string }>> {
  return executor.select(
    "SELECT officer_id, saved_at FROM saved_officers WHERE owner_id = $1 ORDER BY saved_at DESC",
    [ownerId],
  );
}

export async function isOfficerSaved(
  executor: SqlExecutor,
  ownerId: string,
  officerId: string,
): Promise<boolean> {
  const rows = await executor.select<Array<{ officer_id: string }>>(
    "SELECT officer_id FROM saved_officers WHERE owner_id = $1 AND officer_id = $2",
    [ownerId, officerId],
  );
  return rows.length > 0;
}

export async function setOfficerNote(
  executor: SqlExecutor,
  ownerId: string,
  officerId: string,
  note: string,
  now: string = new Date().toISOString(),
): Promise<void> {
  await executor.execute(
    `INSERT INTO officer_notes (owner_id, officer_id, note, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(owner_id, officer_id) DO UPDATE SET note = excluded.note, updated_at = excluded.updated_at`,
    [ownerId, officerId, note, now],
  );
}

export async function getOfficerNote(
  executor: SqlExecutor,
  ownerId: string,
  officerId: string,
): Promise<string | null> {
  const rows = await executor.select<Array<{ note: string }>>(
    "SELECT note FROM officer_notes WHERE owner_id = $1 AND officer_id = $2",
    [ownerId, officerId],
  );
  return rows[0]?.note ?? null;
}

export async function getSyncState(
  executor: SqlExecutor,
  ownerId: string,
): Promise<OfficerSyncStateRow | undefined> {
  const rows = await executor.select<OfficerSyncStateRow[]>(
    "SELECT * FROM procurement_officer_sync_state WHERE owner_id = $1",
    [ownerId],
  );
  return rows[0];
}

export async function setSyncState(
  executor: SqlExecutor,
  ownerId: string,
  cursor: string | null,
  now: string = new Date().toISOString(),
): Promise<void> {
  await executor.execute(
    `INSERT INTO procurement_officer_sync_state (owner_id, cursor, last_sync_at)
     VALUES ($1, $2, $3)
     ON CONFLICT(owner_id) DO UPDATE SET cursor = excluded.cursor, last_sync_at = excluded.last_sync_at`,
    [ownerId, cursor, now],
  );
}

/** Denormalised FTS text: name | organisation | title | province | contacts. */
export function buildSearchText(officer: OfficerIngest): string {
  const parts = [
    officer.canonicalName,
    officer.currentTitle,
    officer.province,
    ...officer.assignments.map((a) => a.organisationName),
    ...officer.assignments.map((a) => a.title),
    ...officer.contactPoints.map((c) => c.value),
    ...(officer.tenderLinks ?? []).map((l) => l.tenderId),
  ].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );
  return parts.join(" | ");
}

/**
 * FTS5 operator characters (quotes, `*`, `-`, `+`, `~`, `^`, `(`, `)`, `:`,
 * `{`, `}`, `[`, `]`, `!`, `&`, `|`, `,`) are stripped so a raw user query
 * can never turn the MATCH expression into a syntax error or an operator.
 * Each surviving token becomes a prefix term (`token*`) for as-you-type
 * matching; bare `AND`/`OR`/`NOT`/`NEAR` tokens are quoted so they match
 * as literal terms. Returns null when nothing searchable survives (the
 * caller falls back to the plain listing).
 */
export function toFtsMatchQuery(q: string): string | null {
  const tokens = q
    .split(/\s+/)
    .map((token) => token.replace(/["*^~():{}[\]!&|,+-]/g, ""))
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return null;
  return tokens
    .map(
      (token) =>
        (/^(and|or|not|near)$/i.test(token) ? `"${token}"` : token) + "*",
    )
    .join(" ");
}
