/**
 * Tender-driven Response Blueprint (Slice 3, R-B-1..R-B-6).
 *
 * Renders the parent's plan for this tender: which response documents to
 * generate, which documents the user must have, the steps/milestones, the
 * submission method, risks, and confidence. Purely read-only (R-B-2) — no
 * mutation controls, no timers, no polling. Generation status shown is
 * whatever the last GET returned; the panel reloads only when the workspace
 * does.
 *
 * `blueprint: null` is not an error: the parent answers that before its
 * analysis exists, and the panel must say so honestly (R-B-5).
 */

import { AsyncSection, Panel } from "../../../components/common/AsyncSection";
import { useAsync } from "../../../hooks/use-async";
import type {
  BlueprintPayload,
  ResponseBlueprint,
  ResponseBlueprintDoc,
} from "../../../services/api/endpoints/applications";

export interface ResponseBlueprintPanelProps {
  endpoint: {
    getResponseBlueprint: (
      id: string,
      signal?: AbortSignal,
    ) => Promise<BlueprintPayload>;
  };
  applicationId: string;
}

export function ResponseBlueprintPanel({
  endpoint,
  applicationId,
}: ResponseBlueprintPanelProps) {
  const state = useAsync(
    (signal) => endpoint.getResponseBlueprint(applicationId, signal),
    [endpoint, applicationId],
  );

  return (
    <AsyncSection
      state={state}
      subject="the response blueprint"
      onRetry={state.reload}
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
        />
      )}
    </AsyncSection>
  );
}

function BlueprintView({
  blueprint,
  enriched,
  responseDocs,
  responseDocStatus,
}: {
  blueprint: ResponseBlueprint;
  enriched: boolean;
  responseDocs: Record<string, string>;
  responseDocStatus: Record<
    string,
    { state?: string; error?: string; isFallback?: boolean }
  >;
}) {
  const aiTailored = blueprint.generatedBy === "ai" || enriched;

  return (
    <Panel
      title="Response blueprint"
      aside={
        <span className="flex items-center gap-2">
          <ConfidenceBadge confidence={blueprint.confidence} />
          <span className="text-xs text-muted-foreground">
            {aiTailored ? "AI-tailored" : "Standard plan"}
          </span>
        </span>
      }
    >
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
            {(blueprint.responseDocuments ?? []).map((doc, index) => (
              <ResponseDocRow
                key={doc.key ?? `doc-${index}`}
                doc={doc}
                status={
                  responseDocStatus[doc.key ?? ""] ?? {
                    state: responseDocs[doc.key ?? ""] ? "ready" : undefined,
                  }
                }
                hasContent={Boolean(responseDocs[doc.key ?? ""])}
              />
            ))}
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

function ResponseDocRow({
  doc,
  status,
  hasContent,
}: {
  doc: ResponseBlueprintDoc;
  status: { state?: string; error?: string; isFallback?: boolean };
  hasContent: boolean;
}) {
  const chip = docStatusChip(status, hasContent);
  return (
    <li className="rounded border border-border p-2.5">
      <span className="flex flex-wrap items-baseline gap-2 text-sm text-foreground">
        {doc.title ?? "Response document"}
        {doc.mandatory && <span className="text-destructive">*</span>}
        {chip && <span className={chip.className}>{chip.label}</span>}
      </span>
      {doc.brief && (
        <span className="block text-xs text-muted-foreground">{doc.brief}</span>
      )}
      {doc.requiredBy && (
        <span className="block text-xs text-muted-foreground">
          Required by: {doc.requiredBy}
        </span>
      )}
      {status.error && (
        <span className="block text-xs text-destructive">{status.error}</span>
      )}
    </li>
  );
}

function docStatusChip(
  status: { state?: string; error?: string; isFallback?: boolean },
  hasContent: boolean,
): { label: string; className: string } | undefined {
  if (status.state === "generating") {
    return { label: "Generating…", className: "text-xs text-muted-foreground" };
  }
  if (status.state === "failed") {
    return { label: "Failed", className: "text-xs text-destructive" };
  }
  if (hasContent || status.state === "ready") {
    return {
      label: status.isFallback ? "Saved · template" : "Saved",
      className: "text-xs text-success",
    };
  }
  return undefined;
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
