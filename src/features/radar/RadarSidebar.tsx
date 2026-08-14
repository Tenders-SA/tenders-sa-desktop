import { Link } from "react-router-dom";
import type {
  RadarAccess,
  RadarProfileProjection,
} from "./radar-workspace-model";

export function RadarSidebar({
  profile,
  profileState,
  topGap,
  access,
  onOpenScenario,
}: {
  profile: RadarProfileProjection | null;
  profileState: "ready" | "missing" | "unavailable";
  topGap: string | null;
  access: RadarAccess;
  onOpenScenario?: () => void;
}) {
  return (
    <aside aria-label="Radar profile guidance" className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-card-foreground">
          Profile strength
        </h2>
        {profileState === "unavailable" ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Profile guidance is temporarily unavailable. Your matches remain
            visible.
          </p>
        ) : profile ? (
          <>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {profile.score}%
            </p>
            <ul className="mt-3 space-y-2">
              {profile.signals.map((signal) => (
                <li key={signal.key} className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{signal.label}</span>
                  <span className="font-medium text-foreground">
                    {signal.complete ? "Complete" : `Missing · ${signal.weight}%`}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Complete your company profile to strengthen matching signals.
          </p>
        )}
        <Link to="/company" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          Review company profile
        </Link>
      </section>

      {topGap && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-card-foreground">
            Top improvement
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{topGap}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Most frequent gap across the matches currently loaded.
          </p>
        </section>
      )}

      {(access === "professional" || access === "enterprise") && (
        <section className="rounded-xl border border-primary/25 bg-primary/5 p-4">
          <h2 className="text-sm font-semibold text-foreground">Scenario preview</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Test profile changes against the existing server calculation.
          </p>
          {onOpenScenario && (
            <button type="button" onClick={onOpenScenario} className="mt-3 rounded border border-primary/30 px-3 py-1.5 text-sm font-medium text-primary">
              Open scenario preview
            </button>
          )}
        </section>
      )}
    </aside>
  );
}
