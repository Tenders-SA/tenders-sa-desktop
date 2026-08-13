import type { ResponseBlueprintDoc } from "../../../services/api/endpoints/applications";
import {
  docStatusLabel,
  type ResponseDocStatusSummary,
} from "./response-doc-status";

export function ResponseDocumentNavigator({
  documents,
  selectedKey,
  responseDocs,
  status,
  onSelect,
}: {
  documents: ResponseBlueprintDoc[];
  selectedKey: string;
  responseDocs: Record<string, string>;
  status: Record<string, ResponseDocStatusSummary>;
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
          const label = docStatusLabel(status[key], Boolean(responseDocs[key]));
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onSelect(key)}
                aria-current={key === selectedKey ? "page" : undefined}
                className={`w-full rounded-lg border px-3 py-3 text-left ${
                  key === selectedKey
                    ? "border-primary/40 bg-primary/10"
                    : "border-transparent hover:border-border hover:bg-muted/60"
                }`}
              >
                <span className="block text-sm font-medium text-foreground">
                  {document.title ?? "Response document"}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
