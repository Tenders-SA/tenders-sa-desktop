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
 * Tender Radar points at the matched-opportunity screen the brief §6.2
 * describes -- tenders scored against the company profile -- not at the
 * keyword search, which lives at `/tenders` and is reachable from both the
 * Command Centre and the Radar itself.
 *
 * The items still marked unavailable are the ones with no parent endpoint
 * behind them, not merely unbuilt UI: Proposals, Tasks, JV and Partner
 * Network, Supplier/Buyer/Award Intelligence and Reports each need either a
 * capability the parent exposes only to its own web pages or a write flow
 * that would need the accessible-form foundation first. Marking them
 * available would produce exactly the dishonest affordance REQ-16 forbids.
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
      { label: "Tender Radar", path: "/radar", available: true },
      { label: "Opportunities", path: "/opportunities", available: true },
      {
        label: "Application Workspaces",
        path: "/applications",
        available: true,
      },
      { label: "Proposals", available: false },
      { label: "Calendar", path: "/calendar", available: true },
      { label: "Tasks", path: "/tasks", available: true },
    ],
  },
  {
    label: "Company and intelligence",
    items: [
      { label: "Company Profile", path: "/company", available: true },
      {
        label: "Company Document Vault",
        path: "/documents",
        available: true,
      },
      { label: "JV and Partner Network", available: false },
      { label: "Supplier Intelligence", path: "/suppliers", available: true },
      { label: "Buyer Intelligence", available: false },
      { label: "Award Intelligence", available: false },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Notifications", path: "/notifications", available: true },
      { label: "Reports", available: false },
      { label: "Settings", path: "/settings", available: true },
    ],
  },
];

export const ALL_NAVIGATION_ITEMS: readonly NavigationItem[] =
  NAVIGATION_GROUPS.flatMap((group) => group.items);
