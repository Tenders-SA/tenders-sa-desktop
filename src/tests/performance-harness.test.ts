import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPerformanceMarks,
  getTimeToInteractive,
  markAppStart,
  markShellInteractive,
  PERF_TARGETS,
} from "../lib/performance";

describe("performance harness", () => {
  beforeEach(() => {
    clearPerformanceMarks();
  });

  it("measures elapsed time between app start and an interactive shell", () => {
    markAppStart();
    const elapsed = markShellInteractive();

    expect(elapsed).toBeTypeOf("number");
    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect(getTimeToInteractive()).toBe(elapsed);
  });

  it("returns undefined rather than throwing when the start mark is missing", () => {
    // Happens on hot reload; not worth crashing the shell over.
    expect(markShellInteractive()).toBeUndefined();
  });

  it("records the PERF-1/PERF-2 targets alongside the harness", () => {
    expect(PERF_TARGETS).toEqual({
      coldStartMs: 3000,
      warmStartMs: 1500,
      interactionMs: 100,
    });
  });
});
