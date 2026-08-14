import { useMemo, type ReactNode } from "react";
import { tauriSqlExecutor } from "../../db/tauri-sql-executor";
import { tauriNativeCrypto } from "./native-crypto";
import { LocalFirstQueryClient } from "./local-first-query";
import { WorkspaceCache } from "./workspace-cache";
import type { WorkspaceOwnerId } from "./workspace-owner";
import {
  DocumentWorkspace,
  tauriWorkspaceFilePort,
} from "./document-workspace";
import { WorkspaceStatusStore } from "./workspace-status";
import {
  WorkspaceRuntimeContext,
  type WorkspaceRuntime,
} from "./workspace-runtime-context";

export function WorkspaceRuntimeProvider({
  ownerId,
  children,
}: {
  ownerId?: WorkspaceOwnerId;
  children: ReactNode;
}) {
  const runtime = useMemo<WorkspaceRuntime | undefined>(() => {
    if (!ownerId) return undefined;
    const cache = new WorkspaceCache(
      tauriSqlExecutor,
      tauriNativeCrypto,
      ownerId,
    );
    return {
      ownerId,
      queries: new LocalFirstQueryClient(cache),
      documents: new DocumentWorkspace(
        tauriSqlExecutor,
        tauriWorkspaceFilePort,
        ownerId,
      ),
      status: new WorkspaceStatusStore(),
    };
  }, [ownerId]);

  return (
    <WorkspaceRuntimeContext.Provider value={runtime}>
      {children}
    </WorkspaceRuntimeContext.Provider>
  );
}
