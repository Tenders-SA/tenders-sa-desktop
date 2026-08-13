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
import { describeApiError } from "../../../services/api/describe-error";
import type { ResponseBlueprintDoc } from "../../../services/api/endpoints/applications";
import {
  describeGenerateError,
  docStatusChip,
  type ResponseDocStatusSummary,
} from "../workflow/response-doc-status";

export interface ResponseBlueprintDocRowProps {
  doc: ResponseBlueprintDoc;
  /** Merged status (fetched payload ∪ panel overlay). */
  status: ResponseDocStatusSummary;
  hasContent: boolean;
  /** Merged saved content (fetched payload ∪ panel overlay). */
  content?: string;
  onGenerate: (key: string) => Promise<void>;
  onSave: (key: string, content: string) => Promise<void>;
  onEditDocument?: (key: string) => void;
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
  onGenerate,
  onSave,
  onEditDocument,
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
    onGenerate(key)
      .then(() => {
        setAction({ status: "idle" });
      })
      .catch((error: unknown) => {
        setAction({ status: "error", message: describeGenerateError(error) });
      });
  }

  function saveNow() {
    setAction({ status: "working" });
    onSave(key, draft)
      .then(() => {
        setAction({ status: "idle" });
        setEditing(false);
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
      {failed && (
        <span className="block text-xs text-destructive">
          This document could not be generated — retry it.
        </span>
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
                  onClick={() =>
                    onEditDocument ? onEditDocument(key) : startEdit()
                  }
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
