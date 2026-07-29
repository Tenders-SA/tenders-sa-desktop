/**
 * Primary navigation, transcribed verbatim from the product brief
 * (docs/prompts/desktop-procurement-workspace.md §5 "Primary
 * navigation"), including its three-group structure.
 *
 * `available` is the honesty switch. Items marked unavailable render as
 * visibly disabled rather than as working links and are given no `path`
 * at all, so the shell never represents an unbuilt feature as functional
 * (REQ-16, and TASK-0.10's pre-check).
 *
 * Two destinations exist today: Command Centre, and Tender Radar, which
 * now points at the tender discovery screen. Tender Radar is deliberately
 * marked available even though it is currently a searchable, paginated
 * list rather than the matched-opportunity radar the brief ultimately
 * describes -- a working screen left unreachable would be worse than a
 * partial one, and the label is transcribed from the brief and must not
 * be reworded. Everything else remains a later, separately approved
 * phase.
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
      { label: "Tender Radar", path: "/tenders", available: true },
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
