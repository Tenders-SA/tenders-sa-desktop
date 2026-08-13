import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AsyncSection } from "../../../components/common/AsyncSection";
import type { ApplicationsEndpoint } from "../../../services/api/endpoints/applications";
import { ResponseDocumentEditor } from "./ResponseDocumentEditor";
import { ResponseDocumentNavigator } from "./ResponseDocumentNavigator";
import { useResponseBlueprintWorkspace } from "./use-response-blueprint-workspace";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";
import { draftDocumentPath } from "./document-route";

export function DraftStage({
  applicationId,
  documentKey,
  endpoint,
}: {
  applicationId: string;
  documentKey?: string;
  endpoint: ApplicationsEndpoint;
}) {
  const navigate = useNavigate();
  const workspace = useResponseBlueprintWorkspace(endpoint, applicationId);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingUrl, setPendingUrl] = useState<string>();

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
          const documents = payload.blueprint?.responseDocuments ?? [];
          const selected =
            documents.find((item) => item.key === documentKey) ?? documents[0];
          const key = selected?.key ?? "";
          const responseDocs = {
            ...(payload.responseDocs ?? {}),
            ...(workspace.overlay.docs ?? {}),
          };
          const statuses = {
            ...(payload.responseDocStatus ?? {}),
            ...(workspace.overlay.status ?? {}),
          };
          if (!selected) {
            return (
              <p className="p-6 text-sm text-muted-foreground">
                No response documents are available yet.
              </p>
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
                    documents={documents}
                    selectedKey={key}
                    responseDocs={responseDocs}
                    status={statuses}
                    onSelect={(nextKey) =>
                      requestNavigation(
                        draftDocumentPath(applicationId, nextKey),
                      )
                    }
                  />
                </aside>
                <ResponseDocumentEditor
                  key={key}
                  title={selected.title ?? "Response document"}
                  content={responseDocs[key] ?? ""}
                  generating={statuses[key]?.state === "generating"}
                  onSave={(content) => workspace.save(key, content)}
                  onGenerate={() => workspace.generate(key)}
                  onDirtyChange={setDirty}
                  onDraftChange={setDraft}
                />
                <aside
                  className="min-h-0 overflow-y-auto border-l border-border bg-card p-5 max-lg:hidden"
                  aria-label="Document references"
                >
                  <h3 className="text-sm font-semibold">Drafting brief</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {selected.brief ??
                      "No document-specific brief is recorded."}
                  </p>
                  {selected.requiredBy && (
                    <p className="mt-4 text-sm">
                      <span className="font-medium">Required by:</span>{" "}
                      {selected.requiredBy}
                    </p>
                  )}
                  <p className="mt-5 text-xs text-muted-foreground">
                    Verify generated content against the official tender
                    documents before submission.
                  </p>
                </aside>
              </div>
              {pendingUrl && (
                <UnsavedChangesDialog
                  onStay={() => setPendingUrl(undefined)}
                  onDiscard={() => {
                    const url = pendingUrl;
                    setDirty(false);
                    setPendingUrl(undefined);
                    navigate(url);
                  }}
                  onSave={async () => {
                    await workspace.save(key, draft);
                    const url = pendingUrl;
                    setDirty(false);
                    setPendingUrl(undefined);
                    navigate(url);
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
