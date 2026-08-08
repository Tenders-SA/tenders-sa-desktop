/**
 * The parent's workspace lifecycle stepper (R-W-4, R-W-7).
 *
 * Eight parent stages, current stage from the board summary route, and the
 * three explicit human actions the parent PATCH accepts: move stage, change
 * status, archive. There is deliberately **no restore** control — the parent
 * deployment's `restore` action is broken (malformed `isArchived: true: false`
 * literal, verified live 2026-08-08), so offering it would fail every time.
 *
 * A 400 from a status transition renders the parent's `error` and `allowed`
 * list verbatim: the parent owns the transition rules, not this client.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AsyncSection } from "../../../components/common/AsyncSection";
import { useAsync } from "../../../hooks/use-async";
import { ApiError } from "../../../services/api/errors";
import {
  WORKSPACE_STAGE_LABELS,
  WORKSPACE_STAGES,
  type WorkspaceStage,
  type WorkspaceUpdateResult,
} from "../../../services/api/endpoints/applications";

export interface StageBarProps {
  endpoint: {
    getWorkspaceStage: (
      id: string,
      signal?: AbortSignal,
    ) => Promise<WorkspaceStage | undefined>;
    updateWorkspace: (
      id: string,
      action: "status" | "stage" | "remove",
      body: Record<string, unknown>,
      signal?: AbortSignal,
    ) => Promise<WorkspaceUpdateResult>;
  };
  applicationId: string;
  /** Detail-route status, used only to fall back when the board is unknown. */
  applicationStatus: string;
  /** Lets the orchestrator refetch its detail after a status change. */
  onChanged?: () => void;
}

type ActionState =
  | { status: "idle" }
  | { status: "working" }
  | { status: "done"; message: string }
  | { status: "error"; message: string };

export function StageBar({
  endpoint,
  applicationId,
  applicationStatus,
  onChanged,
}: StageBarProps) {
  const state = useAsync(
    (signal) => endpoint.getWorkspaceStage(applicationId, signal),
    [endpoint, applicationId],
  );

  return (
    <AsyncSection
      state={state}
      subject="the workspace stage"
      onRetry={state.reload}
    >
      {(stage) => (
        <StageBarControls
          endpoint={endpoint}
          applicationId={applicationId}
          stage={stage}
          applicationStatus={applicationStatus}
          onChanged={onChanged}
          onRefetch={state.reload}
        />
      )}
    </AsyncSection>
  );
}

