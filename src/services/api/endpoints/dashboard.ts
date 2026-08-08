/**
 * Command Centre data.
 *
 * Refs: brief §6.1, INT-A3, REQ-A12
 * Parent routes (read from source at `8ff2e4c2`):
 *   GET /api/v1/dashboard/action-center  -> {success, data} (service-shaped)
 *
 * The deadline and activity panels do NOT use `/api/v1/dashboard/summary`
 * and `/api/v1/dashboard/activity` any more. The live deployment returns
 * `{}` for exactly those two routes (verified against the running site on
 * 2026-08-07 with a live session), so they are unusable as a contract.
 * The web application itself feeds its dashboard from
 * `/api/v1/applications` and `/api/v1/documents/stats`, which do answer
 * with real data, and the desktop panels consume the same clients
 * (`ApplicationsEndpoint`, `DocumentsEndpoint`) -- see
 * `docs/specifications/dashboard-live-data.md`.
 *
 * `successResponse` is the envelope the action-centre route uses, unlike
 * `/api/tenders` which returns a bare domain key.
 */

import { z } from "zod";
import { AuthenticatedEndpoint } from "./base";

/**
 * The action centre is service-shaped and its contents are not pinned by a
 * type the desktop can see, so it is parsed permissively and read
 * defensively. Anything unrecognised is skipped rather than rendered as an
 * empty row.
 */
const actionCenterSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
});

/** A normalised action item, whatever the parent called its fields. */
export interface ActionItem {
  id: string;
  title: string;
  detail?: string;
  count?: number;
  severity?: string;
}

export class DashboardEndpoint extends AuthenticatedEndpoint {
  /**
   * Action centre items, normalised.
   *
   * The parent's shape here comes from a service rather than an inline
   * literal, so rather than guess at it this reads the shapes it recognises
   * and returns nothing for anything else. An empty list renders as "nothing
   * needs attention", which is the safe reading: inventing rows from an
   * unrecognised payload would be worse.
   */
  async getActionItems(signal?: AbortSignal): Promise<ActionItem[]> {
    const body = await this.transport.request({
      method: "GET",
      path: "/api/v1/dashboard/action-center",
      schema: actionCenterSchema,
      headers: await this.authHeaders(),
      signal,
    });
    return normaliseActionItems(body.data);
  }
}

/** Exported for tests: the tolerant reader for an unpinned payload. */
export function normaliseActionItems(data: unknown): ActionItem[] {
  const candidates = collectCandidateArray(data);
  const items: ActionItem[] = [];

  for (const [index, entry] of candidates.entries()) {
    if (entry === null || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const title = firstString(record, ["title", "label", "name", "message"]);
    if (!title) continue;
    items.push({
      id: firstString(record, ["id", "key"]) ?? `action-${index}`,
      title,
      detail: firstString(record, ["description", "detail", "subtitle", "why"]),
      count: typeof record.count === "number" ? record.count : undefined,
      severity: firstString(record, ["severity", "priority", "level"]),
    });
  }
  return items;
}

/** Finds the item array whether it is the root or under a known key. */
function collectCandidateArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data === null || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  for (const key of [
    "items",
    "actions",
    "actionItems",
    "results",
    "cards",
    "nextSteps",
  ]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

function firstString(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}
