/**
 * Opportunities — the user's saved tender shortlist.
 *
 * Refs: brief §5 "Opportunities", INT-A3
 * Parent routes (read from source at `8ff2e4c2`):
 *   GET  /api/v1/user/saved-tenders  -> {tenders[], pagination:{total,page,limit,totalPages}, stats:{closed}}
 *   POST /api/v1/tenders/[id]/save   -> {saved: boolean}   (toggles)
 *
 * **`save` is a toggle, not an idempotent set.** The route looks for an
 * existing `SavedTender` row and deletes it when found, so calling it twice
 * returns the user to where they started. The desktop therefore never
 * "re-saves" defensively and never retries it — the transport already gives
 * mutations `retry: "never"`, which here is a correctness requirement rather
 * than an optimisation, because a replayed toggle would silently unsave.
 *
 * Note the pagination shape is `{total, page, limit, totalPages}` from the
 * parent's `buildPaginationMeta` — `totalPages`, not the `pages` that
 * `/api/tenders` returns. Two different helpers, deliberately not unified.
 */

import { z } from "zod";
import { AuthenticatedEndpoint } from "./base";

const savedTenderSchema = z.object({
  savedAt: z.string(),
  id: z.string(),
  title: z.string(),
  referenceNumber: z.string().nullable(),
  closingDate: z.string().nullable(),
  status: z.string().nullable(),
  province: z.string().nullable(),
  organization: z.string().nullable(),
  categories: z.array(z.string()),
});

export type SavedTender = z.infer<typeof savedTenderSchema>;

const savedTendersSchema = z.object({
  tenders: z.array(savedTenderSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  }),
  stats: z.object({ closed: z.number() }).optional(),
});

export interface SavedTendersResult {
  tenders: SavedTender[];
  total: number;
  page: number;
  totalPages: number;
  closedCount: number;
}

export interface SavedTendersQuery {
  page?: number;
  limit?: number;
  /** Server-side filters; both narrow to still-biddable work. */
  activeOnly?: boolean;
  futureOnly?: boolean;
}

const saveToggleSchema = z.object({ saved: z.boolean() });

export class SavedTendersEndpoint extends AuthenticatedEndpoint {
  async list(
    query: SavedTendersQuery = {},
    signal?: AbortSignal,
  ): Promise<SavedTendersResult> {
    const body = await this.transport.request({
      method: "GET",
      path: "/api/v1/user/saved-tenders",
      query: {
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        activeOnly: query.activeOnly ? "true" : undefined,
        futureOnly: query.futureOnly ? "true" : undefined,
      },
      schema: savedTendersSchema,
      headers: await this.authHeaders(),
      signal,
    });

    return {
      tenders: body.tenders,
      total: body.pagination.total,
      page: body.pagination.page,
      totalPages: body.pagination.totalPages,
      closedCount: body.stats?.closed ?? 0,
    };
  }

  /**
   * Toggles saved state and returns what it now IS.
   *
   * The return value is the authority, not the caller's assumption: if two
   * windows disagree about whether a tender was saved, the server's answer
   * settles it.
   */
  async toggleSave(tenderId: string, signal?: AbortSignal): Promise<boolean> {
    const body = await this.transport.request({
      method: "POST",
      path: `/api/v1/tenders/${encodeURIComponent(tenderId)}/save`,
      schema: saveToggleSchema,
      headers: await this.authHeaders(),
      signal,
    });
    return body.saved;
  }
}
