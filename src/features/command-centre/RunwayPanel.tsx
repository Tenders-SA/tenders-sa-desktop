/**
 * Where the next fortnight's deadlines actually land (R-V10, R-V12).
 *
 * "Closing this week" lists the next three. This shows the shape of the
 * fortnight: whether three deadlines sit on one Friday or are spread across
 * two weeks — a difference the list cannot express and the user plans
 * around.
 *
 * Drawn from the portfolio the Command Centre already loaded.
 */

import { AsyncSection, Panel } from "../../components/common/AsyncSection";
import { ChartEmpty } from "../../components/charts/ChartFrame";
import { BarRow } from "../../components/charts/BarRow";
import { summariseRunway } from "./pipeline-summary";
import type { PortfolioState } from "./use-portfolio";

const RUNWAY_DAYS = 14;

export function RunwayPanel({ state }: { state: PortfolioState }) {
  return (
    <Panel title="Deadline runway">
      <AsyncSection
        state={state}
        subject="your deadline runway"
        onRetry={state.reload}
      >
        {({ applications }) => {
          const days = summariseRunway(applications, RUNWAY_DAYS);
          const total = days.reduce((sum, day) => sum + day.value, 0);

          if (total === 0) {
            return (
              <ChartEmpty>Nothing closes in the next fortnight.</ChartEmpty>
            );
          }

          return (
            <BarRow
              label="Applications closing over the next 14 days"
              // Empty days are dropped from the bars but the count above
              // still reflects the whole window: fourteen rows, eleven of
              // them empty, is a chart of nothing.
              data={days
                .filter((day) => day.value > 0)
                .map((day) => ({
                  label: day.label,
                  value: day.value,
                  token: day.token,
                }))}
              columns={["Day", "Closing"]}
            />
          );
        }}
      </AsyncSection>
    </Panel>
  );
}
