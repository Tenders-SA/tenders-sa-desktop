-- Lookup indexes for the query patterns the repositories in
-- src/db/repositories/** actually use. Kept as its own migration
-- (rather than folded into 0001) so TASK-0.5's tests exercise a real
-- upgrade-from-prior-version path, not just an empty-database apply.

CREATE INDEX idx_cache_entries_entity ON cache_entries(entity_type, entity_id);
CREATE INDEX idx_cache_entries_expires_at ON cache_entries(expires_at);
CREATE INDEX idx_recent_records_visited_at ON recent_records(visited_at DESC);
CREATE INDEX idx_local_file_references_entity ON local_file_references(entity_type, entity_id);
CREATE INDEX idx_sync_operations_status ON sync_operations(status);
CREATE INDEX idx_sync_conflicts_resolution_state ON sync_conflicts(resolution_state);
