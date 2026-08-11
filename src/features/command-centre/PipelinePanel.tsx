/**
 * The user's own applications, by status (R-V10, R-V12).
 *
 * Draws from the portfolio the Command Centre already loaded — no request of
 * its own. The donut answers "where is my work sitting?", which the deadline
 * list, showing only the next three closings, cannot.
 */

import { AsyncSection, Panel } from "../../components/common/AsyncSection";
import { ChartEmpty, ChartLegend } from "../../components/charts/ChartFrame";
import { Donut } from "../../components/charts/Donut";
import { summarisePipeline } from "./pipeline-summary";
import type { PortfolioState } from "./use-portfolio";

export function PipelinePanel({ state }: { state: PortfolioState }) {
  return (
    <Panel title="Your pipeline">
      <AsyncSection
        state={state}
        subject="your pipeline"
        onRetry={state.reload}
      >
        {({ applications }) => {
          const { slices, total } = summarisePipeline(applications);

          if (total === 0) {
            return (
              <ChartEmpty>
                No applications yet. Your pipeline appears here once you start
                one from Tender Radar.
              </ChartEmpty>
            );
          }

          return (
            <div className="flex flex-col items-center gap-3">
              <Donut
                label="Your applications by status"
                slices={slices}
                centreValue={total.toLocaleString("en-ZA")}
                centreLabel={total === 1 ? "application" : "applications"}
              />
              {/* Only the statuses actually present get a legend entry: a
                  row for a status at zero is worth keeping in the data table
                  but would pad the legend with categories the chart does not
                  draw. */}
              <ChartLegend
                series={slices
                  .filter((slice) => slice.value > 0)
                  .map((slice) => ({
                    label: `${slice.label} ${slice.value}`,
                    token: slice.token,
                  }))}
              />
            </div>
          );
        }}
      </AsyncSection>
    </Panel>
  );
}
