-- Procurement Officer Directory local index.
-- Spec: desktop-procurement-officer-directory (TASK-1.2).
--
-- Owner-scoped cache tables. The parent sync feed
-- (GET /api/v1/procurement-officers/sync) is the only write source; the
-- desktop never resolves identity or officialness locally.
--
-- Deviation from design.md: `procurement_officers_fts` is a REGULAR
-- (stored) FTS5 table, not contentless (`content=''`). Contentless FTS5
-- cannot DELETE rows, and tombstone removal + per-officer index rebuilds
-- both need deletion. The stored copy is small (a local index) and
-- `search_text` is rebuilt transactionally on ingest.

CREATE TABLE procurement_officers (
  owner_id TEXT NOT NULL,
  id TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  current_title TEXT,
  current_organisation_id TEXT,
  province TEXT,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  confidence_score REAL,
  first_seen_at TEXT,
  last_seen_at TEXT,
  verified_at TEXT,
  suppressed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, id)
);

CREATE TABLE officer_contact_points (
  owner_id TEXT NOT NULL,
  officer_id TEXT NOT NULL,
  id TEXT NOT NULL,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  is_role_based INTEGER NOT NULL DEFAULT 0,
  is_official INTEGER NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL,
  PRIMARY KEY (owner_id, id)
);

CREATE TABLE officer_assignments (
  owner_id TEXT NOT NULL,
  officer_id TEXT NOT NULL,
  id TEXT NOT NULL,
  organisation_id TEXT,
  organisation_name TEXT,
  title TEXT,
  valid_from TEXT,
  valid_to TEXT,
  is_current INTEGER NOT NULL DEFAULT 0,
  confidence_score REAL,
  PRIMARY KEY (owner_id, id)
);

CREATE TABLE officer_tender_links (
  owner_id TEXT NOT NULL,
  officer_id TEXT NOT NULL,
  tender_id TEXT NOT NULL,
  source_field TEXT,
  observed_at TEXT,
  PRIMARY KEY (owner_id, officer_id, tender_id)
);

CREATE TABLE saved_officers (
  owner_id TEXT NOT NULL,
  officer_id TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, officer_id)
);

CREATE TABLE officer_notes (
  owner_id TEXT NOT NULL,
  officer_id TEXT NOT NULL,
  note TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, officer_id)
);

CREATE TABLE procurement_officer_sync_state (
  owner_id TEXT PRIMARY KEY,
  cursor TEXT,
  last_sync_at TEXT
);

CREATE INDEX idx_officer_contacts_officer ON officer_contact_points(owner_id, officer_id);
CREATE INDEX idx_officer_assignments_officer ON officer_assignments(owner_id, officer_id);
CREATE INDEX idx_officer_tenders_officer ON officer_tender_links(owner_id, officer_id);

-- FTS5 search index. `search_text` is the denormalised join of
-- canonical name | organisation name | title | province | contact values |
-- tender ids, rebuilt transactionally by the repository on ingest.
CREATE VIRTUAL TABLE procurement_officers_fts USING fts5(
  owner_id UNINDEXED,
  officer_id UNINDEXED,
  search_text,
  tokenize = 'porter unicode61'
);