import type {
  CockpitPayload,
  ResponseBlueprint,
  ResponseDocStatus,
} from "../../../services/api/endpoints/applications";

export const WORKFLOW_STAGES = [
  { slug: "understand", label: "Understand" },
  { slug: "qualify", label: "Qualify" },
  { slug: "plan", label: "Plan" },
  { slug: "draft", label: "Draft" },
  { slug: "review", label: "Review & Export" },
] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number]["slug"];
export type WorkflowStageState = "complete" | "attention" | "not-assessed";

export interface WorkflowStageSummary {
  stage: WorkflowStage;
  label: string;
  state: WorkflowStageState;
  stateLabel: "Complete" | "Needs attention" | "Not assessed";
}

export interface WorkflowEvidence {
  cockpit?: CockpitPayload;
  blueprint?: ResponseBlueprint | null;
  responseDocs?: Record<string, string>;
  responseDocStatus?: Record<string, ResponseDocStatus>;
}

export function isWorkflowStage(
  value: string | undefined,
): value is WorkflowStage {
  return WORKFLOW_STAGES.some((stage) => stage.slug === value);
}

export function deriveWorkflowStages(
  evidence: WorkflowEvidence,
): WorkflowStageSummary[] {
  return WORKFLOW_STAGES.map((stage) => {
    const state = deriveStageState(stage.slug, evidence);
    return {
      stage: stage.slug,
      label: stage.label,
      state,
      stateLabel:
        state === "complete"
          ? "Complete"
          : state === "attention"
            ? "Needs attention"
            : "Not assessed",
    };
  });
}

function deriveStageState(
  stage: WorkflowStage,
  evidence: WorkflowEvidence,
): WorkflowStageState {
  switch (stage) {
    case "understand":
      return analysisState(evidence.cockpit);
    case "qualify":
      return qualificationState(evidence.cockpit);
    case "plan":
      return evidence.blueprint ? "complete" : "not-assessed";
    case "draft":
      return draftState(evidence);
    case "review":
      return reviewState(evidence.cockpit);
  }
}

function analysisState(
  cockpit: CockpitPayload | undefined,
): WorkflowStageState {
  const status = cockpit?.analysisStatus?.status?.toLowerCase();
  if (!status) return "not-assessed";
  if (status === "complete" || status === "completed") return "complete";
  if (status === "failed" || status === "error") return "attention";
  return "not-assessed";
}

function qualificationState(
  cockpit: CockpitPayload | undefined,
): WorkflowStageState {
  const overall = cockpit?.readiness?.overall?.toLowerCase();
  if (!overall) return "not-assessed";
  if (["ready", "eligible", "complete"].includes(overall)) return "complete";
  return "attention";
}

function draftState(evidence: WorkflowEvidence): WorkflowStageState {
  const documents = evidence.blueprint?.responseDocuments;
  if (!documents || documents.length === 0) return "not-assessed";

  const keys = documents
    .map((document) => document.key)
    .filter((key): key is string => Boolean(key));
  if (keys.length === 0) return "not-assessed";

  const failed = keys.some(
    (key) => evidence.responseDocStatus?.[key]?.state === "failed",
  );
  if (failed) return "attention";

  const saved = keys.filter((key) => Boolean(evidence.responseDocs?.[key]));
  if (saved.length === keys.length) return "complete";
  if (saved.length > 0) return "attention";
  return "not-assessed";
}

function reviewState(cockpit: CockpitPayload | undefined): WorkflowStageState {
  const applicationStatus = cockpit?.application.status?.toUpperCase();
  if (applicationStatus === "SUBMITTED" || applicationStatus === "AWARDED") {
    return "complete";
  }

  const checklist = cockpit?.checklistState;
  if (!checklist || checklist.length === 0) return "not-assessed";
  return checklist.every((item) => item.completed === true)
    ? "complete"
    : "attention";
}
