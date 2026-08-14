import { useEffect, useState } from "react";
import type { ZodType, ZodTypeDef } from "zod";
import type { WorkspaceCacheEntity } from "../services/storage/cache-policy";
import { useWorkspaceRuntime } from "../services/storage/workspace-runtime-context";
import { ApiError } from "../services/api/errors";
import type { AsyncState } from "./use-async";

export function useWorkspaceAsync<T>(options: {
  key: string;
  schema: ZodType<T, ZodTypeDef, unknown>;
  entity: WorkspaceCacheEntity;
  load: (signal: AbortSignal) => Promise<T>;
  deps: readonly unknown[];
}): AsyncState<T> & {
  reload: () => void;
  stale: boolean;
  refreshing: boolean;
  refreshFailed: boolean;
} {
  const workspace = useWorkspaceRuntime();
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [reloadRequest, setReloadRequest] = useState({ key: "", nonce: 0 });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const force = reloadRequest.key === options.key && reloadRequest.nonce > 0;
    setState((current) =>
      force && current.status === "ready" ? current : { status: "loading" },
    );
    setRefreshing(force);
    setRefreshFailed(false);
    const fetcher = () => options.load(controller.signal);
    const request: Promise<{
      value: T;
      stale: boolean;
      refreshing: boolean;
      refreshFailed: boolean;
    }> = workspace
      ? workspace.queries
          .load({
            key: options.key,
            schema: options.schema,
            entity: options.entity,
            fetcher,
            force,
            onUpdate: (value) => {
              if (active) {
                setState({ status: "ready", value });
                setStale(false);
                setRefreshing(false);
                setRefreshFailed(false);
              }
            },
            onRefreshError: () => {
              if (active) {
                setRefreshing(false);
                setRefreshFailed(true);
              }
            },
          })
          .then((result) => ({
            value: result.value,
            stale: result.cached?.stale ?? false,
            refreshing: result.refreshing,
            refreshFailed: result.refreshError !== undefined,
          }))
      : fetcher().then((value) => ({
          value,
          stale: false,
          refreshing: false,
          refreshFailed: false,
        }));
    request
      .then((result) => {
        if (!active) return;
        setState({ status: "ready", value: result.value });
        setStale(result.stale);
        setRefreshing(result.refreshing);
        setRefreshFailed(result.refreshFailed);
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.kind === "cancelled") return;
        if (active) setState({ status: "error", error });
      });
    return () => {
      active = false;
      controller.abort();
    };
    // Callers provide the semantic dependencies; the inline loader is not one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...options.deps, options.key, workspace, reloadRequest.nonce]);

  return {
    ...state,
    stale,
    refreshing,
    refreshFailed,
    reload: () =>
      setReloadRequest((current) => ({
        key: options.key,
        nonce: current.nonce + 1,
      })),
  };
}
