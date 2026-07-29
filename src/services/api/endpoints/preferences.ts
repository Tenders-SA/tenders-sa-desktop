/**
 * Tender Radar matching preferences (brief §5 "Settings").
 *
 * Refs: INT-A3, REQ-A12
 * Parent routes (read from source at `8ff2e4c2`):
 *   GET /api/v1/users/preferences -> {success, preferences:{...}, isDefault}
 *   PUT /api/v1/users/preferences -> validated, then upserted
 *
 * These are not cosmetic settings — they are Tender Radar's inputs, so this
 * screen is where a user explains to the platform what work they want.
 *
 * **Two traps, both handled here rather than in the UI.**
 *
 * 1. `PUT` is a **full replace**, not a patch. The route's `update` block sets
 *    every column from the parsed body, so a partial payload silently wipes
 *    the fields it omits — a user nudging their match threshold would lose
 *    every category and keyword they had configured. `update()` therefore
 *    requires the complete object and callers must spread the current values.
 * 2. `isDefault` distinguishes "the server has no row for you" from "you
 *    configured these and they happen to look like the defaults". The screen
 *    needs that to avoid claiming a user chose a `minMatchScore` of 70 when
 *    nobody ever set it.
 *
 * A successful `PUT` also makes the parent recompute recommendations in the
 * background, so the Radar will change after saving. That is the parent's
 * behaviour, not something the desktop triggers separately.
 */

import { z } from "zod";
import { AuthenticatedEndpoint } from "./base";

const preferenceValuesSchema = z.object({
  preferredCategories: z.array(z.string()),
  excludedCategories: z.array(z.string()),
  preferredProvinces: z.array(z.string()),
  mustIncludeKeywords: z.array(z.string()),
  excludedKeywords: z.array(z.string()),
  minTenderValue: z.number().nullable(),
  maxTenderValue: z.number().nullable(),
  minMatchScore: z.number(),
});

export type PreferenceValues = z.infer<typeof preferenceValuesSchema>;

const preferencesSchema = z.object({
  success: z.literal(true),
  preferences: preferenceValuesSchema,
  /** True when no row exists and these are the parent's fallbacks. */
  isDefault: z.boolean(),
});

export interface PreferencesResult {
  preferences: PreferenceValues;
  isDefault: boolean;
}

export class PreferencesEndpoint extends AuthenticatedEndpoint {
  async get(signal?: AbortSignal): Promise<PreferencesResult> {
    const body = await this.transport.request({
      method: "GET",
      path: "/api/v1/users/preferences",
      schema: preferencesSchema,
      headers: await this.authHeaders(),
      signal,
    });
    return { preferences: body.preferences, isDefault: body.isDefault };
  }

  /**
   * Replaces the whole preference set.
   *
   * Takes the **complete** object deliberately: the route replaces every
   * column, so accepting a partial here would make silent data loss easy to
   * write. Callers spread what they read from `get()` and change only what the
   * user touched.
   */
  async update(values: PreferenceValues, signal?: AbortSignal): Promise<void> {
    await this.transport.request({
      method: "PUT",
      path: "/api/v1/users/preferences",
      body: values,
      schema: z.unknown(),
      headers: await this.authHeaders(),
      signal,
    });
  }
}
