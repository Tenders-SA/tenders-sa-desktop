/**
 * One response-document row in the Response Blueprint panel, with the
 * authoring actions (Slice 4, R-A-1..R-A-5): Generate, Edit/Save, Regenerate,
 * Retry.
 *
 * Mutations happen only on an explicit human press (R-W-7); the parent's 202
 * idempotency protects a re-press from starting a second AI job. All failure
 * copy is component-owned — `ApiError.message` and the parent's
 * `blockedReason` are never shown verbatim (describe-error docblock).
 */

import { useState } from "react";
import { ApiError } from "../../../services/api/errors";
import { describeApiError } from "../../../services/api/describe-error";
import type {
  GenerateResponseDocResult,
  ResponseBlueprintDoc,
  ResponseDocSaveResult,
} from "../../../services/api/endpoints/applications";

export interface ResponseBlueprintDocRowProps {
  doc: ResponseBlueprintDoc;
  /** Merged status (fetched payload ∪ panel overlay). */
  status: { state?: string; error?: string; isFallback?: boolean };
  hasContent: boolean;
  /** Merged saved content (fetched payload ∪ panel overlay). */
  content?: string;
  endpoint: {
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
  };
  applicationId: string;
  /** 202 accepted: the panel marks the key generating and starts the bounded refresh. */
  onGenerateAccepted: (key: string) => void;
  /** Save succeeded: the panel records the content so the row reads "Saved". */
  onSaved: (key: string, content: string) => void;
}

type ActionState =
  | { status: "idle" }
  | { status: "working" }
  | { status: "error"; message: string };

export function ResponseBlueprintDocRow({
  doc,
  status,
  hasContent,
  content,
  endpoint,
  applicationId,
  onGenerateAccepted,
  onSaved,
}: ResponseBlueprintDocRowProps) {
  const key = doc.key ?? "";
  const title = doc.title ?? "Response document";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [action, setAction] = useState<ActionState>({ status: "idle" });

  const generating = status.state === "generating";
  const failed = status.state === "failed";
  const working = action.status === "working";
  const chip = docStatusChip(status, hasContent);

  function startEdit() {
    setDraft(content ?? "");
    setEditing(true);
    setAction({ status: "idle" });
  }

  function cancelEdit() {
    setEditing(false);
    setAction({ status: "idle" });
  }

  function generateNow() {
    setAction({ status: "working" });
    endpoint
      .generateResponseDocument(applicationId, key)
      .then(() => {
        setAction({ status: "idle" });
        onGenerateAccepted(key);
      })
      .catch((error: unknown) => {
        setAction({ status: "error", message: describeGenerateError(error) });
      });
  }

  function saveNow() {
    setAction({ status: "working" });
    endpoint
      .saveResponseDocument(applicationId, key, draft)
      .then(() => {
        setAction({ status: "idle" });
        setEditing(false);
        onSaved(key, draft);
      })
      .catch((error: unknown) => {
        const described = describeApiError(error, "this document");
        setAction({ status: "error", message: described.message });
      });
  }

  return (
    <li className="rounded border border-border p-2.5">
      <span className="flex flex-wrap items-baseline gap-2 text-sm text-foreground">
        {title}
        {doc.mandatory && <span className="text-destructive">*</span>}
        {chip && <span className={chip.className}>{chip.label}</span>}
      </span>
      {doc.brief && (
        <span className="block text-xs text-muted-foreground">{doc.brief}</span>
      )}
      {doc.requiredBy && (
        <span className="block text-xs text-muted-foreground">
          Required by: {doc.requiredBy}
        </span>
      )}
      {status.error && (
        <span className="block text-xs text-destructive">{status.error}</span>
      )}

      {editing ? (
        <div className="mt-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label={`Edit ${title}`}
            className="min-h-32 w-full rounded border border-border bg-background p-2 text-sm text-foreground"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={saveNow}
              disabled={working}
              aria-label={`Save ${title}`}
              className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
            >
              {working ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={working}
              aria-label={`Cancel editing ${title}`}
              className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
            {action.status === "error" && (
              <p role="alert" className="text-sm text-destructive">
                {action.message}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {generating ? (
            <button
              type="button"
              disabled
              aria-label={`Generating ${title}`}
              className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
            >
              Generating…
            </button>
          ) : (
            <>
              {hasContent && (
                <button
                  type="button"
                  onClick={startEdit}
                  disabled={working}
                  aria-label={`Edit ${title}`}
                  className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={generateNow}
                disabled={working}
                aria-label={`${failed ? "Retry" : hasContent ? "Regenerate" : "Generate"} ${title}`}
                className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
              >
                {failed ? "Retry" : hasContent ? "Regenerate" : "Generate"}
              </button>
            </>
          )}
          {action.status === "error" && (
            <p role="alert" className="text-sm text-destructive">
              {action.message}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function docStatusChip(
  status: { state?: string; error?: string; isFallback?: boolean },
  hasContent: boolean,
): { label: string; className: string } | undefined {
  if (status.state === "generating") {
    return { label: "Generating…", className: "text-xs text-muted-foreground" };
  }
  if (status.state === "failed") {
    return { label: "Failed", className: "text-xs text-destructive" };
  }
  if (hasContent || status.state === "ready") {
    return {
      label: status.isFallback ? "Saved · template" : "Saved",
      className: "text-xs text-success",
    };
  }
  return undefined;
}

/**
 * 409 `PRECONDITIONS_NOT_MET` is the parent's only hard generation blocker
 * (unfilled required additional info). The parent's `blockedReason` is its
 * own prose and is never shown verbatim — this fixed copy points at the fix
 * path instead (R-A-5). Every other failure goes through `describeApiError`
 * (a 402 `SUBSCRIPTION_REQUIRED` reads "…needs a paid plan.", R-A-4).
 */
function describeGenerateError(error: unknown): string {
  if (error instanceof ApiError && error.code === "PRECONDITIONS_NOT_MET") {
    return "Complete the required additional information before generating.";
  }
  return describeApiError(error, "this document").message;
}
