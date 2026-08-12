import { useState } from "react";
import { Panel } from "../../../components/common/AsyncSection";
import type { AsyncState } from "../../../hooks/use-async";
import { ApiError } from "../../../services/api/errors";
import { describeApiError } from "../../../services/api/describe-error";
import type {
  ApplicationsEndpoint,
  CockpitPayload,
  ExportPackageFormat,
  SubmissionReadiness,
} from "../../../services/api/endpoints/applications";
import {
  createTauriSavePort,
  saveDownload,
  type SaveDownloadPort,
} from "../../../services/storage/save-download";
import { ChecklistPanel } from "../workspace/ChecklistPanel";
import { EventsPanel } from "../workspace/EventsPanel";
import { ComplianceGapsPanel } from "../workspace/ComplianceGapsPanel";
import { useResponseBlueprintWorkspace } from "./use-response-blueprint-workspace";

export function ReviewStage({
  applicationId,
  endpoint,
  cockpitState,
  savePort = createTauriSavePort(),
}: {
  applicationId: string;
  endpoint: ApplicationsEndpoint;
  cockpitState: AsyncState<CockpitPayload>;
  savePort?: SaveDownloadPort;
}) {
  const blueprint = useResponseBlueprintWorkspace(endpoint, applicationId);
  const [readiness, setReadiness] = useState<
    | { state: "idle" | "checking" }
    | { state: "ready"; value: SubmissionReadiness }
    | { state: "error"; message: string }
  >({ state: "idle" });
  const [exportState, setExportState] = useState<
    "idle" | "exporting" | "error"
  >("idle");
  const [exportError, setExportError] = useState<string>();

  function validate() {
    setReadiness({ state: "checking" });
    endpoint
      .validate(applicationId)
      .then((value) => setReadiness({ state: "ready", value }))
      .catch((error: unknown) =>
        setReadiness({
          state: "error",
          message: describeApiError(error, "the readiness check").message,
        }),
      );
  }

  function exportPackage(format: ExportPackageFormat) {
    setExportState("exporting");
    setExportError(undefined);
    endpoint
      .exportWorkspacePackage(applicationId, format)
      .then((result) => saveDownload(savePort, result))
      .then(() => setExportState("idle"))
      .catch((error: unknown) => {
        setExportState("error");
        setExportError(describeExportError(error));
      });
  }

  return (
    <div className="space-y-5">
      <Panel
        title="Submission readiness"
        aside={
          <button
            type="button"
            onClick={validate}
            disabled={readiness.state === "checking"}
            className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {readiness.state === "checking" ? "Checking…" : "Check readiness"}
          </button>
        }
      >
        {readiness.state === "idle" && (
          <p className="text-sm text-muted-foreground">
            Run the existing readiness check before exporting your response
            package.
          </p>
        )}
        {readiness.state === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {readiness.message}
          </p>
        )}
        {readiness.state === "ready" && (
          <ReadinessResult readiness={readiness.value} />
        )}
      </Panel>

      <ComplianceGapsPanel endpoint={endpoint} applicationId={applicationId} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChecklistPanel state={cockpitState} />
        <EventsPanel state={cockpitState} />
      </div>

      <Panel title="Generated response coverage">
        {blueprint.state.status === "loading" && (
          <p role="status" className="text-sm text-muted-foreground">
            Loading response coverage…
          </p>
        )}
        {blueprint.state.status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            Could not load response coverage right now.
          </p>
        )}
        {blueprint.state.status === "ready" && (
          <Coverage
            documents={blueprint.state.value.blueprint?.responseDocuments ?? []}
            responseDocs={{
              ...(blueprint.state.value.responseDocs ?? {}),
              ...(blueprint.overlay.docs ?? {}),
            }}
          />
        )}
      </Panel>

      <Panel title="Export response package">
        <p className="text-sm text-muted-foreground">
          Export creates a working PDF or Word package. It does not submit the
          bid to the buyer or approve its contents.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportPackage("pdf")}
            disabled={exportState === "exporting"}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Export PDF
          </button>
          <button
            type="button"
            onClick={() => exportPackage("docx")}
            disabled={exportState === "exporting"}
            className="rounded border border-border px-4 py-2 text-sm disabled:opacity-50"
          >
            Export Word
          </button>
        </div>
        {exportState === "exporting" && (
          <p role="status" className="mt-2 text-sm text-muted-foreground">
            Exporting package…
          </p>
        )}
        {exportState === "error" && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {exportError}
          </p>
        )}
      </Panel>
    </div>
  );
}

function ReadinessResult({ readiness }: { readiness: SubmissionReadiness }) {
  return (
    <div>
      <p
        className={
          readiness.ready
            ? "text-sm font-medium text-success"
            : "text-sm font-medium text-warning"
        }
      >
        {readiness.ready
          ? "No outstanding items were found."
          : "This bid is not ready to export as final."}
      </p>
      <IssueList heading="Blocking items" items={readiness.blockers} />
      <IssueList heading="Worth checking" items={readiness.warnings} />
    </div>
  );
}

function IssueList({ heading, items }: { heading: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </h3>
      <ul className="mt-1 space-y-1">
        {items.map((item, index) => (
          <li key={`${index}-${item}`} className="text-sm text-foreground">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Coverage({
  documents,
  responseDocs,
}: {
  documents: Array<{ key?: string; title?: string }>;
  responseDocs: Record<string, string>;
}) {
  const prepared = documents.filter(
    (document) => document.key && responseDocs[document.key],
  ).length;
  return (
    <div>
      <p className="text-sm font-medium text-foreground">
        {prepared} of {documents.length} response documents prepared
      </p>
      <ul className="mt-3 space-y-1">
        {documents.map((document, index) => {
          const key = document.key ?? `doc-${index}`;
          const saved = Boolean(responseDocs[key]);
          return (
            <li key={key} className="flex gap-2 text-sm">
              <span className={saved ? "text-success" : "text-warning"}>
                {saved ? "Prepared" : "Outstanding"}
              </span>
              <span>{document.title ?? "Response document"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function describeExportError(error: unknown): string {
  if (error instanceof ApiError && error.status === 409)
    return "Generate your proposal documents before exporting.";
  if (
    !(error instanceof ApiError) ||
    error.kind === "server" ||
    error.kind === "offline" ||
    error.kind === "timeout"
  )
    return "Could not export right now.";
  return describeApiError(error, "the export").message;
}
