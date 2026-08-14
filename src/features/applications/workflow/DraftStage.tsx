import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelLeft, PanelRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AsyncSection } from "../../../components/common/AsyncSection";
import type {
  ApplicationDetail,
  ApplicationsEndpoint,
} from "../../../services/api/endpoints/applications";
import { ApiError } from "../../../services/api/errors";
import type { DownloadResult } from "../../../services/api/transport";
import type { SaveDownloadPort } from "../../../services/storage/save-download";
import {
  createTauriResponseDocStore,
  type ResponseDocConflictEntry,
  type ResponseDocConflictResolution,
  type ResponseDocLocalStore,
  type ResponseDocVersionEntry,
} from "../../../services/storage/response-doc-store";
import { DraftDocumentReferences } from "./DraftDocumentReferences";
import { ResponseDocumentEditor } from "./ResponseDocumentEditor";
import { ResponseDocumentList } from "./ResponseDocumentList";
import { ResponseDocumentNavigator } from "./ResponseDocumentNavigator";
import { useResponseBlueprintWorkspace } from "./use-response-blueprint-workspace";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";
import { useWorkspaceExport } from "./use-workspace-export";
import type { WorkspaceOwnerId } from "../../../services/storage/workspace-owner";

const DRAFT_PERSIST_DEBOUNCE_MS = 800;

const unavailableLocalStore: ResponseDocLocalStore = {
  persistDraft: async () => undefined,
  loadDraft: async () => undefined,
  clearDraft: async () => undefined,
  snapshotVersion: async () => undefined,
  listVersions: async () => [],
  enqueueSave: async () => undefined,
  markSaveSynced: async () => undefined,
  listPendingSaveKeys: async () => [],
  replayPendingSaves: async () => 0,
  listConflicts: async () => [],
  resolveConflict: async () => "",
};

