import { useEffect, useState } from "react";
import { useAsync } from "../../../hooks/use-async";
import type {
  BlueprintPayload,
  GenerateResponseDocResult,
  ResponseDocSaveResult,
} from "../../../services/api/endpoints/applications";

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
  docs?: Record<string, string>;
  status?: Record<string, { state?: string; error?: string }>;
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

  useEffect(() => {
    if (pendingKeys.length === 0) return;
    let remaining = POLL_MAX_TICKS;
    const interval = setInterval(() => {
      remaining -= 1;
      void endpoint
        .getResponseBlueprint(applicationId)
        .then((fresh) => {
          setOverlay((previous) => ({
            docs: { ...previous.docs, ...(fresh.responseDocs ?? {}) },
            status: {
              ...previous.status,
              ...(fresh.responseDocStatus ?? {}),
            },
          }));
          const stillGenerating = pendingKeys.some(
            (key) => fresh.responseDocStatus?.[key]?.state === "generating",
          );
          if (!stillGenerating || remaining <= 0) setPendingKeys([]);
        })
        .catch(() => {
          // A failed refresh does not erase the last known document state.
        });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [endpoint, applicationId, pendingKeys]);

  async function generate(key: string): Promise<void> {
    await endpoint.generateResponseDocument(applicationId, key);
    setOverlay((previous) => ({
      ...previous,
      status: { ...previous.status, [key]: { state: "generating" } },
    }));
    setPendingKeys((previous) =>
      previous.includes(key) ? previous : [...previous, key],
    );
  }

  async function save(key: string, content: string): Promise<void> {
    await endpoint.saveResponseDocument(applicationId, key, content);
    setOverlay((previous) => ({
      ...previous,
      docs: { ...previous.docs, [key]: content },
    }));
  }

  return {
    state,
    overlay,
    reload: state.reload,
    generate,
    save,
  };
}
