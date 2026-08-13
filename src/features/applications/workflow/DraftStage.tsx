import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AsyncSection } from "../../../components/common/AsyncSection";
import type {
  ApplicationDetail,
  ApplicationsEndpoint,
} from "../../../services/api/endpoints/applications";
import type { DownloadResult } from "../../../services/api/transport";
import type { DocumentActionPort } from "../../../services/storage/document-actions";
import type { SaveDownloadPort } from "../../../services/storage/save-download";
import { DraftDocumentReferences } from "./DraftDocumentReferences";
import { ResponseDocumentEditor } from "./ResponseDocumentEditor";
import { ResponseDocumentNavigator } from "./ResponseDocumentNavigator";
import { useResponseBlueprintWorkspace } from "./use-response-blueprint-workspace";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

export function DraftStage({
  applicationId,
  documentKey,
  endpoint,
  tenderDocuments,
  documentsEndpoint,
  savePort,
  documentActionPort,
}: {
  applicationId: string;
  documentKey?: string;
  endpoint: ApplicationsEndpoint;
  tenderDocuments?: ApplicationDetail["tender"]["documents"];
  documentsEndpoint?: {
    downloadTenderDocument: (
      id: string,
      signal?: AbortSignal,
    ) => Promise<DownloadResult>;
  };
  savePort?: SaveDownloadPort;
  documentActionPort?: DocumentActionPort;
}) {
  const navigate = useNavigate();
  const workspace = useResponseBlueprintWorkspace(endpoint, applicationId);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingUrl, setPendingUrl] = useState<string>();
  const [selectedDocumentKey, setSelectedDocumentKey] = useState(documentKey);
  const [pendingDocumentKey, setPendingDocumentKey] = useState<string>();

  useEffect(() => {
    setSelectedDocumentKey(documentKey);
  }, [applicationId, documentKey]);

  const requestNavigation = useCallback(
    (url: string) => {
      if (dirty) setPendingUrl(url);
      else navigate(url);
    },
    [dirty, navigate],
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
      else setSelectedDocumentKey(nextKey);
    },
    [dirty, selectedDocumentKey],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      if (event.key !== "Tab") return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [close]);

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="response-editor-title"
      className="fixed inset-0 z-50 flex min-h-0 flex-col bg-background text-foreground"
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
            : usableDocuments[0];
          const key = selected?.key ?? "";
          const responseDocs = {
            ...(payload.responseDocs ?? {}),
            ...(workspace.overlay.docs ?? {}),
          };
          const statuses = {
            ...(payload.responseDocStatus ?? {}),
            ...(workspace.overlay.status ?? {}),
          };
          if (usableDocuments.length === 0) {
            return (
              <p className="p-6 text-sm text-muted-foreground">
                No response documents are available yet.
              </p>
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
                    onClick={close}
                    className="rounded border border-border px-3 py-2 text-sm"
                  >
                    Close editor
                  </button>
                </header>
                <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] max-md:grid-cols-1">
                  <aside className="min-h-0 border-r border-border max-md:hidden">
                    <ResponseDocumentNavigator
                      documents={usableDocuments}
                      selectedKey=""
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
                <button
                  type="button"
                  onClick={close}
                  className="rounded border border-border px-3 py-2 text-sm"
                >
                  Close editor
                </button>
              </header>
              <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)_20rem] max-lg:grid-cols-[13rem_minmax(0,1fr)] max-md:grid-cols-1">
                <aside className="min-h-0 border-r border-border max-md:hidden">
                  <ResponseDocumentNavigator
                    documents={usableDocuments}
                    selectedKey={key}
                    responseDocs={responseDocs}
                    status={statuses}
                    onSelect={selectDocument}
                  />
                </aside>
                <ResponseDocumentEditor
                  key={key}
                  title={selected.title ?? "Response document"}
                  content={responseDocs[key] ?? ""}
                  status={statuses[key]}
                  staleGenerating={workspace.staleGenerating[key] ?? false}
                  onSave={(content) => workspace.save(key, content)}
                  onGenerate={() => workspace.generate(key)}
                  onRecheck={() => workspace.recheck()}
                  onDirtyChange={setDirty}
                  onDraftChange={setDraft}
                />
                <DraftDocumentReferences
                  selected={selected}
                  tenderDocuments={tenderDocuments}
                  documentsEndpoint={documentsEndpoint}
                  savePort={savePort}
                  documentActionPort={documentActionPort}
                />
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
                    if (nextKey) setSelectedDocumentKey(nextKey);
                    else if (url) navigate(url);
                  }}
                  onSave={async () => {
                    await workspace.save(key, draft);
                    const url = pendingUrl;
                    const nextKey = pendingDocumentKey;
                    setDirty(false);
                    setPendingUrl(undefined);
                    setPendingDocumentKey(undefined);
                    if (nextKey) setSelectedDocumentKey(nextKey);
                    else if (url) navigate(url);
                  }}
                />
              )}
            </>
          );
        }}
      </AsyncSection>
    </div>,
    document.body,
  );
}
