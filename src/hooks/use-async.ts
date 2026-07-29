/**
 * One place where "load something from the parent" is implemented.
 *
 * Refs: REL-A1, REQ-A8
 *
 * Every screen needs the same four states — loading, ready, error, and the
 * *cancelled* case that must render as nothing at all. Getting cancellation
 * wrong is the subtle one: an aborted request rejects, and a screen that
 * treats that as an error flashes a failure message during ordinary
 * navigation. Doing this once means no screen can forget it.
 *
 * The loader is keyed on `deps` and aborts the in-flight request whenever
 * they change, so a fast sequence of filter changes cannot land out of order
 * and leave the UI showing results for a query the user has moved on from.
 */

import { useEffect, useState } from "react";
import { ApiError } from "../services/api/errors";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "ready"; value: T }
  | { status: "error"; error: unknown };

/**
 * @param load Receives an `AbortSignal` and must pass it to the endpoint.
 * @param deps Re-runs the load when these change, aborting the previous one.
 */
export function useAsync<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  // Bumping this re-runs the effect without changing the caller's deps.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ status: "loading" });

    load(controller.signal)
      .then((value) => {
        if (active) setState({ status: "ready", value });
      })
      .catch((error: unknown) => {
        // A cancelled request is not a failure -- it is what happens when the
        // user navigates or changes a filter mid-flight.
        if (error instanceof ApiError && error.kind === "cancelled") return;
        if (active) setState({ status: "error", error });
      });

    return () => {
      active = false;
      controller.abort();
    };
    // `load` is intentionally not a dependency: callers write it inline, so
    // including it would re-fetch on every render. `deps` is the contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  return { ...state, reload: () => setAttempt((n) => n + 1) };
}
