import { useEffect, useRef, useState } from "react";

export function UnsavedChangesDialog({
  onSave,
  onDiscard,
  onStay,
}: {
  onSave: () => Promise<void>;
  onDiscard: () => void;
  onStay: () => void;
}) {
  const stayRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => stayRef.current?.focus(), []);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onStay();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = dialogRef.current?.querySelectorAll<HTMLButtonElement>(
        "button:not([disabled])",
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
    document.addEventListener("keydown", keydown, true);
    return () => document.removeEventListener("keydown", keydown, true);
  }, [onStay]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 p-4">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby="unsaved-title"
        aria-describedby="unsaved-description"
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
      >
        <h2 id="unsaved-title" className="text-lg font-semibold">
          Save your changes?
        </h2>
        <p
          id="unsaved-description"
          className="mt-2 text-sm text-muted-foreground"
        >
          This response document has changes that have not been saved.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={stayRef}
            type="button"
            onClick={onStay}
            disabled={saving}
            className="rounded border border-border px-3 py-2 text-sm"
          >
            Stay
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="rounded border border-border px-3 py-2 text-sm text-destructive"
          >
            Discard
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setSaving(true);
              setError(undefined);
              void onSave().catch(() => {
                setSaving(false);
                setError(
                  "Could not save this document. Your changes are still here.",
                );
              });
            }}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save and continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
