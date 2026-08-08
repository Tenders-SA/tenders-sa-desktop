/**
 * Value estimate for the workspace (cockpit payload).
 *
 * The parent estimates what similar awards are worth (ZAR). Min/max/median,
 * confidence and any warnings are shown; absent estimate renders nothing.
 */

import { Panel } from "../../../components/common/AsyncSection";
import type { AsyncState } from "../../../hooks/use-async";
import { AsyncSection } from "../../../components/common/AsyncSection";
import type { CockpitPayload } from "../../../services/api/endpoints/applications";

export interface ValueEstimatePanelProps {
  state: AsyncState<CockpitPayload>;
}

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

export function ValueEstimatePanel({ state }: ValueEstimatePanelProps) {
  return (
    <AsyncSection
      state={state}
      subject="the value estimate"
      isEmpty={(cockpit) => !cockpit.valueEstimate}
      empty={null}
    >
      {(cockpit) => {
        const estimate = cockpit.valueEstimate;
        if (!estimate) return null;
        return (
          <Panel
            title="Value estimate"
            aside={
              estimate.confidenceLevel ? (
                <span className="text-xs text-muted-foreground">
                  {estimate.confidenceLevel} confidence
                  {typeof estimate.confidenceScore === "number" &&
                    ` (${estimate.confidenceScore}%)`}
                </span>
              ) : undefined
            }
          >
            <p className="text-sm text-foreground">
              <span className="font-semibold">
                {typeof estimate.estimatedMedian === "number"
                  ? ZAR.format(estimate.estimatedMedian)
                  : "No median estimate"}
              </span>
              {typeof estimate.estimatedMin === "number" &&
                typeof estimate.estimatedMax === "number" && (
                  <span className="text-muted-foreground">
                    {" "}
                    · range {ZAR.format(estimate.estimatedMin)} –{" "}
                    {ZAR.format(estimate.estimatedMax)}
                  </span>
                )}
            </p>
            {estimate.methodology && (
              <p className="mt-1 text-xs text-muted-foreground">
                Based on {estimate.methodology.replace(/-/g, " ")}
                {typeof estimate.sampleSize === "number" &&
                  ` (${estimate.sampleSize} comparable awards)`}
              </p>
            )}
            {estimate.warnings && estimate.warnings.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {estimate.warnings.map((warning, index) => (
                  <li
                    key={`${index}-${warning}`}
                    className="text-sm text-warning"
                  >
                    {warning}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        );
      }}
    </AsyncSection>
  );
}
