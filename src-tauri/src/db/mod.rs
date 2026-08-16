use tauri_plugin_sql::{Migration, MigrationKind};

/// Application database connection string. A single, fixed value --
/// repository code never accepts a caller-supplied path or URL, since
/// tauri-plugin-sql's permission model has no per-URL scoping (see
/// docs/architecture/local-data.md).
pub const DB_URL: &str = "sqlite:tenders-sa-desktop.db";

/// Ordered, versioned local-only migrations (REQ-6). Each one is
/// applied exactly once, tracked by tauri-plugin-sql's own migration
/// ledger -- no separate hand-rolled `schema_migrations` table is
/// created, to avoid two sources of truth for the same thing.
pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "init",
            sql: include_str!("../../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_lookup_indexes",
            sql: include_str!("../../migrations/0002_add_lookup_indexes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "response_doc_drafts",
            sql: include_str!("../../migrations/0003_response_doc_drafts.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "local_workspace_ownership",
            sql: include_str!("../../migrations/0004_local_workspace_ownership.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "procurement_officers",
            sql: include_str!("../../migrations/0005_procurement_officers.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg(test)]
mod tests {
    //! These tests apply the raw migration SQL directly against a real
    //! in-memory SQLite database via `rusqlite`, independent of
    //! tauri-plugin-sql's runtime (which needs a live Tauri app/tokio
    //! context this test harness doesn't have). This is what actually
    //! executes our DDL and catches real SQL errors -- the plugin
    //! wiring above just feeds it the same files at runtime.

    const MIGRATION_0001: &str = include_str!("../../migrations/0001_init.sql");
    const MIGRATION_0002: &str = include_str!("../../migrations/0002_add_lookup_indexes.sql");
    const MIGRATION_0003: &str = include_str!("../../migrations/0003_response_doc_drafts.sql");
    const MIGRATION_0004: &str = include_str!("../../migrations/0004_local_workspace_ownership.sql");
    const MIGRATION_0005: &str = include_str!("../../migrations/0005_procurement_officers.sql");

    fn apply_all(conn: &rusqlite::Connection) {
        conn.execute_batch(MIGRATION_0001).unwrap();
        conn.execute_batch(MIGRATION_0002).unwrap();
        conn.execute_batch(MIGRATION_0003).unwrap();
        conn.execute_batch(MIGRATION_0004).unwrap();
        conn.execute_batch(MIGRATION_0005).unwrap();
    }

    fn table_names(conn: &rusqlite::Connection) -> Vec<String> {
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
            .unwrap();
        stmt.query_map([], |row| row.get::<_, String>(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect()
    }

    #[test]
    fn applies_cleanly_to_an_empty_database() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        apply_all(&conn);

        let tables = table_names(&conn);
        for expected in [
            "cache_entries",
            "recent_records",
            "local_preferences",
            "local_file_references",
            "sync_operations",
            "sync_conflicts",
            "response_doc_drafts",
            "response_doc_versions",
            "procurement_officers",
            "officer_contact_points",
            "officer_assignments",
            "officer_tender_links",
            "saved_officers",
            "officer_notes",
            "procurement_officer_sync_state",
            "procurement_officers_fts",
        ] {
            assert!(tables.contains(&expected.to_string()), "missing {expected}");
        }
    }

    #[test]
    fn upgrades_from_v3_without_assigning_legacy_data_to_an_account() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(MIGRATION_0001).unwrap();
        conn.execute_batch(MIGRATION_0002).unwrap();
        conn.execute_batch(MIGRATION_0003).unwrap();
        conn.execute(
            "INSERT INTO response_doc_drafts (application_id, document_key, content, encrypted, updated_at)
             VALUES ('a1', 'technical', 'ciphertext', 1, '2026-01-01')",
            [],
        )
        .unwrap();
        conn.execute_batch(MIGRATION_0004).unwrap();

        let owner: String = conn
            .query_row(
                "SELECT owner_id FROM response_doc_drafts WHERE application_id = 'a1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(owner, "legacy-unscoped");
    }

    #[test]
    fn owner_indexes_support_isolated_lookup_paths() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        apply_all(&conn);
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name LIKE '%owner%'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(count >= 9, "every local entity family needs an owner index");
    }

    #[test]
    fn upgrades_cleanly_from_the_prior_version_fixture() {
        // "Prior version" fixture: only 0001 has been applied.
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(MIGRATION_0001).unwrap();
        conn.execute(
            "INSERT INTO cache_entries (key, entity_type, entity_id, payload, encrypted, created_at, updated_at)
             VALUES ('k1', 'tender', 't1', '{}', 0, '2026-01-01', '2026-01-01')",
            [],
        )
        .unwrap();

        // Upgrade: apply 0002 without touching existing rows.
        conn.execute_batch(MIGRATION_0002).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM cache_entries", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1, "upgrade must not lose confirmed cache state");

        let indexes: Vec<String> = {
            let mut stmt = conn
                .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_cache_entries_entity'")
                .unwrap();
            stmt.query_map([], |row| row.get::<_, String>(0))
                .unwrap()
                .map(|r| r.unwrap())
                .collect()
        };
        assert_eq!(indexes.len(), 1, "0002's index must exist after upgrade");
    }

    #[test]
    fn sync_operations_status_check_constraint_rejects_invalid_status() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(MIGRATION_0001).unwrap();
        let result = conn.execute(
            "INSERT INTO sync_operations
                (id, idempotency_key, entity_type, entity_id, operation_type, payload, status, created_at, updated_at)
             VALUES ('id1', 'idem1', 'application', 'a1', 'update', '{}', 'not-a-real-status', '2026-01-01', '2026-01-01')",
            [],
        );
        assert!(result.is_err(), "invalid status must be rejected");
    }

    #[test]
    fn sync_operations_idempotency_key_is_unique() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(MIGRATION_0001).unwrap();
        let insert = |id: &str| {
            conn.execute(
                "INSERT INTO sync_operations
                    (id, idempotency_key, entity_type, entity_id, operation_type, payload, created_at, updated_at)
                 VALUES (?1, 'dup-key', 'application', 'a1', 'update', '{}', '2026-01-01', '2026-01-01')",
                [id],
            )
        };
        insert("id1").unwrap();
        assert!(
            insert("id2").is_err(),
            "duplicate idempotency key must be rejected"
        );
    }

    // TASK-1.2 pre-check: the bundled SQLite must compile FTS5, or the
    // directory's local search index cannot be built. A missing FTS5 module
    // fails the `CREATE VIRTUAL TABLE ... USING fts5` inside apply_all with
    // "no such module: fts5" before any assertion runs.
    #[test]
    fn bundled_sqlite_compiles_fts5_and_indexes_officer_search() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        apply_all(&conn);

        let fts5: i64 = conn
            .query_row("SELECT sqlite_compileoption_used('ENABLE_FTS5')", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(fts5, 1, "bundled SQLite must compile FTS5");

        conn.execute(
            "INSERT INTO procurement_officers
                (owner_id, id, canonical_name, kind, status, suppressed, updated_at)
             VALUES ('u1', 'o1', 'thabo mokoena', 'officer', 'verified', 0, '2025-06-01')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO procurement_officers_fts (owner_id, officer_id, search_text)
             VALUES ('u1', 'o1', 'thabo mokoena | Department of Water Affairs | supply chain manager | gauteng | thabo.mokoena@dwa.gov.za')",
            [],
        )
        .unwrap();

        let hits: Vec<String> = {
            let mut stmt = conn
                .prepare(
                    "SELECT officer_id FROM procurement_officers_fts
                     WHERE procurement_officers_fts MATCH 'mokoena' AND owner_id = 'u1'",
                )
                .unwrap();
            stmt.query_map([], |row| row.get::<_, String>(0))
                .unwrap()
                .map(|r| r.unwrap())
                .collect()
        };
        assert_eq!(hits, vec!["o1".to_string()], "MATCH must find the officer");
    }

    // Tombstone removal and per-officer FTS rebuilds both delete index rows;
    // this pins that the regular FTS5 table supports DELETE.
    #[test]
    fn fts_rows_are_deletable_per_officer() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        apply_all(&conn);
        conn.execute(
            "INSERT INTO procurement_officers_fts (owner_id, officer_id, search_text)
             VALUES ('u1', 'o1', 'thabo mokoena'), ('u1', 'o2', 'nomsa dlamini')",
            [],
        )
        .unwrap();

        let deleted = conn.execute(
            "DELETE FROM procurement_officers_fts WHERE owner_id = 'u1' AND officer_id = 'o1'",
            [],
        );
        assert_eq!(deleted.unwrap(), 1, "tombstone must remove exactly one row");

        let remaining: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM procurement_officers_fts WHERE owner_id = 'u1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(remaining, 1);
    }

    #[test]
    fn officer_sync_state_is_an_owner_scoped_singleton() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        apply_all(&conn);
        conn.execute(
            "INSERT INTO procurement_officer_sync_state (owner_id, cursor, last_sync_at)
             VALUES ('u1', 'cursor-1', '2025-06-01')",
            [],
        )
        .unwrap();
        assert!(
            conn.execute(
                "INSERT INTO procurement_officer_sync_state (owner_id, cursor, last_sync_at)
                 VALUES ('u1', 'cursor-2', '2025-06-02')",
                [],
            )
            .is_err(),
            "one cursor per account"
        );
    }
}
