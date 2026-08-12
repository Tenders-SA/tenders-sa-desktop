import { describe, expect, it } from "vitest";
import {
  deriveWorkflowStages,
  isWorkflowStage,
} from "../features/applications/workflow/workflow-state";
import type {
  CockpitPayload,
  ResponseBlueprint,
} from "../services/api/endpoints/applications";

function cockpit(overrides: Partial<CockpitPayload> = {}): CockpitPayload {
  return {
    application: { id: "a1", status: "DRAFT" },
    tender: { id: "t1", title: "Security services" },
    ...overrides,
  };
}

const blueprint: ResponseBlueprint = {
  tenderId: "t1",
  responseDocuments: [
    { key: "cover_letter", title: "Cover letter" },
    { key: "methodology", title: "Methodology" },
  ],
};

describe("desktop tender assistance workflow state", () => {
  it("keeps the canonical stage order and recognises only its slugs", () => {
    expect(deriveWorkflowStages({}).map((stage) => stage.stage)).toEqual([
      "understand",
      "qualify",
      "plan",
      "draft",
      "review",
    ]);
    expect(isWorkflowStage("draft")).toBe(true);
    expect(isWorkflowStage("submitted")).toBe(false);
  });

  it("reports every stage as not assessed when its evidence is absent", () => {
    expect(deriveWorkflowStages({}).map((stage) => stage.stateLabel)).toEqual([
      "Not assessed",
      "Not assessed",
      "Not assessed",
      "Not assessed",
      "Not assessed",
    ]);
  });

  it("uses existing analysis, readiness and checklist evidence", () => {
    const stages = deriveWorkflowStages({
      cockpit: cockpit({
        analysisStatus: { status: "complete", progress: 100 },
        readiness: { score: 65, overall: "needs_attention" },
        checklistState: [
          { id: "c1", label: "Tax clearance", completed: false },
        ],
      }),
    });

    expect(stages.find((stage) => stage.stage === "understand")?.state).toBe(
      "complete",
    );
    expect(stages.find((stage) => stage.stage === "qualify")?.state).toBe(
      "attention",
    );
    expect(stages.find((stage) => stage.stage === "review")?.state).toBe(
      "attention",
    );
  });

  it("marks planning complete only when a blueprint has loaded", () => {
    expect(
      deriveWorkflowStages({ blueprint }).find(
        (stage) => stage.stage === "plan",
      )?.state,
    ).toBe("complete");
    expect(
      deriveWorkflowStages({ blueprint: null }).find(
        (stage) => stage.stage === "plan",
      )?.state,
    ).toBe("not-assessed");
  });

  it("derives draft state from existing saved and failed document evidence", () => {
    const partial = deriveWorkflowStages({
      blueprint,
      responseDocs: { cover_letter: "Saved letter" },
    }).find((stage) => stage.stage === "draft");
    const complete = deriveWorkflowStages({
      blueprint,
      responseDocs: {
        cover_letter: "Saved letter",
        methodology: "Saved method",
      },
    }).find((stage) => stage.stage === "draft");
    const failed = deriveWorkflowStages({
      blueprint,
      responseDocStatus: { methodology: { state: "failed" } },
    }).find((stage) => stage.stage === "draft");

    expect(partial?.state).toBe("attention");
    expect(complete?.state).toBe("complete");
    expect(failed?.state).toBe("attention");
  });

  it("does not reinterpret the parent application status as workflow progress", () => {
    const stages = deriveWorkflowStages({
      cockpit: cockpit({ application: { status: "DRAFT" } }),
    });
    expect(stages.every((stage) => stage.state === "not-assessed")).toBe(true);
  });
});
