/**
 * The sign-in screen's product graphic (R-V3).
 *
 * Four nodes summarising the bid lifecycle this application manages. They
 * are a **faithful summary of the eight real `WORKSPACE_STAGES`**
 * (`services/api/endpoints/applications.ts`), not a second vocabulary
 * invented for marketing:
 *
 *   Discover -> suggested
 *   Analyse  -> needs_analysis, review_requirements
 *   Prepare  -> fix_readiness, add_information, generate_documents
 *   Submit   -> ready_to_submit, submitted
 *
 * The mapping is asserted in `login-shell.test.tsx` against the exported
 * stage list, so renaming a parent stage cannot quietly leave the sign-in
 * screen describing a product that no longer exists.
 *
 * Pure inline SVG: the Tauri CSP is `img-src 'self' data:`, so there is no
 * remote imagery to fetch and no asset pipeline to add. Tokens only — no
 * raw colour appears here (R-V8).
 */

import { PIPELINE_NODES } from "./bid-pipeline-nodes";

const WIDTH = 360;
const HEIGHT = 84;
const RAIL_Y = 30;
const FIRST_X = 36;
const GAP = 96;

export function BidPipelineDiagram() {
  const lastX = FIRST_X + GAP * (PIPELINE_NODES.length - 1);

  return (
    <svg
      role="img"
      aria-label="The bid lifecycle: discover, analyse, prepare, submit"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height={84}
    >
      <line
        x1={FIRST_X}
        y1={RAIL_Y}
        x2={lastX}
        y2={RAIL_Y}
        stroke="hsl(var(--border))"
        strokeWidth={2}
        strokeLinecap="round"
      />

      {/* The travelling pulse. CSS rather than SMIL or a timer, so that a
          single `prefers-reduced-motion` rule in theme.css disables it —
          and so nothing here schedules work while the app sits at a login
          screen the user may leave open all day. */}
      <circle
        className="login-pipeline-pulse"
        cx={FIRST_X}
        cy={RAIL_Y}
        r={3}
        fill="hsl(var(--primary))"
        aria-hidden="true"
      />

      {PIPELINE_NODES.map((node, index) => {
        const x = FIRST_X + GAP * index;
        return (
          <g key={node.label}>
            <circle
              cx={x}
              cy={RAIL_Y}
              r={8}
              fill="hsl(var(--card))"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
            />
            <circle cx={x} cy={RAIL_Y} r={3} fill="hsl(var(--primary))" />
            <text
              x={x}
              y={RAIL_Y + 28}
              fontSize={11}
              textAnchor="middle"
              fill="hsl(var(--foreground))"
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
