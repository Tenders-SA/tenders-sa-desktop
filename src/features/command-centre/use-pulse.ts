/**
 * The Command Centre's single read of the platform pulse (R-V10).
 *
 * Three visuals draw from it — the KPI strip, the market trend and the
 * province bars — and they share one request. Each still renders its own
 * `AsyncSection`, so they fail and retry independently in the UI while
 * costing one call to the parent.
 */

import { useAsync, type AsyncState } from "../../hooks/use-async";
import type {
  PlatformPulse,
  PulseEndpoint,
} from "../../services/api/endpoints/pulse";

export type PulseState = AsyncState<PlatformPulse> & { reload: () => void };

export function usePulse(endpoint: PulseEndpoint): PulseState {
  return useAsync((signal) => endpoint.getPulse(signal), [endpoint]);
}
