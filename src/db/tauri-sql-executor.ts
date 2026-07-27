import Database from "@tauri-apps/plugin-sql";
import type { SqlExecutor } from "./executor";

/**
 * Must match `DB_URL` in src-tauri/src/db/mod.rs exactly. There is
 * intentionally only ever one connection string in the whole app: SQL
 * access is restricted to this single local application database
 * (design.md "Tauri Security Design"), never a caller-supplied path.
 */
const DB_URL = "sqlite:tenders-sa-desktop.db";

let dbPromise: Promise<Database> | undefined;

function getDb(): Promise<Database> {
  dbPromise ??= Database.load(DB_URL);
  return dbPromise;
}

export const tauriSqlExecutor: SqlExecutor = {
  async execute(sql, params = []) {
    const db = await getDb();
    return db.execute(sql, params);
  },
  async select<T>(sql: string, params: unknown[] = []) {
    const db = await getDb();
    return db.select<T>(sql, params);
  },
};
