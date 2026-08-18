/**
 * Row shapes for the local-only tables defined in
 * src-tauri/migrations/. Kept in this one file so it stays trivially
 * comparable against the SQL DDL it mirrors.
 */

export interface CacheEntryRow {
  owner_id: string;
  key: string;
  entity_type: string;
  entity_id: string;
  etag: string | null;
  payload: string;
  encrypted: 0 | 1;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecentRecordRow {
  owner_id: string;
  id: string;
  entity_type: string;
  entity_id: string;
  label: string;
  visited_at: string;
}

export interface LocalPreferenceRow {
  owner_id: string;
  key: string;
  value: string;
  updated_at: string;
}

export interface LocalFileReferenceRow {
  owner_id: string;
  id: string;
  entity_type: string;
  entity_id: string;
  file_name: string;
  local_path: string;
  size_bytes: number | null;
  created_at: string;
  tender_id: string | null;
  content_type: string | null;
  fingerprint: string | null;
  cache_state: "ready" | "stale" | "missing" | "failed";
  updated_at: string | null;
}

export type SyncOperationStatus =
  "pending" | "syncing" | "complete" | "conflicted" | "failed" | "cancelled";

export interface SyncOperationRow {
  owner_id: string;
  id: string;
  idempotency_key: string;
  entity_type: string;
  entity_id: string;
  operation_type: string;
  payload: string;
  depends_on: string | null;
  status: SyncOperationStatus;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export type SyncConflictResolutionState =
  "unresolved" | "resolved_local" | "resolved_remote" | "resolved_merged";

export interface SyncConflictRow {
  owner_id: string;
  id: string;
  sync_operation_id: string;
  entity_type: string;
  entity_id: string;
  local_version: string;
  remote_version: string;
  field_policy: string | null;
  resolution_state: SyncConflictResolutionState;
  created_at: string;
  resolved_at: string | null;
}

/** Slice 10 — an unsaved response-document draft, local-only (LD-1). */
export interface ResponseDocDraftRow {
  owner_id: string;
  application_id: string;
  document_key: string;
  content: string;
  encrypted: 0 | 1;
  updated_at: string;
  base_fingerprint: string | null;
}

export type ResponseDocVersionSource = "save" | "generate" | "restore";

/** Slice 10 — a local snapshot of a saved response-document version (LD-3). */
export interface ResponseDocVersionRow {
  owner_id: string;
  id: string;
  application_id: string;
  document_key: string;
  content: string;
  encrypted: 0 | 1;
  source: ResponseDocVersionSource;
  created_at: string;
}

/** Procurement Officer Directory (TASK-1.3) — row shapes for 0005 DDL. */

export interface ProcurementOfficerRow {
  owner_id: string;
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
  suppressed: 0 | 1;
  updated_at: string;
}

export interface OfficerContactPointRow {
  owner_id: string;
  officer_id: string;
  id: string;
  type: string;
  value: string;
  is_role_based: 0 | 1;
  is_official: 0 | 1;
  verification_status: string;
}

export interface OfficerAssignmentRow {
  owner_id: string;
  officer_id: string;
  id: string;
  organisation_id: string | null;
  organisation_name: string | null;
  title: string | null;
  valid_from: string | null;
  valid_to: string | null;
  is_current: 0 | 1;
  confidence_score: number | null;
}

export interface OfficerTenderLinkRow {
  owner_id: string;
  officer_id: string;
  tender_id: string;
  source_field: string | null;
  observed_at: string | null;
}

export interface OfficerSyncStateRow {
  owner_id: string;
  cursor: string | null;
  last_sync_at: string | null;
}
