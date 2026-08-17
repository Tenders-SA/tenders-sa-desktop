/**
 * Officer correction state (TASK-1.8, design.md §UI, R-P12).
 *
 * "Report incorrect information" posts `{field, reason}` to the parent and,
 * on success, records a local pending-suppression marker for that field:
 * `officerSuppressedFields` (per account, in `local_preferences`), keyed
 * `${officerId}:${field}` with the disputed value.
 *
 * The field stays hidden while the local record still carries the disputed
 * value. Once a later sync no longer carries it (the server resolved the
 * dispute by changing or dropping the value), the marker is pruned and the
 * field is shown again — never re-shown before resolution (R-P12).
 *
 * Honest failure: a 404 or 400 never writes a marker; the dialog surfaces
 * the rejection with an explicit message.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SqlExecutor } from "../../db/executor";
import { getLocalPreference, setLocalPreference } from "../../db/repositories/local-preferences";
import { ApiError } from "../../services/api/errors";
import type { OfficerCorrection } from "../../services/api/endpoints/procurement-officers";

export const SUPPRESSED_FIELDS_KEY = "officerSuppressedFields";

/** `${officerId}:${field}` → the disputed value that is hidden pending review. */
export type OfficerSuppressedMap = Record<string, string>;

export interface OfficerCorrectionFeed {
  submitCorrection(
    id: string,
    input: { field: string; reason: string },
    signal?: AbortSignal,
  ): Promise<OfficerCorrection>;
}

export type OfficerCorrectionPhase =
  | "idle"
  | "submitting"
  | "submitted"
  | "error";

export interface OfficerCorrectionState {
  suppressed: OfficerSuppressedMap;
  phase: OfficerCorrectionPhase;
  status: string | null;
  errorMessage: string | null;
  submitCorrection: (field: string, value: string, reason: string) => Promise<void>;
  reset: () => void;
}

export async function readSuppressed(
  executor: SqlExecutor,
  ownerId: string,
): Promise<OfficerSuppressedMap> {
  const raw = await getLocalPreference(executor, ownerId, SUPPRESSED_FIELDS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as OfficerSuppressedMap;
  } catch {
    return {};
  }
}

export async function writeSuppressed(
  executor: SqlExecutor,
  ownerId: string,
  map: OfficerSuppressedMap,
): Promise<void> {
  await setLocalPreference(executor, ownerId, SUPPRESSED_FIELDS_KEY, JSON.stringify(map));
}

/** The disputed value is still being carried → the field stays hidden. */
export function isFieldSuppressed(
  map: OfficerSuppressedMap,
  officerId: string,
  field: string,
  value: string | null,
): boolean {
  if (value === null) return false;
  return map[`${officerId}:${field}`] === value;
}

/**
 * Removes markers whose stored value no longer matches the current value.
 * A different value (or none) means a later sync no longer carries the
 * disputed data — the server resolved the dispute — so the marker expires.
 */
export function pruneSuppressed(
  map: OfficerSuppressedMap,
  officerId: string,
  currentValues: Record<string, string | null>,
): OfficerSuppressedMap {
  const pruned: OfficerSuppressedMap = {};
  for (const [key, storedValue] of Object.entries(map)) {
    const [id, field] = key.split(":");
    if (id !== officerId) {
      pruned[key] = storedValue;
      continue;
    }
    if (currentValues[field] === storedValue) pruned[key] = storedValue;
  }
  return pruned;
}

export function useOfficerCorrections(
  feed: OfficerCorrectionFeed,
  executor: SqlExecutor,
  ownerId: string | undefined,
  officerId: string | null,
  currentValues: Record<string, string | null> | null,
): OfficerCorrectionState {
  const [suppressed, setSuppressed] = useState<OfficerSuppressedMap>({});
  const [phase, setPhase] = useState<OfficerCorrectionPhase>("idle");
  const [status, setStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mapLoaded = useRef(false);

  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    void readSuppressed(executor, ownerId)
      .then((map) => {
        if (active) {
          setSuppressed(map);
          mapLoaded.current = true;
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [executor, ownerId]);

  useEffect(() => {
    if (!ownerId || !mapLoaded.current || currentValues === null) return;
    const pruned = pruneSuppressed(suppressed, officerId ?? "", currentValues);
    if (Object.keys(pruned).length !== Object.keys(suppressed).length) {
      setSuppressed(pruned);
      void writeSuppressed(executor, ownerId, pruned).catch(() => undefined);
    }
  }, [executor, ownerId, officerId, currentValues, suppressed]);

  const submitCorrection = useCallback(
    async (field: string, value: string, reason: string) => {
      if (!officerId) return;
      setPhase("submitting");
      setErrorMessage(null);
      try {
        const result = await feed.submitCorrection(officerId, { field, reason });
        const key = `${officerId}:${field}`;
        const next = { ...suppressed, [key]: value };
        setSuppressed(next);
        if (ownerId) void writeSuppressed(executor, ownerId, next).catch(() => undefined);
        setStatus(result.status);
        setPhase("submitted");
      } catch (error) {
        if (error instanceof ApiError && error.kind === "cancelled") return;
        setPhase("error");
        setStatus(null);
        setErrorMessage(
          error instanceof ApiError
            ? error.kind === "not-found"
              ? "Directory corrections are not available right now (not found)."
              : error.kind === "validation" || error.kind === "forbidden"
                ? `The server rejected this correction (${error.kind}).`
                : `Could not file the correction (${error.kind}).`
            : "Could not file the correction.",
        );
      }
    },
    [feed, executor, ownerId, officerId, suppressed],
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setStatus(null);
    setErrorMessage(null);
  }, []);

  return { suppressed, phase, status, errorMessage, submitCorrection, reset };
}
