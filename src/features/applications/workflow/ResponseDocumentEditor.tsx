import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import { describeApiError } from "../../../services/api/describe-error";
import type { ExportPackageFormat } from "../../../services/api/endpoints/applications";
import type { ResponseDocVersionEntry } from "../../../services/storage/response-doc-store";
import {
  describeGenerateError,
  type ResponseDocStatusSummary,
} from "./response-doc-status";

interface Props {
  title: string;
  content: string;
  status?: ResponseDocStatusSummary;
  staleGenerating?: boolean;
  restoredDraft?: string;
  hasLocalDraft?: boolean;
  pendingSync?: boolean;
  onSyncNow?: () => Promise<void>;
  versions?: ResponseDocVersionEntry[];
  onRestoreVersion?: (content: string) => void;
  onDiscardLocalDraft?: () => void;
  onSave: (content: string) => Promise<void>;
  onSaveBeforeExport?: (content: string) => Promise<void>;
  onGenerate: (prompt?: string) => Promise<void>;
  onRecheck?: () => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
  onDraftChange: (content: string) => void;
  exportState?: "idle" | "exporting" | "error";
  exportError?: string;
  onExport?: (format: ExportPackageFormat) => Promise<void>;
}

export function ResponseDocumentEditor(props: Props) {
  const { onDirtyChange, onDraftChange } = props;
  const [draft, setDraft] = useState(props.restoredDraft ?? props.content);
  const [state, setState] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string>();
  const [generateError, setGenerateError] = useState<string>();
  const [instructions, setInstructions] = useState("");
  const previousContent = useRef(props.content);
  const dirty = draft !== props.content;
  const isGenerating = props.status?.state === "generating";
  const failed = props.status?.state === "failed";
  const isTemplate =
    props.status?.isFallback === true &&
    Boolean(props.content || props.status?.state === "ready");
  const unresolved = props.status?.unresolvedPlaceholders?.length ?? 0;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        link: { openOnClick: false, autolink: true },
      }),
      TableKit.configure({ table: { resizable: true } }),
      Markdown,
    ],
    content: props.restoredDraft ?? props.content,
    contentType: "markdown",
    editable: !isGenerating,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        class:
          "response-document min-h-[calc(100vh-15rem)] outline-none focus-visible:ring-2 focus-visible:ring-primary",
        "aria-label": `Edit ${props.title}`,
      },
    },
    onUpdate: ({ editor: current }) => setDraft(current.getMarkdown()),
  });

  useEffect(() => {
    editor?.setEditable(!isGenerating);
  }, [editor, isGenerating]);
  useEffect(() => {
    if (!editor || props.content === previousContent.current) return;
    if (draft === previousContent.current) {
      editor.commands.setContent(props.content, { contentType: "markdown" });
      setDraft(props.content);
    }
    previousContent.current = props.content;
  }, [draft, editor, props.content]);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => onDraftChange(draft), [draft, onDraftChange]);

  async function save(
    saveAction: (content: string) => Promise<void> = props.onSave,
  ): Promise<void> {
    setState("saving");
    setError(undefined);
    try {
      await saveAction(draft);
    } catch (cause) {
      setError(describeApiError(cause, "this document").message);
      throw cause;
    } finally {
      setState("idle");
    }
  }

  async function exportLatest(format: ExportPackageFormat) {
    try {
      if (dirty) await save(props.onSaveBeforeExport ?? props.onSave);
      await props.onExport?.(format);
    } catch {
      // Save/export owners already expose a safe, redacted error.
    }
  }

  async function generate() {
    setGenerateError(undefined);
    try {
      await props.onGenerate(instructions.trim() || undefined);
      setInstructions("");
    } catch (cause) {
      setGenerateError(describeGenerateError(cause));
    }
  }

  function restore(markdown: string) {
    editor?.commands.setContent(markdown, { contentType: "markdown" });
    setDraft(markdown);
  }

  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/40"
      aria-label="Document editor"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2">
        <Toolbar editor={editor} />
        <div className="flex flex-wrap items-center gap-2">
          <span role="status" className="text-xs text-muted-foreground">
            {state === "saving"
              ? "Saving…"
              : dirty
                ? "Unsaved changes"
                : "Saved"}
          </span>
          <button
            type="button"
            onClick={() => void exportLatest("pdf")}
            disabled={props.exportState === "exporting" || state !== "idle"}
            className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Download response PDF
          </button>
          <button
            type="button"
            onClick={() => void exportLatest("docx")}
            disabled={props.exportState === "exporting" || state !== "idle"}
            className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Download response Word
          </button>
          <button
            type="button"
            onClick={() => {
              restore(props.content);
              props.onDiscardLocalDraft?.();
            }}
            disabled={!dirty || state !== "idle"}
            className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Revert
          </button>
          <input
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Optional AI instructions"
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
                : props.content
                  ? "Regenerate"
                  : "Generate"}
          </button>
          {isGenerating && props.staleGenerating && (
            <button
              type="button"
              onClick={() => void props.onRecheck?.()}
              className="rounded border border-border px-3 py-1.5 text-sm"
            >
              Check again
            </button>
          )}
          <button
            type="button"
            onClick={() => void save().catch(() => {})}
            disabled={!dirty || state !== "idle" || isGenerating}
            className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
      {(error || generateError || props.exportError) && (
        <p
          role="alert"
          className="border-b border-border px-5 py-2 text-sm text-destructive"
        >
          {error ?? generateError ?? props.exportError}
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
          className="border-b border-warning/30 bg-warning/10 px-5 py-2 text-sm text-warning"
        >
          ⚠ {unresolved} unresolved{" "}
          {unresolved === 1 ? "placeholder remains" : "placeholders remain"}.
          Review before exporting.
        </p>
      )}
      {props.hasLocalDraft && (
        <p
          role="status"
          className="border-b border-border px-5 py-2 text-sm text-muted-foreground"
        >
          Unsaved local draft restored — it has not been saved to your response
          plan yet.
        </p>
      )}
      {props.pendingSync && (
        <p
          role="status"
          className="border-b border-border px-5 py-2 text-sm text-warning"
        >
          Saved locally — pending sync to your response plan.{" "}
          {props.onSyncNow && (
            <button
              type="button"
              onClick={() => void props.onSyncNow?.()}
              className="ml-2 underline"
            >
              Sync now
            </button>
          )}
        </p>
      )}
      {props.versions?.length && props.onRestoreVersion ? (
        <details className="border-b border-border px-5 py-2 text-xs">
          <summary>Local history ({props.versions.length})</summary>
          {props.versions.map((version) => (
            <button
              key={version.id}
              type="button"
              aria-label="Restore"
              title={new Date(version.createdAt).toLocaleString()}
              disabled={dirty}
              onClick={() => {
                restore(version.content);
                props.onRestoreVersion?.(version.content);
              }}
              className="mr-2 mt-2 rounded border border-border px-2 py-1"
            >
              Restore
            </button>
          ))}
        </details>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
        <div className="mx-auto min-h-full w-full max-w-[850px] bg-white px-8 py-10 text-slate-900 shadow-md sm:px-14 sm:py-14">
          <EditorContent
            editor={editor}
            onKeyDown={(event) => {
              if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "s"
              ) {
                event.preventDefault();
                if (dirty && !isGenerating) void save().catch(() => {});
              }
            }}
          />
        </div>
      </div>
    </section>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return <div role="toolbar" aria-label="Formatting controls" />;
  const action = (label: string, active: boolean, run: () => void) => (
    <button
      key={label}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={run}
      className={`rounded px-2 py-1 text-sm ${active ? "bg-primary/15 text-primary" : "hover:bg-muted"}`}
    >
      {label}
    </button>
  );
  return (
    <div
      role="toolbar"
      aria-label="Formatting controls"
      className="flex max-w-full flex-wrap gap-1"
    >
      {action("Undo", false, () => {
        editor.chain().focus().undo().run();
      })}
      {action("Redo", false, () => {
        editor.chain().focus().redo().run();
      })}
      {[1, 2, 3, 4].map((level) =>
        action(
          `Heading ${level}`,
          editor.isActive("heading", { level }),
          () => {
            editor
              .chain()
              .focus()
              .toggleHeading({ level: level as 1 | 2 | 3 | 4 })
              .run();
          },
        ),
      )}
      {action("Bold", editor.isActive("bold"), () => {
        editor.chain().focus().toggleBold().run();
      })}
      {action("Italic", editor.isActive("italic"), () => {
        editor.chain().focus().toggleItalic().run();
      })}
      {action("Strikethrough", editor.isActive("strike"), () => {
        editor.chain().focus().toggleStrike().run();
      })}
      {action("Bulleted list", editor.isActive("bulletList"), () => {
        editor.chain().focus().toggleBulletList().run();
      })}
      {action("Numbered list", editor.isActive("orderedList"), () => {
        editor.chain().focus().toggleOrderedList().run();
      })}
      {action("Indent list", false, () => {
        editor.chain().focus().sinkListItem("listItem").run();
      })}
      {action("Outdent list", false, () => {
        editor.chain().focus().liftListItem("listItem").run();
      })}
      {action("Blockquote", editor.isActive("blockquote"), () => {
        editor.chain().focus().toggleBlockquote().run();
      })}
      {action("Horizontal rule", false, () => {
        editor.chain().focus().setHorizontalRule().run();
      })}
      {action("Add or edit link", editor.isActive("link"), () => {
        const href = window.prompt(
          "Link address",
          editor.getAttributes("link").href ?? "https://",
        );
        if (href === null) return;
        if (!href.trim()) editor.chain().focus().unsetLink().run();
        else
          editor
            .chain()
            .focus()
            .extendMarkRange("link")
            .setLink({ href })
            .run();
      })}
      {action("Remove link", false, () => {
        editor.chain().focus().unsetLink().run();
      })}
      {action("Insert table", false, () => {
        editor
          .chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      })}
      {action("Add row", false, () => {
        editor.chain().focus().addRowAfter().run();
      })}
      {action("Remove row", false, () => {
        editor.chain().focus().deleteRow().run();
      })}
      {action("Add column", false, () => {
        editor.chain().focus().addColumnAfter().run();
      })}
      {action("Remove column", false, () => {
        editor.chain().focus().deleteColumn().run();
      })}
      {action("Clear formatting", false, () => {
        editor.chain().focus().clearNodes().unsetAllMarks().run();
      })}
    </div>
  );
}
