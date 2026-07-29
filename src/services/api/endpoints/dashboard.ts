/**
 * Command Centre data.
 *
 * Refs: brief §6.1, INT-A3, REQ-A12
 * Parent routes (read from source at `8ff2e4c2`):
 *   GET /api/v1/dashboard/summary        -> {success, data:{upcomingDeadlines, documentAlerts, pipelineValue}}
 *   GET /api/v1/dashboard/activity       -> {success, data:{activities[]}}
 *   GET /api/v1/dashboard/action-center  -> {success, data} (service-shaped)
 *
 * These three use the `successResponse` envelope, unlike `/api/tenders`
 * which returns a bare domain key. Each schema below therefore describes its
 * own whole body rather than assuming a shared wrapper.
 */

import { z } from "zod";
import { AuthenticatedEndpoint } from "./base";

const deadlineApplicationSchema = z.object({
  id: z.string(),
  title: z.string(),
  closingDate: z.string().nullable(),
});

const summarySchema = z.object({
  success: z.literal(true),
  data: z.object({
    upcomingDeadlines: z.object({
      count: z.number(),
      soonest: z.string().nullable().optional(),
      applications: z.array(deadlineApplicationSchema),
    }),
    documentAlerts: z.object({ count: z.number() }),
    pipelineValue: z.object({
      total: z.number(),
      applicationCount: z.number(),
    }),
  }),
});

export type DashboardSummary = z.infer<typeof summarySchema>["data"];

/**
 * One activity-feed entry.
 *
 * `href` and `icon` are the **web** application's own routing and icon
 * names. They are parsed so validation does not fail, but the desktop
 * deliberately ignores them: a web path means nothing here, and following
 * one would be a broken link. `type` is what the desktop routes on.
 */
const activitySchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  description: z.string(),
  timestamp: z.string(),
  icon: z.string().optional(),
  href: z.string().optional(),
  accent: z.string().optional(),
});

export type ActivityItem = z.infer<typeof activitySchema>;

const activitySchemaBody = z.object({
  success: z.literal(true),
  data: z.object({ activities: z.array(activitySchema) }),
});

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
  async getSummary(signal?: AbortSignal): Promise<DashboardSummary> {
    const body = await this.transport.request({
      method: "GET",
      path: "/api/v1/dashboard/summary",
      schema: summarySchema,
      headers: await this.authHeaders(),
      signal,
    });
    return body.data;
  }

  async getActivity(limit = 10, signal?: AbortSignal): Promise<ActivityItem[]> {
    const body = await this.transport.request({
      method: "GET",
      path: "/api/v1/dashboard/activity",
      // Server clamps to 20; an explicit value keeps the page bounded
      // (PERF-3).
      query: { limit },
      schema: activitySchemaBody,
      headers: await this.authHeaders(),
      signal,
    });
    return body.data.activities;
  }

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
      detail: firstString(record, ["description", "detail", "subtitle"]),
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
  for (const key of ["items", "actions", "actionItems", "results", "cards"]) {
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
