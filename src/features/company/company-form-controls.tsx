/**
 * Form primitives shared by the Slice 11 record editors.
 *
 * Lifted verbatim from `CompanyProfileEditor`'s private helpers so the three
 * new editors look and behave identically to the one that shipped before
 * them. `CompanyProfileEditor` itself is deliberately left untouched (Slice 11
 * design §5): it edits the eleven fields `PUT /profile` accepts, and that is
 * a different contract from the ones edited here.
 */

import type { ReactNode } from "react";

export const control =
  "mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground";

export function Field({
  label,
  hint,
  required,
  error,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-card-foreground">
      {label}
      {required ? " *" : ""}
      {children}
      {error ? (
        <span
          role="alert"
          className="mt-1 block text-xs font-normal text-destructive"
        >
          {error}
        </span>
      ) : (
        hint && (
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            {hint}
          </span>
        )
      )}
    </label>
  );
}

export function EditorActions({
  saving,
  saveLabel,
  onCancel,
}: {
  saving: boolean;
  saveLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="mt-5 flex justify-end gap-3 border-t border-border pt-4">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="rounded border border-border px-4 py-2 text-sm text-foreground disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {saving ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}

/**
 * An inline delete confirmation.
 *
 * Not `window.confirm`: a native modal dialog blocks the Tauri webview's
 * event loop, so the confirmation lives in the page like every other control.
 */
export function ConfirmDelete({
  label,
  busy,
  onConfirm,
  onCancel,
}: {
  label: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className="rounded bg-destructive px-2 py-1 text-xs font-semibold text-destructive-foreground disabled:opacity-50"
      >
        {busy ? "Removing…" : "Confirm"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded border border-border px-2 py-1 text-xs text-foreground disabled:opacity-50"
      >
        Keep
      </button>
    </span>
  );
}
