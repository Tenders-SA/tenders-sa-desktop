/**
 * Closing-urgency banner for the workspace (from the cockpit payload).
 *
 * Colours map urgency level to the semantic status tokens the app already
 * defines — `low` is calm, `normal` is a warning, anything above is
 * destructive. The parent also sends a raw colour string; when it is a hex
 * value it is rendered as a dot, never as the only signal (text always
 * carries the meaning).
 */

import type { AsyncState } from "../../../hooks/use-async";
import { AsyncSection } from "../../../components/common/AsyncSection";
import type { CockpitPayload } from "../../../services/api/endpoints/applications";

export interface UrgencyBannerProps {
  state: AsyncState<CockpitPayload>;
}

const LEVEL_CLASS: Record<string, string> = {
  low: "text-success",
  normal: "text-warning",
  high: "text-destructive",
  critical: "text-destructive",
};

export function UrgencyBanner({ state }: UrgencyBannerProps) {
  return (
    <AsyncSection
      state={state}
      subject="the urgency status"
      isEmpty={(cockpit) => !cockpit.urgency}
      empty={null}
    >
      {(cockpit) => {
        const urgency = cockpit.urgency;
        if (!urgency) return null;
        const level = String(urgency.level ?? "").toLowerCase();
        const dotClass =
          urgency.color && urgency.color.startsWith("#")
            ? undefined
            : (LEVEL_CLASS[level] ?? "text-muted-foreground");
        return (
          <div className="flex items-center gap-2 rounded border border-border bg-card p-3">
            {dotClass ? (
              <span
                aria-hidden="true"
                className={`text-lg leading-none ${dotClass}`}
              >
                ●
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: urgency.color }}
              />
            )}
            <p className="text-sm text-foreground">
              <span className="font-medium">{urgency.message}</span>
              {typeof urgency.daysRemaining === "number" && (
                <span className="text-muted-foreground">
                  {" "}
                  · {urgency.daysRemaining} day
                  {urgency.daysRemaining === 1 ? "" : "s"} to close
                </span>
              )}
            </p>
          </div>
        );
      }}
    </AsyncSection>
  );
}
