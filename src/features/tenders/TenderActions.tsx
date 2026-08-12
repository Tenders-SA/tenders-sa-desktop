import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Panel } from "../../components/common/AsyncSection";
import { describeApiError } from "../../services/api/describe-error";
import {
  describeEligibility,
  type EligibilityEndpoint,
  type EligibilityResult,
} from "../../services/api/endpoints/eligibility";
import type { ApplicationsEndpoint } from "../../services/api/endpoints/applications";
import type { SavedTendersEndpoint } from "../../services/api/endpoints/saved-tenders";

export interface TenderActionsProps {
  tenderId: string;
  eligibility: EligibilityEndpoint;
  savedTenders: SavedTendersEndpoint;
  applications: ApplicationsEndpoint;
}

/**
 * The decisions a user makes about one tender (brief §4.1 steps 5–6).
 *
 * Three actions, in the order the workflow uses them: check whether the
 * company qualifies, shortlist it, and commit to pursuing it.
 *
 * **Starting an application is a bid decision**, which brief §4.3 reserves for
 * a human. So it is an explicit button that appears once and is never
 * triggered by merely viewing a tender, and the eligibility check is offered
 * *before* it rather than after — the point is to inform the decision, not to
 * rubber-stamp it.
 *
 * Nothing here is loaded on mount. Each of the three is a deliberate action:
 * eligibility is a server-side computation, saving is a mutation, and starting
 * an application creates a record.
 */
export function TenderActions({
  tenderId,
  eligibility,
  savedTenders,
  applications,
}: TenderActionsProps) {
  return (
    <div className="mt-6 flex flex-col gap-4">
      <EligibilityPanel endpoint={eligibility} tenderId={tenderId} />
      <div className="flex flex-wrap gap-3">
        <SaveButton endpoint={savedTenders} tenderId={tenderId} />
        <PursueButton endpoint={applications} tenderId={tenderId} />
      </div>
    </div>
  );
}

export function EligibilityPanel({
  endpoint,
  tenderId,
}: {
  endpoint: EligibilityEndpoint;
  tenderId: string;
}) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "checking" }
    | { status: "done"; result: EligibilityResult }
    | { status: "error"; message: string; kind: string }
  >({ status: "idle" });

  return (
    <Panel
      title="Can we bid on this?"
      aside={
        <button
          type="button"
          disabled={state.status === "checking"}
          onClick={() => {
            setState({ status: "checking" });
            endpoint
              .check(tenderId)
              .then((result) => setState({ status: "done", result }))
              .catch((error: unknown) =>
                setState({
                  status: "error",
                  ...describeApiError(error, "the eligibility check"),
                }),
              );
          }}
          className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
        >
          {state.status === "checking" ? "Checking…" : "Check eligibility"}
        </button>
      }
    >
      {state.status === "idle" && (
        <p className="text-sm text-muted-foreground">
          Compare this tender's criteria against your company profile.
        </p>
      )}

      {state.status === "checking" && (
        <p role="status" className="text-sm text-muted-foreground">
          Checking eligibility…
        </p>
      )}

      {state.status === "error" && (
        <p
          role="alert"
          data-error-kind={state.kind}
          className="text-sm text-destructive"
        >
          {state.message}
        </p>
      )}

      {state.status === "done" && <EligibilityReport result={state.result} />}
    </Panel>
  );
}

function EligibilityReport({ result }: { result: EligibilityResult }) {
  return (
    <div>
      {/*
        The verdict is text, and `partial` keeps its own wording. Collapsing it
        into yes/no would either lose a winnable tender or walk the user into a
        disqualification.
      */}
      <p
        className={
          result.eligible === "yes"
            ? "text-sm font-medium text-success"
            : result.eligible === "partial"
              ? "text-sm font-medium text-warning"
              : "text-sm font-medium text-destructive"
        }
      >
        {describeEligibility(result.eligible)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {result.score}% of recorded criteria met
        {typeof result.matchScore === "number"
          ? ` · Tender Radar match ${result.matchScore}%`
          : ""}
      </p>

      {result.checks.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {result.checks.map((check, index) => (
            <li
              key={`${index}-${check.criterion}`}
              className="flex flex-wrap items-baseline gap-x-2 text-sm"
            >
              {/* Pass/fail as a word, never colour alone (A11Y-1). */}
              <span
                className={
                  check.pass
                    ? "w-16 shrink-0 text-success"
                    : "w-16 shrink-0 text-destructive"
                }
              >
                {check.pass ? "Meets" : "Gap"}
              </span>
              <span className="text-foreground">{check.criterion}</span>
              <span className="text-muted-foreground">
                {/* Both sides shown, so a failure explains itself. */}
                required {formatValue(check.required)} · you{" "}
                {formatValue(check.user)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ProblemList heading="Would disqualify a bid" items={result.blockers} />
      <ProblemList heading="Suggested next steps" items={result.suggestions} />
    </div>
  );
}

/** Never renders "null" or an empty gap at the user. */
function formatValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "not recorded";
  const text = String(value).trim();
  return text.length > 0 ? text : "not recorded";
}

function ProblemList({ heading, items }: { heading: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {heading}
      </h3>
      <ul className="mt-1 flex flex-col gap-0.5">
        {items.map((item, index) => (
          <li
            key={`${index}-${item}`}
            className="text-sm text-muted-foreground"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Save / unsave.
 *
 * The route is a toggle, so the server's returned state is the authority --
 * the button reflects what the server says it now is, never what the click
 * assumed. Starting from "unknown" rather than "not saved" avoids claiming a
 * state that has not been read.
 */
function SaveButton({
  endpoint,
  tenderId,
}: {
  endpoint: SavedTendersEndpoint;
  tenderId: string;
}) {
  const [saved, setSaved] = useState<boolean | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError(undefined);
          endpoint
            .toggleSave(tenderId)
            .then(setSaved)
            .catch((error: unknown) => {
              setError(describeApiError(error, "this tender").message);
            })
            .finally(() => setBusy(false));
        }}
        className="rounded border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
      >
        {busy
          ? "Saving…"
          : saved === undefined
            ? "Save to Opportunities"
            : saved
              ? "Saved — click to remove"
              : "Removed — click to save"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Starts an application, which is the bid decision (brief §4.3).
 *
 * On success it navigates into the new workspace, because the user's next step
 * is to work on it. If the parent does not return an id the navigation is
 * skipped rather than guessed at — landing on `/applications/undefined` would
 * be worse than landing on the list.
 */
function PursueButton({
  endpoint,
  tenderId,
}: {
  endpoint: ApplicationsEndpoint;
  tenderId: string;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError(undefined);
          endpoint
            .create(tenderId)
            .then((applicationId) => {
              navigate(
                applicationId
                  ? `/applications/${encodeURIComponent(applicationId)}`
                  : "/applications",
              );
            })
            .catch((error: unknown) => {
              setError(describeApiError(error, "this application").message);
              setBusy(false);
            });
        }}
        className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Starting…" : "Start an application"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
