import type { ResponseBlueprintDoc } from "../../../services/api/endpoints/applications";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  FileText,
  LoaderCircle,
  PencilLine,
  type LucideIcon,
} from "lucide-react";
import {
  classifyResponseDoc,
  docStatusLabel,
  type ResponseDocStatusSummary,
} from "./response-doc-status";

export function ResponseDocumentNavigator({
  documents,
  selectedKey,
  responseDocs,
  status,
  dirtyKey,
  onSelect,
}: {
  documents: ResponseBlueprintDoc[];
  selectedKey: string;
  responseDocs: Record<string, string>;
  status: Record<string, ResponseDocStatusSummary>;
  dirtyKey?: string;
  onSelect: (key: string) => void;
}) {
  return (
    <nav aria-label="Response documents" className="h-full overflow-y-auto p-3">
      <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Response documents
      </p>
      <ul className="mt-2 space-y-1">
        {documents.map((document) => {
          const key = document.key;
          if (!key) return null;
          const isUnsaved = key === dirtyKey;
          const state = classifyResponseDoc(
            status[key],
            Boolean(responseDocs[key]),
          );
          const label = isUnsaved
            ? "Unsaved"
            : docStatusLabel(status[key], Boolean(responseDocs[key]));
          const statusPresentation = isUnsaved
            ? { icon: PencilLine, className: "text-warning" }
            : statusIcon(state);
          const StatusIcon = statusPresentation.icon;
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onSelect(key)}
                aria-current={key === selectedKey ? "page" : undefined}
                className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left ${
                  key === selectedKey
                    ? "border-primary/40 bg-primary/10"
                    : "border-transparent hover:border-border hover:bg-muted/60"
                }`}
              >
                <FileText
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {document.title ?? "Response document"}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <StatusIcon
                      aria-hidden="true"
                      className={`size-3.5 ${statusPresentation.className} ${state === "generating" ? "animate-spin" : ""}`}
                    />
                    {label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function statusIcon(state: ReturnType<typeof classifyResponseDoc>): {
  icon: LucideIcon;
  className: string;
} {
  switch (state) {
    case "generating":
      return { icon: LoaderCircle, className: "text-info" };
    case "failed":
      return { icon: CircleAlert, className: "text-destructive" };
    case "saved":
    case "template":
      return { icon: CheckCircle2, className: "text-success" };
    default:
      return { icon: Circle, className: "text-muted-foreground" };
  }
}
