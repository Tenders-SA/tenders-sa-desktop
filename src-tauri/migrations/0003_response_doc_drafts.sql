-- Response-document local drafting (Slice 10, LD-1..LD-4).
-- Desktop-only persistence: unsaved drafts, a pending-save queue reusing
-- sync_operations, and local version history. The parent backend remains the
-- single source of truth; these tables hold cache/offline state only.
-- Content is encrypted at rest through the native security boundary
-- (encrypted = 1 carries the AES-GCM ciphertext, mirroring cache_entries).

CREATE TABLE response_doc_drafts (
    application_id TEXT NOT NULL,
    document_key TEXT NOT NULL,
    -- Encrypted draft content (base64 AES-GCM ciphertext when encrypted = 1).
    content TEXT NOT NULL,
    encrypted INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (application_id, document_key)
);

CREATE TABLE response_doc_versions (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    document_key TEXT NOT NULL,
    -- Encrypted snapshot content (base64 AES-GCM ciphertext when encrypted = 1).
    content TEXT NOT NULL,
    encrypted INTEGER NOT NULL DEFAULT 1,
    -- What replaced this version: 'save' | 'generate' | 'restore'.
    source TEXT NOT NULL,
    created_at TEXT NOT NULL,
    CHECK (source IN ('save', 'generate', 'restore'))
);

CREATE INDEX idx_response_doc_versions_key
    ON response_doc_versions (application_id, document_key, created_at);