function StageBarControls({
  endpoint,
  applicationId,
  stage,
  applicationStatus,
  onChanged,
  onRefetch,
}: {
  endpoint: StageBarProps["endpoint"];
  applicationId: string;
  stage: WorkspaceStage | undefined;
  applicationStatus: string;
  onChanged?: () => void;
  onRefetch: () => void;
}) {
  const navigate = useNavigate();
  const [moveTo, setMoveTo] = useState("");
  const [statusTo, setStatusTo] = useState("");
  const [action, setAction] = useState<ActionState>({ status: "idle" });

  const currentIndex = stage ? WORKSPACE_STAGES.indexOf(stage) : -1;

  function run(
    kind: "status" | "stage" | "remove",
    body: Record<string, unknown>,
    doneMessage: string,
  ) {
    setAction({ status: "working" });
    endpoint
      .updateWorkspace(applicationId, kind, body)
      .then(() => {
        setAction({ status: "done", message: doneMessage });
        setMoveTo("");
        setStatusTo("");
        onRefetch();
        onChanged?.();
      })
      .catch((error: unknown) => {
        setAction({ status: "error", message: describeUpdateError(error) });
      });
  }

  function archive() {
    if (
      !window.confirm(
        "Archive this application? It will disappear from the workspace.",
      )
    ) {
      return;
    }
    setAction({ status: "working" });
    endpoint
      .updateWorkspace(applicationId, "remove", {})
      .then(() => navigate("/applications"))
      .catch((error: unknown) => {
        setAction({ status: "error", message: describeUpdateError(error) });
      });
  }

  return (
    <div>
      <ol
        className="flex flex-wrap items-center gap-1"
        aria-label="Workspace stage"
      >
        {WORKSPACE_STAGES.map((candidate, index) => {
          const reached = stage !== undefined && index <= currentIndex;
          const isCurrent = stage !== undefined && index === currentIndex;
          return (
            <li
              key={candidate}
              className={`flex items-center gap-1 text-xs ${
                isCurrent
                  ? "font-semibold text-primary"
                  : reached
                    ? "text-foreground"
                    : "text-muted-foreground"
              }`}
            >
              {index > 0 && <span aria-hidden="true">→</span>}
              {isCurrent ? (
                <span data-current-stage>
                  {WORKSPACE_STAGE_LABELS[candidate]}
                </span>
              ) : (
                <span>{WORKSPACE_STAGE_LABELS[candidate]}</span>
              )}
            </li>
          );
        })}
      </ol>

      {stage === undefined && (
        <p className="mt-2 text-sm text-muted-foreground">
          The workspace stage is managed on the Tenders-SA website; it could not
          be read here.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Move to stage
          </span>
          <select
            value={moveTo}
            onChange={(event) => setMoveTo(event.target.value)}
            className="rounded border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">Choose a stage…</option>
            {WORKSPACE_STAGES.filter((candidate) => candidate !== stage).map(
              (candidate) => (
                <option key={candidate} value={candidate}>
                  {WORKSPACE_STAGE_LABELS[candidate]}
                </option>
              ),
            )}
          </select>
        </label>
        <button
          type="button"
          disabled={action.status === "working" || moveTo === ""}
          onClick={() =>
            run(
              "stage",
              { stage: moveTo, baseStage: stage ?? null },
              `Moved to ${WORKSPACE_STAGE_LABELS[moveTo as WorkspaceStage].toLowerCase()}.`,
            )
          }
          className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
        >
          {action.status === "working" ? "Working…" : "Move"}
        </button>

        {stage !== undefined && (
          <button
            type="button"
            disabled={action.status === "working"}
            onClick={() =>
              run("stage", { stage: null }, "Stage override cleared.")
            }
            className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
          >
            Clear override
          </button>
        )}

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Change status
          </span>
          <select
            value={statusTo}
            onChange={(event) => setStatusTo(event.target.value)}
            className="rounded border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">Choose a status…</option>
            {["DRAFT", "SUBMITTED"]
              .filter((candidate) => candidate !== applicationStatus)
              .map((candidate) => (
                <option key={candidate} value={candidate}>
                  {candidate}
                </option>
              ))}
          </select>
        </label>
        <button
          type="button"
          disabled={action.status === "working" || statusTo === ""}
          onClick={() => run("status", { status: statusTo }, "Status updated.")}
          className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
        >
          {action.status === "working" ? "Working…" : "Set status"}
        </button>

        <button
          type="button"
          disabled={action.status === "working"}
          onClick={archive}
          className="rounded border border-destructive px-3 py-1.5 text-sm text-destructive disabled:opacity-50"
        >
          Archive
        </button>
      </div>

      {action.status === "done" && (
        <p role="status" className="mt-2 text-sm text-success">
          {action.message}
        </p>
      )}
      {action.status === "error" && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {action.message}
        </p>
      )}
    </div>
  );
}

/**
 * Copy for a failed lifecycle action (R-W-4).
 *
 * Deliberately **not** `describeApiError`: that function hides the server's
 * message behind generic read copy, but a status change the parent rejects is
 * the parent telling the user what it *will* accept. Its `error` and
 * `allowed` list are the answer and must render verbatim.
 */
function describeUpdateError(error: unknown): string {
  if (error instanceof ApiError && error.message) {
    const allowed =
      error.allowed && error.allowed.length > 0
        ? ` Allowed transitions: ${error.allowed.join(", ")}.`
        : "";
    return `${error.message}${allowed}`;
  }
  return "The workspace update could not be completed.";
}
