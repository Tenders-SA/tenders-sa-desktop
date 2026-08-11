/**
 * Turns the applications the Command Centre already loads into the shapes
 * its charts draw (Slice 8, R-V10).
 *
 * Pure functions in their own module, the same arrangement as
 * `activity-format.ts` and `match-factor-rows.ts`: the panels stay thin, and
 * the decisions that actually matter here — which statuses count, how a day
 * bucket is defined, what happens to a status nobody has seen before — are
 * testable without rendering anything.
 */

import type { Application } from "../../services/api/endpoints/applications";
import type { ChartToken } from "../../components/charts/chart-tokens";

/**
 * The statuses the parent is known to use, in lifecycle order.
 *
 * `status` is `z.string()` on the wire precisely because the parent may add
 * values, so this list is a display order, not a validation set. Anything
 * unrecognised lands in `Other` rather than being dropped — an application
 * that vanishes from the user's own pipeline count because the server
 * renamed a status would be worse than an unlabelled slice.
 */
const KNOWN_STATUSES: { status: string; label: string; token: ChartToken }[] = [
  { status: "DRAFT", label: "Draft", token: 3 },
  { status: "SUBMITTED", label: "Submitted", token: 2 },
  { status: "UNDER_REVIEW", label: "Under review", token: 5 },
  { status: "AWARDED", label: "Awarded", token: 1 },
  { status: "REJECTED", label: "Rejected", token: 4 },
];

export interface StatusSlice {
  label: string;
  value: number;
  token: ChartToken;
}

export interface PipelineSummary {
  slices: StatusSlice[];
  total: number;
}

/**
 * Counts non-archived applications by status.
 *
 * Archived applications are excluded because the pipeline is what the user
 * is working on; `DeadlinePanel` draws the same line for the same reason.
 * Every known status is returned even at zero — "nothing has been rejected"
 * is information, and omitting the row would leave the reader unable to
 * distinguish it from "not tracked".
 */
export function summarisePipeline(
  applications: Application[],
): PipelineSummary {
  const live = applications.filter((application) => !application.isArchived);

  const counts = new Map<string, number>();
  for (const application of live) {
    counts.set(application.status, (counts.get(application.status) ?? 0) + 1);
  }

  const slices: StatusSlice[] = KNOWN_STATUSES.map((entry) => ({
    label: entry.label,
    value: counts.get(entry.status) ?? 0,
    token: entry.token,
  }));

  const known = new Set(KNOWN_STATUSES.map((entry) => entry.status));
  const other = live.filter(
    (application) => !known.has(application.status),
  ).length;
  if (other > 0) {
    slices.push({ label: "Other", value: other, token: 5 });
  }

  return { slices, total: live.length };
}

export interface RunwayDay {
  label: string;
  value: number;
  token?: ChartToken;
  /** ISO date key, for tests and for a stable React key. */
  date: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Counts how many active applications close on each of the next `days` days.
 *
 * The runway answers a question the "closing this week" list cannot: not
 * *what* closes, but *when the pressure lands*. Three deadlines on one
 * Friday is a different week from three spread across a fortnight, and the
 * list — which shows only the first three — cannot show that.
 *
 * Days are bucketed in local time, matching how a person reads a calendar,
 * and the first three days are marked with the urgent token so the near
 * edge reads differently from the far one.
 */
export function summariseRunway(
  applications: Application[],
  days = 14,
  now: Date = new Date(),
): RunwayDay[] {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();

  const buckets: RunwayDay[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(startOfToday + offset * DAY_MS);
    buckets.push({
      date: dateKey(day),
      label:
        offset === 0
          ? "Today"
          : day.toLocaleDateString("en-ZA", {
              day: "numeric",
              month: "short",
            }),
      value: 0,
      token: offset < 3 ? 4 : 1,
    });
  }

  const index = new Map(buckets.map((bucket, i) => [bucket.date, i]));

  for (const application of applications) {
    if (application.isArchived) continue;
    const closing = application.tender?.closingDate;
    if (!closing) continue;
    const at = new Date(closing);
    if (Number.isNaN(at.getTime())) continue;
    const position = index.get(dateKey(at));
    if (position === undefined) continue;
    buckets[position].value += 1;
  }

  return buckets;
}

/** Local-time `YYYY-MM-DD`, so a bucket matches the day a person sees. */
function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
