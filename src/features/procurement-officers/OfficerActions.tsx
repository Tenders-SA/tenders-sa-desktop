/**
 * Officer actions toolbar (TASK-1.7, design.md §UI, R-P11).
 *
 * Single-contact actions only — copy email/telephone, mailto, save, private
 * notes, organisation profile link, view tenders. Deliberately no bulk
 * export affordance (R-P13); each copy is an explicit one-value action.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import type { OfficerContactView } from "./use-officer-detail";

export interface OfficerActionsProps {
  emailContact: OfficerContactView | null;
  telephoneContact: OfficerContactView | null;
  saved: boolean;
  note: string;
  organisationLink: string | null;
  onToggleSaved: () => void;
  onSaveNote: (note: string) => Promise<void>;
  onCopy: (value: string) => Promise<boolean>;
  onViewTenders: () => void;
}

export function OfficerActions({
  emailContact,
  telephoneContact,
  saved,
  note,
  organisationLink,
  onToggleSaved,
  onSaveNote,
  onCopy,
  onViewTenders,
}: OfficerActionsProps) {
  const [draft, setDraft] = useState(note);
  const [copied, setCopied] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  const handleCopy = async (label: string, value: string) => {
    const ok = await onCopy(value);
    if (ok) {
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1500);
    }
  };

  const handleSaveNote = async () => {
    setSavingNote(true);
    try {
      await onSaveNote(draft);
      setNoteSaved(true);
      window.setTimeout(() => setNoteSaved(false), 1500);
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {emailContact && (
        <button
          type="button"
          onClick={() => void handleCopy("email", emailContact.value)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10"
        >
          {copied === "email" ? "Copied" : "Copy email"}
        </button>
      )}
      {telephoneContact && (
        <button
          type="button"
          onClick={() => void handleCopy("telephone", telephoneContact.value)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10"
        >
          {copied === "telephone" ? "Copied" : "Copy telephone"}
        </button>
      )}
      {emailContact && (
        <a
          href={`mailto:${emailContact.value}`}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10"
        >
          Email officer
        </a>
      )}
      <button
        type="button"
        onClick={onToggleSaved}
        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10"
      >
        {saved ? "Unsave officer" : "Save officer"}
      </button>
      {organisationLink && (
        <Link
          to={organisationLink}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10"
        >
          Organisation profile
        </Link>
      )}
      <button
        type="button"
        onClick={onViewTenders}
        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        View tenders
      </button>

      <div className="mt-2 flex w-full flex-col gap-1.5 border-t border-border pt-4">
        <textarea
          aria-label="Private notes"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={2}
          placeholder="Private notes for this officer…"
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSaveNote()}
            disabled={savingNote}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10"
          >
            {savingNote ? "Saving…" : "Save note"}
          </button>
          {noteSaved && (
            <span className="text-xs font-medium text-success">Note saved</span>
          )}
        </div>
      </div>
    </div>
  );
}
