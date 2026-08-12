/**
 * Tender-driven Response Blueprint (Slice 3, R-B-1..R-B-6; Slice 4
 * authoring, R-A-1..R-A-5; Slice 5 deep-analyse, R-E-1..R-E-5).
 *
 * Renders the parent's plan for this tender: which response documents to
 * generate, which documents the user must have, the steps/milestones, the
 * submission method, risks, and confidence. Since Slice 4 the panel also
 * carries the authoring actions — Generate, Edit/Save, Regenerate, Retry —
 * each an explicit human press (R-W-7). After a Generate 202 the panel runs
 * a bounded follow-up refresh (R-A-3); steady state stays timer-free. Since
 * Slice 5 the header carries Deep-analyse, the Pro-tier enrichment action
 * (R-E-1..R-E-5).
 *
 * `blueprint: null` is not an error: the parent answers that before its
 * analysis exists, and the panel must say so honestly (R-B-5).
 */

import { useState } from "react";
import { AsyncSection, Panel } from "../../../components/common/AsyncSection";
import { ApiError } from "../../../services/api/errors";
import { describeApiError } from "../../../services/api/describe-error";
import type {
  BlueprintPayload,
  EnrichBlueprintResult,
  ExportPackageFormat,
  ExportPackageResult,
  GenerateResponseDocResult,
  ResponseBlueprint,
  ResponseDocSaveResult,
} from "../../../services/api/endpoints/applications";
import {
  createTauriSavePort,
  saveDownload,
  type SaveDownloadPort,
} from "../../../services/storage/save-download";
import { ResponseBlueprintDocRow } from "./ResponseBlueprintDocRow";
import {
  useResponseBlueprintWorkspace,
  type ResponseBlueprintOverlay,
} from "../workflow/use-response-blueprint-workspace";

export interface ResponseBlueprintPanelProps {
  endpoint: {
    getResponseBlueprint: (
      id: string,
      signal?: AbortSignal,
    ) => Promise<BlueprintPayload>;
    generateResponseDocument: (
      id: string,
      key: string,
      prompt?: string,
      signal?: AbortSignal,
    ) => Promise<GenerateResponseDocResult>;
    saveResponseDocument: (
      id: string,
      key: string,
      content: string,
      signal?: AbortSignal,
    ) => Promise<ResponseDocSaveResult>;
    enrichBlueprint: (
      id: string,
      signal?: AbortSignal,
    ) => Promise<EnrichBlueprintResult>;
    exportWorkspacePackage: (
      id: string,
      format: ExportPackageFormat,
      signal?: AbortSignal,
    ) => Promise<ExportPackageResult>;
  };
  applicationId: string;
  /**
   * Where the downloaded package lands. Defaults to the real Tauri
   * save-dialog port; injectable so screens can drive the whole flow
   * without a Tauri runtime (Slice 6, R-Ex-3).
   */
  savePort?: SaveDownloadPort;
}

export function ResponseBlueprintPanel({
  endpoint,
  applicationId,
  savePort = createTauriSavePort(),
}: ResponseBlueprintPanelProps) {
  const workspace = useResponseBlueprintWorkspace(endpoint, applicationId);

  return (
    <AsyncSection
      state={workspace.state}
      subject="the response blueprint"
      onRetry={workspace.reload}
      isEmpty={(payload) => !payload.blueprint}
      empty={
        <Panel title="Response blueprint">
          <p className="text-sm text-muted-foreground">
            No response blueprint for this tender yet.
          </p>
        </Panel>
      }
    >
      {(payload) => (
        <BlueprintView
          blueprint={payload.blueprint!}
          enriched={payload.enriched === true}
          responseDocs={payload.responseDocs ?? {}}
          responseDocStatus={payload.responseDocStatus ?? {}}
          overlay={workspace.overlay}
          endpoint={endpoint}
          applicationId={applicationId}
          savePort={savePort}
          onGenerate={workspace.generate}
          onSave={workspace.save}
          onReload={workspace.reload}
        />
      )}
    </AsyncSection>
  );
}

/** Deep-analyse outcomes: idle, in flight, or a non-fatal message (R-E-4). */
type EnrichState =
  | { status: "idle" }
  | { status: "working" }
  | { status: "error"; message: string };

/**
 * Export outcomes (Slice 6, R-Ex-1/R-Ex-4): idle, the inline PDF/DOCX
 * choice open, in flight, or a failed-pass message. A cancelled save dialog
 * resolves silently back to idle — it is the user's decision, not an error
 * (R-Ex-3).
 */
type ExportState =
  | { status: "idle" }
  | { status: "open" }
  | { status: "working" }
  | { status: "error"; message: string };

