import type { SqlExecutor } from "../../db/executor";

export interface RecordedCall {
  sql: string;
  params: unknown[];
}

/**
 * Records every call instead of interpreting SQL, so tests assert the
 * exact statement text and bound parameter array -- proving values are
 * passed as parameters, never interpolated into the query string.
 */
export class FakeSqlExecutor implements SqlExecutor {
  calls: RecordedCall[] = [];
  selectResults: unknown[] = [];
  private selectCallIndex = 0;

  async execute(sql: string, params: unknown[] = []) {
    this.calls.push({ sql, params });
    return { rowsAffected: 1 };
  }

  async select<T>(sql: string, params: unknown[] = []): Promise<T> {
    this.calls.push({ sql, params });
    const result = this.selectResults[this.selectCallIndex];
    this.selectCallIndex += 1;
    return (result ?? []) as T;
  }
}
