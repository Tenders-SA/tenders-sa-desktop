import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import {
  Bold,
  Columns3,
  Eraser,
  FileDown,
  FileText,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link,
  List,
  ListOrdered,
  LoaderCircle,
  Minus,
  Plus,
  Quote,
  Redo2,
  RotateCcw,
  Rows3,
  Save,
  Send,
  Strikethrough,
  Table2,
  Undo2,
  Unlink,
  type LucideIcon,
} from "lucide-react";
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
  const [prompt, setPrompt] = useState("");
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
    if (dirty) {
      setGenerateError(
        "Save or revert your unsaved edits before asking AI to change this document.",
      );
      return;
    }
    setGenerateError(undefined);
    try {
      await props.onGenerate(prompt.trim() || undefined);
      setPrompt("");
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
          <IconButton
            label="Download response PDF"
            icon={FileDown}
            onClick={() => void exportLatest("pdf")}
            disabled={props.exportState === "exporting" || state !== "idle"}
          />
          <IconButton
            label="Download response Word"
            icon={FileText}
            onClick={() => void exportLatest("docx")}
            disabled={props.exportState === "exporting" || state !== "idle"}
          />
          <IconButton
            label="Revert document"
            icon={RotateCcw}
            onClick={() => {
              restore(props.content);
              props.onDiscardLocalDraft?.();
            }}
            disabled={!dirty || state !== "idle"}
          />
          {isGenerating && props.staleGenerating && (
            <button
              type="button"
              onClick={() => void props.onRecheck?.()}
              className="rounded border border-border px-3 py-1.5 text-sm"
            >
              Check again
            </button>
          )}
          <IconButton
            label="Save document"
            icon={Save}
            onClick={() => void save().catch(() => {})}
            disabled={!dirty || state !== "idle" || isGenerating}
            primary
          />
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
      <div className="min-h-0 flex-1 overflow-auto bg-background/40 px-4 py-6 sm:px-8">
        <div className="mx-auto min-h-full w-full max-w-[900px] rounded-xl border border-border/60 bg-card/35 px-6 py-8 text-foreground shadow-sm sm:px-10 sm:py-10">
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
      <div className="border-t border-border bg-card/80 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-[900px] items-end gap-2 rounded-xl border border-border bg-background/80 p-2 shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!isGenerating && state === "idle") void generate();
              }
            }}
            rows={2}
            placeholder="Tell AI how you want this document changed…"
            aria-label="Instructions for AI document changes"
            disabled={isGenerating || state !== "idle"}
            className="max-h-32 min-h-12 min-w-0 flex-1 resize-y bg-transparent px-2 py-1.5 text-sm leading-6 outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void generate()}
            disabled={isGenerating || state !== "idle"}
            aria-label="Send AI instruction"
            title={
              isGenerating
                ? "Generating document"
                : props.content
                  ? "Send instruction and regenerate"
                  : "Send instruction and generate"
            }
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {isGenerating ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : (
              <Send aria-hidden="true" className="size-4" />
            )}
          </button>
        </div>
        <p className="mx-auto mt-1.5 flex max-w-[900px] justify-between gap-3 px-1 text-[11px] text-muted-foreground">
          <span>Enter to send · Shift+Enter for a new line</span>
          <span>
            {isGenerating
              ? "Generating…"
              : failed
                ? "Retry generation"
                : props.content
                  ? "Regenerate with AI"
                  : "Generate with AI"}
          </span>
        </p>
      </div>
    </section>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return <div role="toolbar" aria-label="Formatting controls" />;
  const currentStyle = editor.isActive("heading", { level: 1 })
    ? "1"
    : editor.isActive("heading", { level: 2 })
      ? "2"
      : editor.isActive("heading", { level: 3 })
        ? "3"
        : editor.isActive("heading", { level: 4 })
          ? "4"
          : "paragraph";
  const action = (
    label: string,
    icon: LucideIcon,
    active: boolean,
    run: () => void,
    disabled = false,
  ) => (
    <IconButton
      key={label}
      label={label}
      icon={icon}
      active={active}
      disabled={disabled}
      onClick={run}
    />
  );
  const separator = (key: string) => (
    <span key={key} aria-hidden="true" className="mx-0.5 h-6 w-px bg-border" />
  );
  return (
    <div
      role="toolbar"
      aria-label="Formatting controls"
      className="flex max-w-full flex-wrap items-center gap-0.5"
    >
      {action(
        "Undo",
        Undo2,
        false,
        () => {
          editor.chain().focus().undo().run();
        },
        !editor.can().undo(),
      )}
      {action(
        "Redo",
        Redo2,
        false,
        () => {
          editor.chain().focus().redo().run();
        },
        !editor.can().redo(),
      )}
      {separator("history")}
      <label className="sr-only" htmlFor="response-text-style">
        Text style
      </label>
      <select
        id="response-text-style"
        aria-label="Text style"
        title="Text style"
        value={currentStyle}
        onChange={(event) => {
          const value = event.target.value;
          if (value === "paragraph")
            editor.chain().focus().setParagraph().run();
          else
            editor
              .chain()
              .focus()
              .setHeading({ level: Number(value) as 1 | 2 | 3 | 4 })
              .run();
        }}
        className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="paragraph">Paragraph</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
        <option value="4">Heading 4</option>
      </select>
      {separator("style")}
      {action("Bold", Bold, editor.isActive("bold"), () => {
        editor.chain().focus().toggleBold().run();
      })}
      {action("Italic", Italic, editor.isActive("italic"), () => {
        editor.chain().focus().toggleItalic().run();
      })}
      {action("Strikethrough", Strikethrough, editor.isActive("strike"), () => {
        editor.chain().focus().toggleStrike().run();
      })}
      {separator("text")}
      {action("Bulleted list", List, editor.isActive("bulletList"), () => {
        editor.chain().focus().toggleBulletList().run();
      })}
      {action(
        "Numbered list",
        ListOrdered,
        editor.isActive("orderedList"),
        () => {
          editor.chain().focus().toggleOrderedList().run();
        },
      )}
      {action(
        "Indent list",
        IndentIncrease,
        false,
        () => {
          editor.chain().focus().sinkListItem("listItem").run();
        },
        !editor.can().sinkListItem("listItem"),
      )}
      {action(
        "Outdent list",
        IndentDecrease,
        false,
        () => {
          editor.chain().focus().liftListItem("listItem").run();
        },
        !editor.can().liftListItem("listItem"),
      )}
      {separator("lists")}
      {action("Blockquote", Quote, editor.isActive("blockquote"), () => {
        editor.chain().focus().toggleBlockquote().run();
      })}
      {action("Horizontal rule", Minus, false, () => {
        editor.chain().focus().setHorizontalRule().run();
      })}
      {separator("structure")}
      {action("Add or edit link", Link, editor.isActive("link"), () => {
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
      {action(
        "Remove link",
        Unlink,
        false,
        () => {
          editor.chain().focus().unsetLink().run();
        },
        !editor.isActive("link"),
      )}
      {separator("link")}
      <details className="group relative">
        <summary
          aria-label="Table options"
          title="Table options"
          className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
        >
          <Table2 aria-hidden="true" className="size-4" strokeWidth={1.8} />
        </summary>
        <div className="absolute left-0 top-9 z-30 grid min-w-48 gap-1 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg">
          <TableMenuButton
            icon={Table2}
            label="Insert table"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
          />
          <TableMenuButton
            icon={Rows3}
            label="Add row"
            onClick={() => editor.chain().focus().addRowAfter().run()}
            disabled={!editor.can().addRowAfter()}
          />
          <TableMenuButton
            icon={Rows3}
            label="Remove row"
            onClick={() => editor.chain().focus().deleteRow().run()}
            disabled={!editor.can().deleteRow()}
            destructive
          />
          <TableMenuButton
            icon={Columns3}
            label="Add column"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            disabled={!editor.can().addColumnAfter()}
          />
          <TableMenuButton
            icon={Columns3}
            label="Remove column"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            disabled={!editor.can().deleteColumn()}
            destructive
          />
        </div>
      </details>
      {separator("table")}
      {action("Clear formatting", Eraser, false, () => {
        editor.chain().focus().clearNodes().unsetAllMarks().run();
      })}
    </div>
  );
}

function IconButton({
  label,
  icon: Icon,
  active = false,
  primary = false,
  ...buttonProps
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  primary?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      {...buttonProps}
      className={`flex size-8 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 ${
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : active
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon aria-hidden="true" className="size-4" strokeWidth={1.8} />
    </button>
  );
}

function TableMenuButton({
  icon: Icon,
  label,
  destructive = false,
  ...buttonProps
}: {
  icon: LucideIcon;
  label: string;
  destructive?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...buttonProps}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 ${destructive ? "text-destructive" : ""}`}
    >
      <Icon aria-hidden="true" className="size-4" strokeWidth={1.8} />
      <span>{label}</span>
      {label.startsWith("Add") && (
        <Plus aria-hidden="true" className="ml-auto size-3" />
      )}
      {label.startsWith("Remove") && (
        <Minus aria-hidden="true" className="ml-auto size-3" />
      )}
    </button>
  );
}
