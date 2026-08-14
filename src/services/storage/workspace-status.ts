export type WorkspaceSyncPhase = "idle" | "syncing" | "failed";

export interface WorkspaceSyncSummary {
  phase: WorkspaceSyncPhase;
  pendingCount: number;
  conflictCount: number;
}

const EMPTY_SUMMARY: WorkspaceSyncSummary = {
  phase: "idle",
  pendingCount: 0,
  conflictCount: 0,
};

export class WorkspaceStatusStore {
  private summary: WorkspaceSyncSummary = EMPTY_SUMMARY;
  private readonly listeners = new Set<() => void>();

  getSnapshot = (): WorkspaceSyncSummary => this.summary;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  update(next: Partial<WorkspaceSyncSummary>): void {
    const summary = { ...this.summary, ...next };
    if (
      summary.phase === this.summary.phase &&
      summary.pendingCount === this.summary.pendingCount &&
      summary.conflictCount === this.summary.conflictCount
    ) {
      return;
    }
    this.summary = summary;
    this.listeners.forEach((listener) => listener());
  }
}

export const EMPTY_WORKSPACE_SYNC_SUMMARY = EMPTY_SUMMARY;
