/**
 * Narrow interface over the local SQL database. Repositories depend on
 * this, not on `@tauri-apps/plugin-sql` directly, so tests can inject
 * a spy/fake instead of needing a live Tauri IPC runtime.
 */
export interface SqlExecutor {
  execute(
    sql: string,
    params?: unknown[],
  ): Promise<{ rowsAffected: number; lastInsertId?: number }>;
  select<T>(sql: string, params?: unknown[]): Promise<T>;
}