export function DraftStage({
  applicationId,
  documentKey,
  endpoint,
  tenderDocuments,
  tenderId,
  documentsEndpoint,
  savePort,
  localStore: injectedLocalStore,
  workspaceOwner,
  onNavigate,
}: {
  applicationId: string;
  documentKey?: string;
  endpoint: ApplicationsEndpoint;
  tenderDocuments?: ApplicationDetail["tender"]["documents"];
  tenderId?: string;
  documentsEndpoint?: {
    downloadTenderDocument: (
      id: string,
      signal?: AbortSignal,
    ) => Promise<DownloadResult>;
  };
  savePort?: SaveDownloadPort;
  /** Slice 10 — local-first drafting store; fakes in tests. */
  localStore?: ResponseDocLocalStore;
  workspaceOwner?: WorkspaceOwnerId;
  onNavigate?: (url: string) => void;
}) {
  const localStore = useMemo(
    () =>
      injectedLocalStore ??
      (workspaceOwner
        ? createTauriResponseDocStore(workspaceOwner)
        : unavailableLocalStore),
    [injectedLocalStore, workspaceOwner],
  );
  const navigate = useNavigate();
  const workspace = useResponseBlueprintWorkspace(endpoint, applicationId);
  const exporter = useWorkspaceExport(endpoint, applicationId, savePort);
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingUrl, setPendingUrl] = useState<string>();
  const [selectedDocumentKey, setSelectedDocumentKey] = useState(documentKey);
  const [pendingDocumentKey, setPendingDocumentKey] = useState<string>();
  const [localDrafts, setLocalDrafts] = useState<
    Record<string, string | undefined>
  >({});
  const [pendingSyncKeys, setPendingSyncKeys] = useState<Set<string>>(
    new Set(),
  );
  const [versions, setVersions] = useState<
    Record<string, ResponseDocVersionEntry[]>
  >({});
  const [conflicts, setConflicts] = useState<
    Record<string, ResponseDocConflictEntry | undefined>
  >({});
  const [showDocuments, setShowDocuments] = useState(true);
  const [showReferences, setShowReferences] = useState(true);

  useEffect(() => {
    setSelectedDocumentKey(documentKey);
  }, [applicationId, documentKey]);

  const requestNavigation = useCallback(
    (url: string) => {
      if (dirty) setPendingUrl(url);
      else (onNavigate ?? navigate)(url);
    },
    [dirty, navigate, onNavigate],
  );

  const close = useCallback(() => {
    requestNavigation(
      `/applications/${encodeURIComponent(applicationId)}/plan`,
    );
  }, [applicationId, requestNavigation]);

  const selectDocument = useCallback(
    (nextKey: string) => {
      if (nextKey === selectedDocumentKey) return;
      if (dirty) setPendingDocumentKey(nextKey);
      else {
        setSelectedDocumentKey(nextKey);
        (onNavigate ?? navigate)(
          `/applications/${encodeURIComponent(applicationId)}/draft/${encodeURIComponent(nextKey)}`,
        );
      }
    },
    [dirty, selectedDocumentKey, applicationId, navigate, onNavigate],
  );

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  /**
   * LD-2 — flush queued saves through the parent. Kept in a ref-backed
   * callback so effects never re-run on the workspace's per-render identity.
   */
  const replayPendingSaves = useCallback(async () => {
    try {
      await localStore.replayPendingSaves(
        async (_appId, targetKey, content) => {
          await workspaceRef.current.save(targetKey, content);
        },
        async (_appId, targetKey) => {
          const payload = await endpoint.getResponseBlueprint(applicationId);
          return payload.responseDocs?.[targetKey];
        },
      );
      setPendingSyncKeys(
        new Set(await localStore.listPendingSaveKeys(applicationId)),
      );
      if (selectedDocumentKey) {
        const conflictRows = await localStore.listConflicts(
          applicationId,
          selectedDocumentKey,
        );
        setConflicts((previous) => ({
          ...previous,
          [selectedDocumentKey]: conflictRows[0],
        }));
      }
    } catch {
      // Best effort — the queue stays pending for a later retry.
    }
  }, [localStore, endpoint, applicationId, selectedDocumentKey]);

  useEffect(() => {
    void replayPendingSaves();
  }, [replayPendingSaves]);

  /**
   * LD-1/LD-3 — recover the local draft, version history, and outstanding
   * queued saves whenever the selected document changes.
   */
  useEffect(() => {
    if (!selectedDocumentKey) return;
    let cancelled = false;
    void (async () => {
      try {
        const [draftValue, versionRows, pendingKeys, conflictRows] =
          await Promise.all([
            localStore.loadDraft(applicationId, selectedDocumentKey),
            localStore.listVersions(applicationId, selectedDocumentKey),
            localStore.listPendingSaveKeys(applicationId),
            localStore.listConflicts(applicationId, selectedDocumentKey),
          ]);
        if (cancelled) return;
        setLocalDrafts((previous) => ({
          ...previous,
          [selectedDocumentKey]: draftValue,
        }));
        setVersions((previous) => ({
          ...previous,
          [selectedDocumentKey]: versionRows,
        }));
        setPendingSyncKeys(new Set(pendingKeys));
        setConflicts((previous) => ({
          ...previous,
          [selectedDocumentKey]: conflictRows[0],
        }));
      } catch {
        // Local store unavailable — local-first features degrade silently.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [localStore, applicationId, selectedDocumentKey]);

  /** LD-1 — persist the current draft locally, debounced, while it is dirty. */
  useEffect(() => {
    if (!selectedDocumentKey || !dirty) return;
    const timer = setTimeout(() => {
      void localStore
        .persistDraft(applicationId, selectedDocumentKey, draft)
        .catch(() => {});
    }, DRAFT_PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [localStore, applicationId, selectedDocumentKey, draft, dirty]);

  return (
    <div
      role="region"
      aria-labelledby="response-editor-title"
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
    >
      <AsyncSection
        state={workspace.state}
        subject="the response documents"
        onRetry={workspace.reload}
      >
        {(payload) => {
          const blueprint = workspace.overlay.blueprint ?? payload.blueprint;
          const documents = blueprint?.responseDocuments ?? [];
          const usableDocuments = documents.filter(
            (item): item is typeof item & { key: string } => Boolean(item.key),
          );
          const selected = selectedDocumentKey
            ? usableDocuments.find((item) => item.key === selectedDocumentKey)
            : undefined;
          const key = selected?.key ?? "";
          const responseDocs = {
            ...(payload.responseDocs ?? {}),
            ...(workspace.overlay.docs ?? {}),
          };
          const statuses = {
            ...(payload.responseDocStatus ?? {}),
            ...(workspace.overlay.status ?? {}),
          };
          /**
           * LD-1..LD-3 — save through the parent, then update local
           * bookkeeping. On offline/timeout the content is queued locally
           * instead of erroring, and the editor reports "pending sync".
           */
          async function saveWithLocalStore(
            targetKey: string,
            content: string,
            allowOfflineQueue = true,
          ): Promise<void> {
            const previousContent = responseDocs[targetKey] ?? "";
            // The durable local draft and idempotent queue entry are committed
            // before the network request. A process/network failure after this
            // point therefore cannot lose the user's exact content.
            await localStore.persistDraft(applicationId, targetKey, content);
            await localStore.enqueueSave(
              applicationId,
              targetKey,
              content,
              previousContent,
            );
            setPendingSyncKeys((previous) => new Set(previous).add(targetKey));
            try {
              await workspace.save(targetKey, content);
            } catch (cause) {
              if (
                allowOfflineQueue &&
                cause instanceof ApiError &&
                (cause.kind === "offline" || cause.kind === "timeout")
              ) {
                try {
                  return;
                } catch {
                  // Local store unavailable — surface the original error.
                }
              }
              throw cause;
            }
            try {
              await localStore.markSaveSynced(applicationId, targetKey);
              await localStore.clearDraft(applicationId, targetKey);
              setLocalDrafts((previous) => ({
                ...previous,
                [targetKey]: undefined,
              }));
              setPendingSyncKeys((previous) => {
                const next = new Set(previous);
                next.delete(targetKey);
                return next;
              });
              if (previousContent !== "" && previousContent !== content) {
                await localStore.snapshotVersion(
                  applicationId,
                  targetKey,
                  previousContent,
                  "save",
                );
                const nextVersions = await localStore.listVersions(
                  applicationId,
                  targetKey,
                );
                setVersions((previous) => ({
                  ...previous,
                  [targetKey]: nextVersions,
                }));
              }
            } catch {
              // Local bookkeeping failure must not fail an already-saved doc.
            }
            void replayPendingSaves();
          }
          const localDraftValue = localDrafts[key];
          const hasLocalDraft =
            localDraftValue !== undefined &&
            localDraftValue !== "" &&
            localDraftValue !== responseDocs[key];
          if (usableDocuments.length === 0) {
            return (
              <p className="p-6 text-sm text-muted-foreground">
                No response documents are available yet.
              </p>
            );
          }
          if (!selected && !selectedDocumentKey) {
            return (
              <>
                <header className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Response editor
                    </p>
                    <h2
                      id="response-editor-title"
                      className="text-lg font-semibold"
                    >
                      Response documents
                    </h2>
                  </div>
                  <button
                    type="button"
                    aria-label="Close editor"
                    title="Close editor"
                    onClick={close}
                    className="flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <ResponseDocumentList
                    documents={usableDocuments}
                    responseDocs={responseDocs}
                    status={statuses}
                    onSelect={selectDocument}
                    onGenerateAll={workspace.generateMany}
                  />
                </div>
              </>
            );
          }
          if (!selected) {
            return (
              <>
                <header className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Response editor
                    </p>
                    <h2
                      id="response-editor-title"
                      className="text-lg font-semibold"
                    >
                      Document no longer in this response plan
                    </h2>
                  </div>
                  <button
                    type="button"
                    aria-label="Close editor"
                    title="Close editor"
                    onClick={close}
                    className="flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </header>
                <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] max-md:grid-cols-1">
                  <aside className="min-h-0 border-r border-border max-md:hidden">
                    <ResponseDocumentNavigator
                      documents={usableDocuments}
                      selectedKey=""
                      dirtyKey={dirty ? selectedDocumentKey : undefined}
                      responseDocs={responseDocs}
                      status={statuses}
                      onSelect={selectDocument}
                    />
                  </aside>
                  <div className="flex items-center justify-center p-8 text-center">
                    <div className="max-w-md">
                      <p className="text-sm text-muted-foreground">
                        The selected document is not part of the latest tender
                        response blueprint. Choose another response document or
                        return to the preparation plan.
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedDocumentKey(usableDocuments[0].key)
                        }
                        className="mt-4 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                      >
                        Open {usableDocuments[0].title ?? "first document"}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            );
          }
          return (
            <>
              <header className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Response editor
                  </p>
                  <h2
                    id="response-editor-title"
                    className="truncate text-lg font-semibold"
                  >
                    {selected.title ?? "Response document"}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={
                      showDocuments ? "Hide documents" : "Show documents"
                    }
                    title={showDocuments ? "Hide documents" : "Show documents"}
                    aria-pressed={showDocuments}
                    onClick={() => setShowDocuments((value) => !value)}
                    className={`flex size-9 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring ${showDocuments ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
                  >
                    <PanelLeft aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={
                      showReferences ? "Hide references" : "Show references"
                    }
                    title={
                      showReferences ? "Hide references" : "Show references"
                    }
                    aria-pressed={showReferences}
                    onClick={() => setShowReferences((value) => !value)}
                    className={`flex size-9 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring ${showReferences ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
                  >
                    <PanelRight aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Close editor"
                    title="Close editor"
                    onClick={close}
                    className="flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </header>
              <div
                className={`grid min-h-0 flex-1 ${showDocuments && showReferences ? "grid-cols-[16rem_minmax(0,1fr)_20rem]" : showDocuments ? "grid-cols-[16rem_minmax(0,1fr)]" : showReferences ? "grid-cols-[minmax(0,1fr)_20rem]" : "grid-cols-1"} max-lg:grid-cols-[minmax(0,1fr)]`}
              >
                {showDocuments && (
                  <aside className="min-h-0 border-r border-border max-lg:hidden">
                    <ResponseDocumentNavigator
                      documents={usableDocuments}
                      selectedKey={key}
                      dirtyKey={dirty ? key : undefined}
                      responseDocs={responseDocs}
                      status={statuses}
                      onSelect={selectDocument}
                    />
                  </aside>
                )}
                <ResponseDocumentEditor
                  key={key}
                  title={selected.title ?? "Response document"}
                  content={responseDocs[key] ?? ""}
                  status={statuses[key]}
                  staleGenerating={workspace.staleGenerating[key] ?? false}
                  restoredDraft={hasLocalDraft ? localDraftValue : undefined}
                  hasLocalDraft={hasLocalDraft}
                  pendingSync={pendingSyncKeys.has(key)}
                  conflict={conflicts[key]}
                  onSyncNow={() => replayPendingSaves()}
                  onResolveConflict={async (
                    resolution: ResponseDocConflictResolution,
                    mergedContent?: string,
                  ) => {
                    const conflict = conflicts[key];
                    if (!conflict) return;
                    await localStore.resolveConflict(
                      conflict.id,
                      resolution,
                      mergedContent,
                      async (_appId, targetKey, content) => {
                        await workspace.save(targetKey, content);
                      },
                    );
                    setConflicts((previous) => ({
                      ...previous,
                      [key]: undefined,
                    }));
                    setPendingSyncKeys((previous) => {
                      const next = new Set(previous);
                      next.delete(key);
                      return next;
                    });
                    setLocalDrafts((previous) => ({
                      ...previous,
                      [key]: undefined,
                    }));
                    workspace.reload();
                  }}
                  versions={versions[key]}
                  onRestoreVersion={(content) => setDraft(content)}
                  onDiscardLocalDraft={() => {
                    void localStore
                      .clearDraft(applicationId, key)
                      .catch(() => {});
                    setLocalDrafts((previous) => ({
                      ...previous,
                      [key]: undefined,
                    }));
                  }}
                  onSave={(content) => saveWithLocalStore(key, content)}
                  onSaveBeforeExport={(content) =>
                    saveWithLocalStore(key, content, false)
                  }
                  onGenerate={(prompt) => workspace.generate(key, prompt)}
                  onRecheck={() => workspace.recheck()}
                  onDirtyChange={setDirty}
                  onDraftChange={setDraft}
                  exportState={exporter.state}
                  exportError={exporter.error}
                  onExport={(format) => exporter.exportPackage(format)}
                />
                {showReferences && (
                  <DraftDocumentReferences
                    selected={selected}
                    tenderDocuments={tenderDocuments}
                    tenderId={tenderId}
                    documentsEndpoint={documentsEndpoint}
                    savePort={savePort}
                    onOpenDocument={(id) => {
                      if (tenderId) {
                        requestNavigation(
                          `/tenders/${encodeURIComponent(tenderId)}/documents/${encodeURIComponent(id)}`,
                        );
                      }
                    }}
                  />
                )}
              </div>
              {(pendingUrl || pendingDocumentKey) && (
                <UnsavedChangesDialog
                  onStay={() => {
                    setPendingUrl(undefined);
                    setPendingDocumentKey(undefined);
                  }}
                  onDiscard={() => {
                    const url = pendingUrl;
                    const nextKey = pendingDocumentKey;
                    setDirty(false);
                    setPendingUrl(undefined);
                    setPendingDocumentKey(undefined);
                    if (nextKey) selectDocument(nextKey);
                    else if (url) (onNavigate ?? navigate)(url);
                  }}
                  onSave={async () => {
                    await saveWithLocalStore(key, draft);
                    const url = pendingUrl;
                    const nextKey = pendingDocumentKey;
                    setDirty(false);
                    setPendingUrl(undefined);
                    setPendingDocumentKey(undefined);
                    if (nextKey) selectDocument(nextKey);
                    else if (url) (onNavigate ?? navigate)(url);
                  }}
                />
              )}
            </>
          );
        }}
      </AsyncSection>
    </div>
  );
}
