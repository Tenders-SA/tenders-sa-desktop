import { useEffect, useRef, useState } from "react";
import { describeApiError } from "../../../services/api/describe-error";
import type { ResponseDocVersionEntry } from "../../../services/storage/response-doc-store";
import {
  describeGenerateError,
  type ResponseDocStatusSummary,
} from "./response-doc-status";

export function ResponseDocumentEditor({
  title,
  content,
  status,
  staleGenerating = false,
  restoredDraft,
  hasLocalDraft = false,
  pendingSync = false,
  onSyncNow,
  versions,
  onRestoreVersion,
  onDiscardLocalDraft,
  onSave,
  onGenerate,
  onRecheck,
  onDirtyChange,
  onDraftChange,
}: {
  title: string;
  content: string;
  status?: ResponseDocStatusSummary;
  staleGenerating?: boolean;
  /** LD-1 — an unsaved local draft to recover into the editor. */
  restoredDraft?: string;
  /** LD-1 — the editor is showing a locally recovered draft. */
  hasLocalDraft?: boolean;
  /** LD-2 — the latest save is queued locally, awaiting sync. */
  pendingSync?: boolean;
  onSyncNow?: () => Promise<void>;
  /** LD-3 — local version history for this document. */
  versions?: ResponseDocVersionEntry[];
  onRestoreVersion?: (content: string) => void;
  onDiscardLocalDraft?: () => void;
  onSave: (content: string) => Promise<void>;
  onGenerate: (prompt?: string) => Promise<void>;
  onRecheck?: () => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
  onDraftChange: (content: string) => void;
}) {
  const [draft, setDraft] = useState(content);
  const [state, setState] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string>();
  const [generateError, setGenerateError] = useState<string>();
  const [recheckError, setRecheckError] = useState<string>();
  const [instructions, setInstructions] = useState("");
  const [localDraftApplied, setLocalDraftApplied] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const dirty = draft !== content;

  const isGenerating = status?.state === "generating";
  const failed = status?.state === "failed";
  const isTemplate =
    status?.isFallback === true &&
    Boolean(content || status?.state === "ready");
  const unresolved = status?.unresolvedPlaceholders?.length ?? 0;

  useEffect(() => {
    setDraft(content);
    setError(undefined);
    setGenerateError(undefined);
    setRecheckError(undefined);
    requestAnimationFrame(() => editorRef.current?.focus());
  }, [content, title]);

  /**
   * LD-1 — apply a locally recovered draft exactly once per mount. The
   * guard prevents the stale draft from being re-applied after a later
   * successful save resets `content` while the parent still holds it,
   * and never overwrites edits the user typed before the load finished.
   */
  useEffect(() => {
    if (restoredDraft === undefined || localDraftApplied || dirty) {
      return;
    }
    setLocalDraftApplied(true);
    setDraft(restoredDraft);
  }, [restoredDraft, dirty, localDraftApplied]);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => onDraftChange(draft), [draft, onDraftChange]);

  async function save() {
    setState("saving");
    setError(undefined);
    try {
      await onSave(draft);
      setState("idle");
    } catch (cause) {
      setState("idle");
      setError(describeApiError(cause, "this document").message);
    }
  }

  async function generate() {
    setGenerateError(undefined);
    try {
      await onGenerate(instructions.trim() || undefined);
      setInstructions("");
    } catch (cause) {
      setGenerateError(describeGenerateError(cause));
    }
  }

  async function recheckNow() {
    setRecheckError(undefined);
    const ok = await onRecheck?.();
    if (ok === false)
      setRecheckError("Could not refresh the status right now.");
  }

  function transform(prefix: string, suffix = "") {
    const editor = editorRef.current;
    if (!editor) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = draft.slice(start, end);
    const next = `${draft.slice(0, start)}${prefix}${selected}${suffix}${draft.slice(end)}`;
    setDraft(next);
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + prefix.length, end + prefix.length);
    });
  }

  function prefixLine(prefix: string) {
    const editor = editorRef.current;
    if (!editor) return;
    const cursor = editor.selectionStart;
    const lineStart = draft.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
    setDraft(`${draft.slice(0, lineStart)}${prefix}${draft.slice(lineStart)}`);
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(cursor + prefix.length, cursor + prefix.length);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted/30">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-2">
        <div className="flex flex-wrap gap-1" aria-label="Formatting controls">
          <FormatButton label="Heading" onClick={() => prefixLine("## ")} />
          <FormatButton label="Bold" onClick={() => transform("**", "**")} />
          <FormatButton label="Bullet list" onClick={() => prefixLine("- ")} />
          <FormatButton
            label="Numbered list"
            onClick={() => prefixLine("1. ")}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {dirty ? "Unsaved changes" : "Saved"}
          </span>
          <button
            type="button"
            onClick={() => {
              setDraft(content);
              onDiscardLocalDraft?.();
            }}
            disabled={!dirty || state !== "idle"}
            className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Revert
          </button>
          <input
            type="text"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Optional instructions"
            aria-label="Optional instructions for the AI"
            disabled={isGenerating || state !== "idle"}
            className="w-44 rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => void generate()}
            disabled={isGenerating || state !== "idle"}
            className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {isGenerating
              ? "Generating…"
              : failed
                ? "Retry"
                : content
                  ? "Regenerate"
                  : "Generate"}
          </button>
          {isGenerating && staleGenerating && (
            <button
              type="button"
              onClick={() => void recheckNow()}
              className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Check again
            </button>
          )}
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || state !== "idle" || isGenerating}
            className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {state === "saving" ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="border-b border-border px-5 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {generateError && (
        <p
          role="alert"
          className="border-b border-border px-5 py-2 text-sm text-destructive"
        >
          {generateError}
        </p>
      )}
      {recheckError && (
        <p
          role="alert"
          className="border-b border-border px-5 py-2 text-sm text-destructive"
        >
          {recheckError}
        </p>
      )}
      {failed && !generateError && (
        <p
          role="status"
          className="border-b border-border px-5 py-2 text-sm text-muted-foreground"
        >
          Generation failed — retry it.
        </p>
      )}
      {isTemplate && (
        <p
          role="status"
          className="border-b border-border px-5 py-2 text-sm text-muted-foreground"
        >
          Saved · template
        </p>
      )}
      {unresolved > 0 && (
        <p
          role="status"
          className="border-b border-border px-5 py-2 text-sm text-warning"
        >
          {unresolved} unresolved{" "}
          {unresolved === 1 ? "placeholder" : "placeholders"}{" "}
          {unresolved === 1 ? "remains" : "remain"} in this document — verify
          them before submitting.
        </p>
      )}
      {hasLocalDraft && localDraftApplied && (
        <p
          role="status"
          className="border-b border-border px-5 py-2 text-sm text-muted-foreground"
        >
          Unsaved local draft restored — it has not been saved to your response
          plan yet.
        </p>
      )}
      {pendingSync && (
        <p
          role="status"
          className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-2 text-sm text-warning"
        >
          <span>Saved locally — pending sync to your response plan.</span>
          {onSyncNow && (
            <button
              type="button"
              onClick={() => void onSyncNow()}
              className="rounded border border-border px-2 py-0.5 text-xs disabled:opacity-50"
            >
              Sync now
            </button>
          )}
        </p>
      )}
      {versions && versions.length > 0 && onRestoreVersion && (
        <div className="border-b border-border px-5 py-2">
          <details>
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Local history ({versions.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {versions.map((version) => (
                <li
                  key={version.id}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="min-w-0 truncate text-muted-foreground">
                    {new Date(version.createdAt).toLocaleString()} ·{" "}
                    {sourceLabel(version.source)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(version.content);
                      onRestoreVersion(version.content);
                    }}
                    disabled={dirty || state !== "idle"}
                    className="rounded border border-border px-2 py-0.5 disabled:opacity-50"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
        <textarea
          ref={editorRef}
          aria-label={`Edit ${title}`}
          value={draft}
          readOnly={isGenerating}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (
              (event.ctrlKey || event.metaKey) &&
              event.key.toLowerCase() === "s"
            ) {
              event.preventDefault();
              if (dirty && !isGenerating) void save();
            }
          }}
          className="mx-auto min-h-full w-full max-w-4xl resize-none rounded-lg border border-border bg-card p-6 font-mono text-sm leading-7 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
    </div>
  );
}

function FormatButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded px-2.5 py-1.5 text-sm hover:bg-muted"
    >
      {label}
    </button>
  );
}

function sourceLabel(source: ResponseDocVersionEntry["source"]): string {
  switch (source) {
    case "save":
      return "Saved version";
    case "generate":
      return "Replaced by generation";
    case "restore":
      return "Restored version";
  }
}
