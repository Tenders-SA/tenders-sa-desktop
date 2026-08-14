import { createContext, useContext } from "react";
import type { DocumentWorkspace } from "./document-workspace";
import type { LocalFirstQueryClient } from "./local-first-query";
import type { WorkspaceOwnerId } from "./workspace-owner";
import type { WorkspaceStatusStore } from "./workspace-status";

export interface WorkspaceRuntime {
  ownerId: WorkspaceOwnerId;
  queries: LocalFirstQueryClient;
  documents: DocumentWorkspace;
  status: WorkspaceStatusStore;
}

export const WorkspaceRuntimeContext = createContext<
  WorkspaceRuntime | undefined
>(undefined);

export function useWorkspaceRuntime(): WorkspaceRuntime | undefined {
  return useContext(WorkspaceRuntimeContext);
}
