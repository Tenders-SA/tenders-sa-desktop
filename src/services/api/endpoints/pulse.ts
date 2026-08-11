/**
 * Platform pulse — market-level activity (Slice 8, R-V9).
 *
 * Parent route (read from parent source at 2026-08-11):
 *   GET /api/v1/dashboard/platform-pulse -> {success:true, data:PlatformPulseData}
 *   JWT via `verifyJWTFromRequest`; 401 `{success:false,error:'Unauthorized'}`;
 *   `Cache-Control: private, max-age=300`.
 *
 * This is the same route the web dashboard's `platform-pulse.tsx` renders,
 * so the desktop and the web application cannot show different figures for
 * the same window.
 *
 * **It may yet be the `/dashboard/summary` trap.** That route and
 * `/dashboard/activity` answer `{}` on the live deployment (see
 * `dashboard.ts`'s header), which is why the deadline and activity panels
 * feed from `/api/v1/applications` instead. `platform-pulse` has a real
 * service behind it in parent source (`platform-pulse.service.ts`) and the
 * web dashboard renders it, but **the live payload has not yet been
 * confirmed from this repository** — Slice 8 T1 is the gate that does it.
 * Until that is recorded in `INTEGRATION_EVAL.md`, treat the market charts
 * as provisional: if the deployment answers empty, this client and the three
 * visuals it feeds come out rather than shipping over a dead route.
 *
 * Parsing is typed-permissive, the house style for parent-internal routes:
 * every collection defaults to empty and every total to zero, and unknown
 * fields pass through. A field the parent adds later must not break a
 * shipped desktop build, and a field it omits must not throw — it must
 * render as "no data", which the panels can say honestly.
 */

import { z } from "zod";
import { AuthenticatedEndpoint } from "./base";

const trendPointSchema = z.object({
  date: z.string(),
  tenders: z.number().nullish(),
  awards: z.number().nullish(),
});

const provinceTendersSchema = z.object({
  province: z.string(),
  slug: z.string().nullish(),
  count: z.number().nullish(),
});

const provinceAwardsSchema = provinceTendersSchema.extend({
  totalValue: z.number().nullish(),
});

const totalsSchema = z
  .object({
    activeTenders: z.number().nullish(),
    newTenders30d: z.number().nullish(),
    closingSoon7d: z.number().nullish(),
    awards30d: z.number().nullish(),
    awardedValue30d: z.number().nullish(),
  })
  .passthrough();

const pulseSchema = z
  .object({
    totals: totalsSchema.optional(),
    trend: z.array(trendPointSchema).optional(),
    tendersByProvince: z.array(provinceTendersSchema).optional(),
    awardsByProvince: z.array(provinceAwardsSchema).optional(),
    generatedAt: z.string().optional(),
  })
  .passthrough();

const envelopeSchema = z.object({
  success: z.literal(true),
  data: pulseSchema,
});

export interface PulseTrendPoint {
  date: string;
  tenders: number;
  awards: number;
}

export interface PulseProvince {
  province: string;
  count: number;
  totalValue?: number;
}

/**
 * Totals are `number | undefined`, never defaulted to zero.
 *
 * A missing total and a genuine zero are different claims — "the platform
 * published no awards this month" versus "nobody counted" — and the KPI
 * strip renders the first as `0` and the second as `—`. Collapsing them here
 * would make that distinction impossible downstream.
 */
export interface PulseTotals {
  activeTenders?: number;
  newTenders30d?: number;
  closingSoon7d?: number;
  awards30d?: number;
  awardedValue30d?: number;
}

export interface PlatformPulse {
  totals: PulseTotals;
  trend: PulseTrendPoint[];
  tendersByProvince: PulseProvince[];
  awardsByProvince: PulseProvince[];
  generatedAt?: string;
}

export class PulseEndpoint extends AuthenticatedEndpoint {
  async getPulse(signal?: AbortSignal): Promise<PlatformPulse> {
    const body = await this.transport.request({
      method: "GET",
      path: "/api/v1/dashboard/platform-pulse",
      schema: envelopeSchema,
      headers: await this.authHeaders(),
      signal,
    });
    return normalisePulse(body.data);
  }
}

/** Exported for tests: the tolerant reader for the parsed payload. */
export function normalisePulse(
  data: z.infer<typeof pulseSchema>,
): PlatformPulse {
  return {
    totals: {
      activeTenders: data.totals?.activeTenders ?? undefined,
      newTenders30d: data.totals?.newTenders30d ?? undefined,
      closingSoon7d: data.totals?.closingSoon7d ?? undefined,
      awards30d: data.totals?.awards30d ?? undefined,
      awardedValue30d: data.totals?.awardedValue30d ?? undefined,
    },
    trend: (data.trend ?? []).map((point) => ({
      date: point.date,
      tenders: point.tenders ?? 0,
      awards: point.awards ?? 0,
    })),
    tendersByProvince: (data.tendersByProvince ?? []).map((entry) => ({
      province: entry.province,
      count: entry.count ?? 0,
    })),
    awardsByProvince: (data.awardsByProvince ?? []).map((entry) => ({
      province: entry.province,
      count: entry.count ?? 0,
      totalValue: entry.totalValue ?? 0,
    })),
    generatedAt: data.generatedAt,
  };
}
