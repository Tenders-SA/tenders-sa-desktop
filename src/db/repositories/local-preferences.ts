import type { SqlExecutor } from "../executor";
import type { LocalPreferenceRow } from "../schema/types";

export async function getLocalPreference(
  executor: SqlExecutor,
  ownerId: string,
  key: string,
): Promise<string | undefined> {
  const rows = await executor.select<LocalPreferenceRow[]>(
    "SELECT * FROM local_preferences WHERE owner_id = $1 AND key = $2",
    [ownerId, key],
  );
  return rows[0]?.value;
}

export async function setLocalPreference(
  executor: SqlExecutor,
  ownerId: string,
  key: string,
  value: string,
  now: string = new Date().toISOString(),
): Promise<void> {
  await executor.execute(
    `INSERT INTO local_preferences (owner_id, key, value, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(owner_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [ownerId, key, value, now],
  );
}

export async function deleteLocalPreference(
  executor: SqlExecutor,
  ownerId: string,
  key: string,
): Promise<void> {
  await executor.execute(
    "DELETE FROM local_preferences WHERE owner_id = $1 AND key = $2",
    [ownerId, key],
  );
}
