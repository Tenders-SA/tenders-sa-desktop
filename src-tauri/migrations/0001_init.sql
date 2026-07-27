-- Local-only infrastructure tables (design.md "Local SQLite Design").
-- None of these are a duplicate parent domain owner: the parent backend
-- remains canonical for every entity referenced here; these tables only
-- hold cache metadata, offline queue state, and device-local
-- preferences/references, per REQ-6 and PRIV-1.

CREATE TABLE cache_entries (
    key TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    etag TEXT,
    -- JSON payload, or base64 AES-GCM ciphertext from the native
    -- security boundary (TASK-0.4) when encrypted = 1.
    payload TEXT NOT NULL,
    encrypted INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE recent_records (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    label TEXT NOT NULL,
    visited_at TEXT NOT NULL
);

CREATE TABLE local_preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE local_file_references (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    local_path TEXT NOT NULL,
    size_bytes INTEGER,
    created_at TEXT NOT NULL
);

CREATE TABLE sync_operations (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT NOT NULL UNIQUE,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    -- JSON payload of the pending mutation. Never a persistent auth
    -- token or credential (PRIV-1, SEC-2) -- those live only in OS
    -- secure storage via TASK-0.4's session_store.
    payload TEXT NOT NULL,
    depends_on TEXT REFERENCES sync_operations(id),
    status TEXT NOT NULL DEFAULT 'pending',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (status IN ('pending', 'syncing', 'complete', 'conflicted', 'failed', 'cancelled'))
);

CREATE TABLE sync_conflicts (
    id TEXT PRIMARY KEY,
    sync_operation_id TEXT NOT NULL REFERENCES sync_operations(id),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    -- JSON snapshots. Proposal/pricing conflicts must preserve both
    -- versions rather than silently overwrite (design.md Sync State
    -- Machine) -- resolution_state stays 'unresolved' until a human or
    -- policy explicitly picks one.
    local_version TEXT NOT NULL,
    remote_version TEXT NOT NULL,
    field_policy TEXT,
    resolution_state TEXT NOT NULL DEFAULT 'unresolved',
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    CHECK (resolution_state IN ('unresolved', 'resolved_local', 'resolved_remote', 'resolved_merged'))
);