function BlueprintView({
  blueprint,
  enriched,
  responseDocs,
  responseDocStatus,
  overlay,
  endpoint,
  applicationId,
  savePort,
  onGenerate,
  onSave,
  onReload,
}: {
  blueprint: ResponseBlueprint;
  enriched: boolean;
  responseDocs: Record<string, string>;
  responseDocStatus: Record<
    string,
    { state?: string; error?: string; isFallback?: boolean }
  >;
  overlay: ResponseBlueprintOverlay;
  endpoint: ResponseBlueprintPanelProps["endpoint"];
  applicationId: string;
  savePort: SaveDownloadPort;
  onGenerate: (key: string) => Promise<void>;
  onSave: (key: string, content: string) => Promise<void>;
  onReload: () => void;
}) {
  const aiTailored = blueprint.generatedBy === "ai" || enriched;
  const [enrich, setEnrich] = useState<EnrichState>({ status: "idle" });
  const [exportState, setExportState] = useState<ExportState>({
    status: "idle",
  });

  function deepAnalyse() {
    setEnrich({ status: "working" });
    endpoint
      .enrichBlueprint(applicationId)
      .then((result) => {
        if (result.enriched === true) {
          setEnrich({ status: "idle" });
          // The GET re-merges the cached enrichment and reports `enriched:
          // true` (response-blueprint/route.ts) — one reload adopts it from
          // the single source of truth (R-E-2).
          onReload();
        } else {
          setEnrich({
            status: "error",
            message: describeEnrichReason(result.reason),
          });
        }
      })
      .catch((error: unknown) => {
        setEnrich({ status: "error", message: describeEnrichError(error) });
      });
  }

  /** One POST per press (R-Ex-1); a cancelled dialog stays silent (R-Ex-3). */
  function exportPackage(format: ExportPackageFormat) {
    setExportState({ status: "working" });
    endpoint
      .exportWorkspacePackage(applicationId, format)
      .then((result) => saveDownload(savePort, result))
      .then(() => setExportState({ status: "idle" }))
      .catch((error: unknown) => {
        setExportState({
          status: "error",
          message: describeExportError(error),
        });
      });
  }

  const exporting = exportState.status === "working";

  return (
    <Panel
      title="Response blueprint"
      aside={
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={deepAnalyse}
            disabled={enrich.status === "working"}
            className="rounded border border-border px-2 py-1 text-xs text-foreground disabled:opacity-50"
          >
            {enrich.status === "working" ? "Analysing…" : "Deep-analyse"}
          </button>
          <button
            type="button"
            onClick={() =>
              setExportState(
                exportState.status === "open"
                  ? { status: "idle" }
                  : { status: "open" },
              )
            }
            disabled={exporting}
            className="rounded border border-border px-2 py-1 text-xs text-foreground disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export"}
          </button>
          {exportState.status === "open" && (
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => exportPackage("pdf")}
                disabled={exporting}
                className="rounded border border-border px-1.5 py-0.5 text-xs text-foreground disabled:opacity-50"
              >
                PDF
              </button>
              <button
                type="button"
                onClick={() => exportPackage("docx")}
                disabled={exporting}
                className="rounded border border-border px-1.5 py-0.5 text-xs text-foreground disabled:opacity-50"
              >
                DOCX
              </button>
            </span>
          )}
          <ConfidenceBadge confidence={blueprint.confidence} />
          <span className="text-xs text-muted-foreground">
            {aiTailored ? "AI-tailored" : "Standard plan"}
          </span>
        </span>
      }
    >
      {enrich.status === "error" && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {enrich.message}
        </p>
      )}
      {exportState.status === "error" && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {exportState.message}
        </p>
      )}
      {blueprint.industry?.name && (
        <p className="mb-3 text-xs text-muted-foreground">
          Industry: {blueprint.industry.name}
        </p>
      )}

      {(blueprint.responseDocuments?.length ?? 0) > 0 && (
        <section className="mb-4">
          <h4 className="mb-2 text-sm font-semibold text-foreground">
            Response documents
          </h4>
          <ul className="space-y-2">
            {(blueprint.responseDocuments ?? []).map((doc, index) => {
              const key = doc.key ?? `doc-${index}`;
              const content = overlay.docs?.[key] ?? responseDocs[key];
              const status =
                overlay.status?.[key] ??
                responseDocStatus[key] ??
                (content ? { state: "ready" as const } : { state: undefined });
              return (
                <ResponseBlueprintDocRow
                  key={key}
                  doc={doc}
                  status={status}
                  hasContent={Boolean(content)}
                  content={content}
                  onGenerate={onGenerate}
                  onSave={onSave}
                />
              );
            })}
          </ul>
        </section>
      )}

      {(blueprint.requiredUserDocuments?.length ?? 0) > 0 && (
        <section className="mb-4">
          <h4 className="mb-2 text-sm font-semibold text-foreground">
            Required documents
          </h4>
          <ul className="space-y-1.5">
            {(blueprint.requiredUserDocuments ?? []).map((doc, index) => (
              <li key={`${doc.name}-${index}`} className="flex gap-2 text-sm">
                <span className="text-foreground">
                  {doc.name ?? "Unnamed document"}
                  {doc.mandatory && <span className="text-destructive">*</span>}
                </span>
                {doc.source && (
                  <span className="text-xs text-muted-foreground">
                    ({doc.source})
                  </span>
                )}
                {doc.note && (
                  <span className="text-xs text-muted-foreground">
                    — {doc.note}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(blueprint.steps?.length ?? 0) > 0 && (
        <section className="mb-4">
          <h4 className="mb-2 text-sm font-semibold text-foreground">Steps</h4>
          <ol className="space-y-2">
            {(blueprint.steps ?? []).map((step, index) => (
              <li key={step.key ?? `step-${index}`} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-border text-xs text-foreground">
                  {index + 1}
                </span>
                <span>
                  <span className="flex flex-wrap items-baseline gap-2 text-sm text-foreground">
                    {step.title ?? "Step"}
                    {step.mandatory && (
                      <span className="text-destructive">*</span>
                    )}
                    {step.category && (
                      <span className="text-xs text-muted-foreground">
                        ({step.category})
                      </span>
                    )}
                    {step.dueDate && <DueDate dueDate={step.dueDate} />}
                  </span>
                  {step.detail && (
                    <span className="block text-xs text-muted-foreground">
                      {step.detail}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <SubmissionBox submission={blueprint.submission} />

      {(blueprint.risks?.length ?? 0) > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-semibold text-warning">Risks</h4>
          <ul className="space-y-1.5">
            {(blueprint.risks ?? []).map((risk, index) => (
              <li
                key={`risk-${index}`}
                className="flex gap-2 text-sm text-muted-foreground"
              >
                <span className="text-warning">•</span>
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Panel>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string | undefined }) {
  if (!confidence) return null;
  const className =
    confidence === "high"
      ? "bg-success/10 text-success"
      : confidence === "medium"
        ? "bg-warning/10 text-warning"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${className}`}
      title="Confidence of the plan"
    >
      {confidence}
    </span>
  );
}

/**
 * The enrich 402 carries no machine code (the route gates on tier only), so
 * the copy is keyed off the action — never off the server's `error` string
 * (R-E-3). Every other failure goes through `describeApiError`.
 */
function describeEnrichError(error: unknown): string {
  if (error instanceof ApiError && error.kind === "payment-required") {
    return "Deep-analyse needs the Professional plan.";
  }
  return describeApiError(error, "the deep-analyse").message;
}

/**
 * `enriched: false` is not an error — the deterministic plan still renders
 * (R-E-4). The parent's `reason` is its own prose; this fixed copy says what
 * to do instead.
 */
function describeEnrichReason(reason: string | undefined): string {
  switch (reason) {
    case "analysis_triggered":
      return "The tender is still being analysed — try deep-analyse again shortly.";
    case "no_analysis":
      return "There's no tender analysis to deep-analyse yet.";
    case "ai_unavailable":
      return "AI analysis is unavailable right now — the standard plan is shown.";
    default:
      return "Could not deep-analyse this application right now.";
  }
}

/**
 * Export failure copy (Slice 6, R-Ex-4/R-Ex-5). The 409 "nothing generated
 * yet" gate is keyed off the status — the route's `error` string is never
 * shown verbatim. 5xx / network / local write failures get the fixed
 * retryable copy; every other ApiError keeps the shared describe copy.
 */
function describeExportError(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return "Generate your proposal documents before exporting.";
  }
  if (
    !(error instanceof ApiError) ||
    error.kind === "server" ||
    error.kind === "offline" ||
    error.kind === "timeout"
  ) {
    return "Could not export right now.";
  }
  return describeApiError(error, "the export").message;
}

function SubmissionBox({
  submission,
}: {
  submission: ResponseBlueprint["submission"];
}) {
  const rows: Array<[string, string]> = [];
  if (submission?.method) rows.push(["Method", submission.method]);
  if (submission?.deadline)
    rows.push(["Deadline", formatDate(submission.deadline)]);
  if (submission?.portalUrl) rows.push(["Portal", submission.portalUrl]);
  if (submission?.address) rows.push(["Address", submission.address]);
  if (submission?.contact) rows.push(["Contact", submission.contact]);
  if (submission?.notes) rows.push(["Notes", submission.notes]);
  if (rows.length === 0) return null;

  return (
    <section className="mb-4">
      <h4 className="mb-2 text-sm font-semibold text-foreground">Submission</h4>
      <dl className="space-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
            <dd className="text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DueDate({ dueDate }: { dueDate: string }) {
  return (
    <span className="text-xs text-muted-foreground">{formatDate(dueDate)}</span>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
