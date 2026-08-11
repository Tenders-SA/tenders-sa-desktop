/**
 * The 8 -> 4 stage mapping behind the sign-in graphic (R-V3).
 *
 * Its own module so the diagram component exports only a component (React
 * Fast Refresh), and so the mapping can be asserted directly: the test in
 * `sign-in-shell.test.tsx` checks that every parent stage in
 * `WORKSPACE_STAGES` is accounted for here exactly once. A ninth parent
 * stage that nobody places fails that test rather than quietly disappearing
 * from the story the sign-in screen tells about the product.
 */

import type { WORKSPACE_STAGES } from "../../services/api/endpoints/applications";

type Stage = (typeof WORKSPACE_STAGES)[number];

export interface PipelineNode {
  label: string;
  stages: Stage[];
}

export const PIPELINE_NODES: PipelineNode[] = [
  { label: "Discover", stages: ["suggested"] },
  { label: "Analyse", stages: ["needs_analysis", "review_requirements"] },
  {
    label: "Prepare",
    stages: ["fix_readiness", "add_information", "generate_documents"],
  },
  { label: "Submit", stages: ["ready_to_submit", "submitted"] },
];
