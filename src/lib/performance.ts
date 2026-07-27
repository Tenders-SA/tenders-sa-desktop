/**
 * Startup performance measurement harness (PERF-1, PERF-2).
 *
 * PERF-1's targets -- 3s cold start, 1.5s warm start to interactive
 * shell -- are only meaningful when measured on the agreed Windows 11
 * reference device. This module records the marks; it deliberately
 * does NOT assert a threshold, because a pass/fail computed on
 * developer hardware or CI would be evidence of nothing. TASK-0.13
 * attaches real device measurements.
 */

export const MARK_APP_START = "tsa:app-start";
export const MARK_SHELL_INTERACTIVE = "tsa:shell-interactive";
export const MEASURE_TIME_TO_INTERACTIVE = "tsa:time-to-interactive";

/** PERF-1 targets, recorded here so the numbers live next to the harness. */
export const PERF_TARGETS = {
  coldStartMs: 3000,
  warmStartMs: 1500,
  /** PERF-2: input acknowledgement budget. */
  interactionMs: 100,
} as const;

export function markAppStart(): void {
  performance.mark(MARK_APP_START);
}

/**
 * Called once the shell has rendered and is interactive. Returns the
 * elapsed milliseconds, or undefined if the start mark is missing
 * (e.g. hot reload), which is not an error worth throwing over.
 */
export function markShellInteractive(): number | undefined {
  if (performance.getEntriesByName(MARK_APP_START).length === 0) {
    return undefined;
  }
  performance.mark(MARK_SHELL_INTERACTIVE);
  performance.measure(
    MEASURE_TIME_TO_INTERACTIVE,
    MARK_APP_START,
    MARK_SHELL_INTERACTIVE,
  );
  const entries = performance.getEntriesByName(MEASURE_TIME_TO_INTERACTIVE);
  return entries[entries.length - 1]?.duration;
}

export function getTimeToInteractive(): number | undefined {
  const entries = performance.getEntriesByName(MEASURE_TIME_TO_INTERACTIVE);
  return entries[entries.length - 1]?.duration;
}

export function clearPerformanceMarks(): void {
  performance.clearMarks(MARK_APP_START);
  performance.clearMarks(MARK_SHELL_INTERACTIVE);
  performance.clearMeasures(MEASURE_TIME_TO_INTERACTIVE);
}
