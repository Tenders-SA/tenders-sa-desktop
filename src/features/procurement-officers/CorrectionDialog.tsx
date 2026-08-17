/**
 * Correction dialog (TASK-1.8, design.md §UI, R-P12).
 *
 * Field + reason → `POST corrections`. On success the dialog explains the
 * pending-review status: the disputed field stays hidden locally until a
 * later sync no longer carries it. Failures (404/400) are surfaced with an
 * explicit message and never mark the field.
 */

import { useEffect, useRef, useState } from "react";
import type { OfficerCorrectionPhase } from "./use-officer-corrections";

export interface CorrectionFieldOption {
  field: string;
  label: string;
  value: string;
}

export interface CorrectionDialogProps {
  open: boolean;
  officerName: string;
  fields: CorrectionFieldOption[];
  phase: OfficerCorrectionPhase;
  status: string | null;
  errorMessage: string | null;
  onSubmit: (field: string, value: string, reason: string) => void;
  onClose: () => void;
}

export function CorrectionDialog({
  open,
  officerName,
  fields,
  phase,
  status,
  errorMessage,
  onSubmit,
  onClose,
}: CorrectionDialogProps) {
  const [field, setField] = useState(fields[0]?.field ?? "");
  const [reason, setReason] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setField(fields[0]?.field ?? "");
      setReason("");
    }
  }, [open, fields]);

  useEffect(() => {
    if (!open) return;
    submitRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function keydown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    }
    document.addEventListener("keydown", keydown, true);
    return () => document.removeEventListener("keydown", keydown, true);
  }, [open, onClose]);

  if (!open) return null;

  const selected = fields.find((f) => f.field === field);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 p-4">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby="correction-title"
        aria-describedby="correction-description"
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
      >
        <h2 id="correction-title" className="text-lg font-semibold">
          Report incorrect information
        </h2>
        <p
          id="correction-description"
          className="mt-2 text-sm text-muted-foreground"
        >
          {officerName} — the disputed field is hidden on your device until the
          review is resolved.
        </p>

        {phase === "submitted" ? (
          <div className="mt-4">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="font-medium">
                Correction filed — status: {status ?? "pending"}.
              </p>
              <p className="mt-1">
                This field stays hidden until a later sync no longer carries the
                disputed value.
              </p>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <label
              className="mt-4 block text-sm font-medium"
              htmlFor="correction-field"
            >
              Field
            </label>
            <select
              id="correction-field"
              value={field}
              onChange={(event) => setField(event.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
            >
              {fields.map((f) => (
                <option key={f.field} value={f.field}>
                  {f.label}
                </option>
              ))}
            </select>

            <label
              className="mt-3 block text-sm font-medium"
              htmlFor="correction-reason"
            >
              Reason
            </label>
            <textarea
              id="correction-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Explain what is incorrect…"
              className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
            />

            {errorMessage && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {errorMessage}
              </p>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={phase === "submitting"}
                className="rounded border border-border px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                ref={submitRef}
                type="button"
                disabled={
                  phase === "submitting" ||
                  !selected ||
                  reason.trim().length === 0
                }
                onClick={() => {
                  if (!selected) return;
                  onSubmit(selected.field, selected.value, reason.trim());
                }}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {phase === "submitting"
                  ? "Submitting…"
                  : "Report incorrect information"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
