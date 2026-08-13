import { useState } from "react";
import type { ResponseBlueprintDoc } from "../../../services/api/endpoints/applications";
import {
  docStatusLabel,
  type ResponseDocStatusSummary,
} from "./response-doc-status";

export interface ResponseDocumentListProps {
  documents: ResponseBlueprintDoc[];
  responseDocs: Record<string, string>;
  status: Record<string, ResponseDocStatusSummary>;
  onSelect: (key: string) => void;
  onGenerateAll: (
    keys: string[],
  ) => Promise<Record<string, string | undefined>>;
}

/**
 * Draft-stage landing list (RA-3) with a single "Generate all remaining" action
 * (RA-1). Every generate press is explicit; per-key failures are aggregated via
 * the shared error copy, never shown as raw server strings.
 */
export function ResponseDocumentList({
  documents,
  responseDocs,
  status,
  onSelect,
  onGenerateAll,
}: ResponseDocumentListProps) {
  const [working, setWorking] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const rows = documents.filter((document) => Boolean(document.key));
  const remaining = rows.filter(
    (document) =>
      document.key &&
      !responseDocs[document.key] &&
      status[document.key]?.state !== "generating",
  );

  async function generateAll() {
    setWorking(true);
    setErrors({});
    const results = await onGenerateAll(
      remaining.map((document) => document.key as string),
    );
    const failures: Record<string, string> = {};
    for (const [key, message] of Object.entries(results)) {
      if (message) failures[key] = message;
    }
    setErrors(failures);
    setWorking(false);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} response {rows.length === 1 ? "document" : "documents"}{" "}
          —{remaining.length} remaining to generate.
        </p>
        <button
          type="button"
          onClick={() => void generateAll()}
          disabled={working || remaining.length === 0}
          className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
        >
          {working
            ? "Generating…"
            : `Generate all ${remaining.length} remaining`}
        </button>
      </div>

      {Object.keys(errors).length > 0 && (
        <div role="alert" className="mt-3 space-y-1">
          {Object.values(errors).map((message, index) => (
            <p key={index} className="text-sm text-destructive">
              {message}
            </p>
          ))}
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {rows.map((document) => {
          const key = document.key as string;
          const label = docStatusLabel(status[key], Boolean(responseDocs[key]));
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onSelect(key)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left hover:border-primary/30 hover:bg-muted/60"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    {document.title ?? "Response document"}
                    {document.mandatory && (
                      <span className="text-destructive">*</span>
                    )}
                  </span>
                  {document.kind && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {document.kind}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
