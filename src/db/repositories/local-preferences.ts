import type { SqlExecutor } from "../executor";
import type { LocalPreferenceRow } from "../schema/types";

export async function getLocalPreference(
  executor: SqlExecutor,
  key: string,
): Promise<string | undefined> {
  const rows = await executor.select<LocalPreferenceRow[]>(
    "SELECT * FROM local_preferences WHERE key = $1",
    [key],
  );
  return rows[0]?.value;
}

export async function setLocalPreference(
  executor: SqlExecutor,
  key: string,
  value: string,
  now: string = new Date().toISOString(),
): Promise<void> {
  await executor.execute(
    `INSERT INTO local_preferences (key, value, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, now],
  );
}

export async function deleteLocalPreference(
  executor: SqlExecutor,
  key: string,
): Promise<void> {
  await executor.execute("DELETE FROM local_preferences WHERE key = $1", [key]);
}
