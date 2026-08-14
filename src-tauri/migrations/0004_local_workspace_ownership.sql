-- Local-first workspace ownership. Existing rows are quarantined under a
-- non-authenticated legacy owner; they are never silently assigned to the
-- next account that signs in.

ALTER TABLE cache_entries ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'legacy-unscoped';
ALTER TABLE recent_records ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'legacy-unscoped';
ALTER TABLE local_preferences ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'legacy-unscoped';
ALTER TABLE local_file_references ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'legacy-unscoped';
ALTER TABLE sync_operations ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'legacy-unscoped';
ALTER TABLE sync_conflicts ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'legacy-unscoped';
ALTER TABLE response_doc_drafts ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'legacy-unscoped';
ALTER TABLE response_doc_versions ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'legacy-unscoped';

ALTER TABLE local_file_references ADD COLUMN tender_id TEXT;
ALTER TABLE local_file_references ADD COLUMN content_type TEXT;
ALTER TABLE local_file_references ADD COLUMN fingerprint TEXT;
ALTER TABLE local_file_references ADD COLUMN cache_state TEXT NOT NULL DEFAULT 'ready'
    CHECK (cache_state IN ('ready', 'stale', 'missing', 'failed'));
ALTER TABLE local_file_references ADD COLUMN updated_at TEXT;

ALTER TABLE response_doc_drafts ADD COLUMN base_fingerprint TEXT;

-- Rebuild the draft table so two accounts can safely have a draft for the
-- same server identifiers. Existing rows are quarantined under the legacy
-- owner and are never exposed to a newly authenticated account.
CREATE TABLE response_doc_drafts_scoped (
    owner_id TEXT NOT NULL,
    application_id TEXT NOT NULL,
    document_key TEXT NOT NULL,
    content TEXT NOT NULL,
    encrypted INTEGER NOT NULL DEFAULT 1 CHECK (encrypted IN (0, 1)),
    updated_at TEXT NOT NULL,
    base_fingerprint TEXT,
    PRIMARY KEY (owner_id, application_id, document_key)
);
INSERT INTO response_doc_drafts_scoped
    (owner_id, application_id, document_key, content, encrypted, updated_at, base_fingerprint)
SELECT owner_id, application_id, document_key, content, encrypted, updated_at, base_fingerprint
FROM response_doc_drafts;
DROP TABLE response_doc_drafts;
ALTER TABLE response_doc_drafts_scoped RENAME TO response_doc_drafts;

CREATE TABLE local_preferences_scoped (
    owner_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, key)
);
INSERT INTO local_preferences_scoped (owner_id, key, value, updated_at)
SELECT owner_id, key, value, updated_at FROM local_preferences;
DROP TABLE local_preferences;
ALTER TABLE local_preferences_scoped RENAME TO local_preferences;

CREATE INDEX idx_cache_entries_owner_key ON cache_entries(owner_id, key);
CREATE INDEX idx_cache_entries_owner_entity ON cache_entries(owner_id, entity_type, entity_id);
CREATE INDEX idx_recent_records_owner_visited ON recent_records(owner_id, visited_at DESC);
CREATE INDEX idx_local_preferences_owner_key ON local_preferences(owner_id, key);
CREATE INDEX idx_local_files_owner_entity ON local_file_references(owner_id, entity_type, entity_id);
CREATE INDEX idx_sync_operations_owner_status ON sync_operations(owner_id, status);
CREATE INDEX idx_sync_conflicts_owner_state ON sync_conflicts(owner_id, resolution_state);
CREATE INDEX idx_response_drafts_owner_key ON response_doc_drafts(owner_id, application_id, document_key);
CREATE INDEX idx_response_versions_owner_key ON response_doc_versions(owner_id, application_id, document_key, created_at);
