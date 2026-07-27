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
        conn.execute_batch(MIGRATION_0001).unwrap();
        conn.execute_batch(MIGRATION_0002).unwrap();

        let tables = table_names(&conn);
        for expected in [
            "cache_entries",
            "recent_records",
            "local_preferences",
            "local_file_references",
            "sync_operations",
            "sync_conflicts",
        ] {
            assert!(tables.contains(&expected.to_string()), "missing {expected}");
        }
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
}
