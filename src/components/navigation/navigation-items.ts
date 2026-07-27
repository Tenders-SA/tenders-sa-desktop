/**
 * Primary navigation, transcribed verbatim from the product brief
 * (docs/prompts/desktop-procurement-workspace.md §5 "Primary
 * navigation"), including its three-group structure.
 *
 * `available` is the honesty switch. Only Command Centre exists in
 * Phase 0; every other destination belongs to a later, separately
 * approved phase. Items marked unavailable render as visibly disabled
 * rather than as working links, so the shell never represents a
 * later-phase feature as functional (REQ-16, and TASK-0.10's
 * pre-check).
 */

export interface NavigationItem {
  label: string;
  /** Only set when the destination actually exists. */
  path?: string;
  available: boolean;
}

export interface NavigationGroup {
  /** Accessible name for the group; the brief shows these unlabelled. */
  label: string;
  items: NavigationItem[];
}

export const NAVIGATION_GROUPS: readonly NavigationGroup[] = [
  {
    label: "Workflow",
    items: [
      { label: "Command Centre", path: "/", available: true },
      { label: "Tender Radar", available: false },
      { label: "Opportunities", available: false },
      { label: "Application Workspaces", available: false },
      { label: "Proposals", available: false },
      { label: "Calendar", available: false },
      { label: "Tasks", available: false },
    ],
  },
  {
    label: "Company and intelligence",
    items: [
      { label: "Company Profile", available: false },
      { label: "Company Document Vault", available: false },
      { label: "JV and Partner Network", available: false },
      { label: "Supplier Intelligence", available: false },
      { label: "Buyer Intelligence", available: false },
      { label: "Award Intelligence", available: false },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Notifications", available: false },
      { label: "Reports", available: false },
      { label: "Settings", available: false },
    ],
  },
];

export const ALL_NAVIGATION_ITEMS: readonly NavigationItem[] =
  NAVIGATION_GROUPS.flatMap((group) => group.items);
