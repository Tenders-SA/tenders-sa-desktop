import { useEffect, useState } from "react";
import { useAsync } from "../../../hooks/use-async";
import type {
  BlueprintPayload,
  GenerateResponseDocResult,
  ResponseBlueprint,
  ResponseDocSaveResult,
} from "../../../services/api/endpoints/applications";
import { describeGenerateError } from "./response-doc-status";

const POLL_INTERVAL_MS = 4000;
const POLL_MAX_TICKS = 15;

export interface ResponseBlueprintWorkspaceEndpoint {
  getResponseBlueprint: (
    id: string,
    signal?: AbortSignal,
  ) => Promise<BlueprintPayload>;
  generateResponseDocument: (
    id: string,
    key: string,
    prompt?: string,
    signal?: AbortSignal,
  ) => Promise<GenerateResponseDocResult>;
  saveResponseDocument: (
    id: string,
    key: string,
    content: string,
    signal?: AbortSignal,
  ) => Promise<ResponseDocSaveResult>;
}

export interface ResponseBlueprintOverlay {
  blueprint?: ResponseBlueprint | null;
  docs?: Record<string, string>;
  status?: Record<string, { state?: string; error?: string }>;
}

/** Merges a fresh blueprint payload over the last-known overlay (RH-3). */
function mergeBlueprintOverlay(
  previous: ResponseBlueprintOverlay,
  fresh: BlueprintPayload,
): ResponseBlueprintOverlay {
  return {
    blueprint:
      fresh.blueprint === undefined ? previous.blueprint : fresh.blueprint,
    docs: { ...previous.docs, ...(fresh.responseDocs ?? {}) },
    status: {
      ...previous.status,
      ...(fresh.responseDocStatus ?? {}),
    },
  };
}

/** One read, overlay and bounded-generation-refresh owner for Plan and Draft. */
export function useResponseBlueprintWorkspace(
  endpoint: ResponseBlueprintWorkspaceEndpoint,
  applicationId: string,
) {
  const state = useAsync(
    (signal) => endpoint.getResponseBlueprint(applicationId, signal),
    [endpoint, applicationId],
  );
  const [overlay, setOverlay] = useState<ResponseBlueprintOverlay>({});
  const [pendingKeys, setPendingKeys] = useState<string[]>([]);
  const [staleGenerating, setStaleGenerating] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    if (pendingKeys.length === 0) return;
    let remaining = POLL_MAX_TICKS;
    const interval = setInterval(() => {
      remaining -= 1;
      void endpoint
        .getResponseBlueprint(applicationId)
        .then((fresh) => {
          setOverlay((previous) => mergeBlueprintOverlay(previous, fresh));
          const stillGenerating = pendingKeys.filter(
            (key) => fresh.responseDocStatus?.[key]?.state === "generating",
          );
          if (stillGenerating.length > 0 && remaining <= 0) {
            setStaleGenerating((previousFlags) => {
              const next = { ...previousFlags };
              for (const key of stillGenerating) next[key] = true;
              return next;
            });
            setPendingKeys([]);
          } else if (stillGenerating.length === 0) {
            setStaleGenerating((previousFlags) => {
              const next = { ...previousFlags };
              for (const key of pendingKeys) delete next[key];
              return next;
            });
            setPendingKeys([]);
          }
        })
        .catch(() => {
          // A failed refresh does not erase the last known document state.
        });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [endpoint, applicationId, pendingKeys]);

  /** Marks a set of keys as generating and starts the bounded refresh. */
  function markGenerating(keys: string[]) {
    setOverlay((previous) => ({
      ...previous,
      status: {
        ...previous.status,
        ...Object.fromEntries(
          keys.map((key) => [key, { state: "generating" }]),
        ),
      },
    }));
    setStaleGenerating((previousFlags) => {
      const next = { ...previousFlags };
      for (const key of keys) delete next[key];
      return next;
    });
    setPendingKeys((previous) => [...new Set([...previous, ...keys])]);
  }

  async function generate(key: string, prompt?: string): Promise<void> {
    await endpoint.generateResponseDocument(applicationId, key, prompt);
    markGenerating([key]);
  }

  /**
   * Batch-generates every given key in order, one request each, and returns a
   * per-key result map (`undefined` = accepted, string = error copy). Failures
   * are captured per key via the shared `describeGenerateError` (RA-1).
   */
  async function generateMany(
    keys: string[],
  ): Promise<Record<string, string | undefined>> {
    const results: Record<string, string | undefined> = {};
    const accepted: string[] = [];
    for (const key of keys) {
      try {
        await endpoint.generateResponseDocument(applicationId, key);
        results[key] = undefined;
        accepted.push(key);
      } catch (error) {
        results[key] = describeGenerateError(error);
      }
    }
    if (accepted.length > 0) markGenerating(accepted);
    return results;
  }

  async function save(key: string, content: string): Promise<void> {
    await endpoint.saveResponseDocument(applicationId, key, content);
    setOverlay((previous) => ({
      ...previous,
      docs: { ...previous.docs, [key]: content },
    }));
  }

  /**
   * One direct blueprint read, merged into the overlay, to recover a document
   * whose bounded generation window ended while it was still generating
   * (RH-3). Returns `false` when the read fails so the caller can say so.
   */
  async function recheck(): Promise<boolean> {
    try {
      const fresh = await endpoint.getResponseBlueprint(applicationId);
      setOverlay((previous) => mergeBlueprintOverlay(previous, fresh));
      setStaleGenerating((previousFlags) => {
        const next = { ...previousFlags };
        for (const key of Object.keys(next)) {
          if (fresh.responseDocStatus?.[key]?.state !== "generating") {
            delete next[key];
          }
        }
        return next;
      });
      return true;
    } catch {
      return false;
    }
  }

  return {
    state,
    overlay,
    staleGenerating,
    reload: state.reload,
    generate,
    generateMany,
    save,
    recheck,
  };
}
