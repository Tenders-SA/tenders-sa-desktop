import { useEffect, useRef, useState } from "react";
import { describeApiError } from "../../../services/api/describe-error";

export function ResponseDocumentEditor({
  title,
  content,
  generating,
  onSave,
  onGenerate,
  onDirtyChange,
}: {
  title: string;
  content: string;
  generating: boolean;
  onSave: (content: string) => Promise<void>;
  onGenerate: () => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(content);
  const [state, setState] = useState<"idle" | "saving" | "generating">("idle");
  const [error, setError] = useState<string>();
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const dirty = draft !== content;

  useEffect(() => {
    setDraft(content);
    setError(undefined);
    requestAnimationFrame(() => editorRef.current?.focus());
  }, [content, title]);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

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
            onClick={() => setDraft(content)}
            disabled={!dirty || state !== "idle"}
            className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Revert
          </button>
          <button
            type="button"
            onClick={() => void onGenerate()}
            disabled={generating || state !== "idle"}
            className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {generating ? "Generating…" : content ? "Regenerate" : "Generate"}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || state !== "idle" || generating}
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
      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
        <textarea
          ref={editorRef}
          aria-label={`Edit ${title}`}
          value={draft}
          readOnly={generating}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (
              (event.ctrlKey || event.metaKey) &&
              event.key.toLowerCase() === "s"
            ) {
              event.preventDefault();
              if (dirty && !generating) void save();
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
