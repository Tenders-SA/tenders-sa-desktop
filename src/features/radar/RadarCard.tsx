import { Link } from "react-router-dom";
import { ClosingLabel } from "../tenders/ClosingLabel";
import { MatchFactors } from "./MatchFactors";
import {
  classifyRadarScore,
  effectiveRadarScore,
  type RadarBand,
  type RadarWorkspaceMatch,
} from "./radar-workspace-model";

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

const BAND_LABELS: Record<RadarBand, string> = {
  highly_qualified: "Highly qualified",
  potential: "Potential match",
  near_miss: "Near miss",
  not_fit: "Below Radar threshold",
};

export function RadarCard({
  match,
  onToggleSave,
  saveDisabled = false,
  saving = false,
}: {
  match: RadarWorkspaceMatch;
  onToggleSave?: (match: RadarWorkspaceMatch) => void;
  saveDisabled?: boolean;
  saving?: boolean;
}) {
  const displayedScore = effectiveRadarScore(match);
  const displayedBand = classifyRadarScore(displayedScore);
  const ai = match.aiRecommendation;

  return (
    <li>
      <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-card-foreground">
              <Link
                to={`/tenders/${encodeURIComponent(match.tenderId)}`}
                className="hover:underline"
              >
                {match.title}
              </Link>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {match.buyer ?? "Buyer not recorded"}
              {match.province ? ` · ${match.province}` : ""}
            </p>
            {match.referenceNumber && (
              <p className="mt-1 text-xs text-muted-foreground">
                Ref {match.referenceNumber}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xl font-bold text-card-foreground">
              {displayedScore}% match
            </p>
            <p className="text-xs font-medium text-muted-foreground">
              {BAND_LABELS[displayedBand]}
            </p>
            {match.scenarioDelta !== undefined && (
              <p className="mt-1 text-xs font-medium text-primary">
                Projected {match.scenarioDelta >= 0 ? "+" : ""}
                {match.scenarioDelta} points
              </p>
            )}
            {onToggleSave && (
              <button
                type="button"
                disabled={saveDisabled || saving}
                onClick={() => onToggleSave(match)}
                aria-label={match.isSaved ? `Remove ${match.title} from saved tenders` : `Save ${match.title}`}
                className="mt-3 rounded border border-border px-3 py-1.5 text-sm font-medium text-foreground disabled:opacity-50"
              >
                {saving ? "Saving…" : match.isSaved ? "Saved" : "Save tender"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {match.closingDate ? (
            <ClosingLabel closingDate={match.closingDate} />
          ) : (
            <span className="text-muted-foreground">No closing date recorded</span>
          )}
          {match.estimatedValue === null ? (
            <span className="text-muted-foreground">Value not recorded</span>
          ) : (
            <span className="text-muted-foreground">
              Estimated value {ZAR.format(match.estimatedValue)}
            </span>
          )}
        </div>

        {match.factors && <MatchFactors factors={match.factors} />}
        {match.reasoning && (
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {match.reasoning}
          </p>
        )}

        {(match.gaps.length > 0 || match.actions.length > 0) && (
          <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            {match.gaps.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Gaps to address
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {match.gaps.map((gap, index) => (
                    <li key={`${index}-${gap}`}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}
            {match.actions.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Suggested actions
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {match.actions.map((action, index) => (
                    <li key={`${index}-${action}`}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {(ai?.competitivePosition ||
          ai?.successProbability !== undefined ||
          ai?.estimatedTimeToQualify) && (
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            {ai.competitivePosition && (
              <div>
                <dt className="text-xs text-muted-foreground">Competitive position</dt>
                <dd className="text-foreground">{ai.competitivePosition}</dd>
              </div>
            )}
            {typeof ai.successProbability === "number" && (
              <div>
                <dt className="text-xs text-muted-foreground">Success probability</dt>
                <dd className="text-foreground">{ai.successProbability}%</dd>
              </div>
            )}
            {ai.estimatedTimeToQualify && (
              <div>
                <dt className="text-xs text-muted-foreground">Time to qualify</dt>
                <dd className="text-foreground">{ai.estimatedTimeToQualify}</dd>
              </div>
            )}
          </dl>
        )}
      </article>
    </li>
  );
}
