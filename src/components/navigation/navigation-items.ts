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

import {
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  FileChartColumnIncreasing,
  FileText,
  FolderLock,
  Handshake,
  Landmark,
  LayoutDashboard,
  ListTodo,
  Radar,
  Search,
  Settings,
  Trophy,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavigationItem {
  label: string;
  icon: LucideIcon;
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
      {
        label: "Command Centre",
        icon: LayoutDashboard,
        path: "/",
        available: true,
      },
      { label: "Tender Radar", icon: Radar, path: "/radar", available: true },
      {
        label: "Opportunities",
        icon: Search,
        path: "/opportunities",
        available: true,
      },
      {
        label: "Application Workspaces",
        icon: BriefcaseBusiness,
        path: "/applications",
        available: true,
      },
      { label: "Proposals", icon: FileText, available: false },
      {
        label: "Calendar",
        icon: CalendarDays,
        path: "/calendar",
        available: true,
      },
      { label: "Tasks", icon: ListTodo, path: "/tasks", available: true },
    ],
  },
  {
    label: "Company and intelligence",
    items: [
      {
        label: "Company Profile",
        icon: Building2,
        path: "/company",
        available: true,
      },
      {
        label: "Company Document Vault",
        icon: FolderLock,
        path: "/documents",
        available: true,
      },
      { label: "JV and Partner Network", icon: Handshake, available: false },
      {
        label: "Supplier Intelligence",
        icon: Users,
        path: "/suppliers",
        available: true,
      },
      { label: "Buyer Intelligence", icon: Landmark, available: false },
      { label: "Award Intelligence", icon: Trophy, available: false },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "Notifications",
        icon: Bell,
        path: "/notifications",
        available: true,
      },
      { label: "Reports", icon: FileChartColumnIncreasing, available: false },
      { label: "Settings", icon: Settings, path: "/settings", available: true },
    ],
  },
];

export const ALL_NAVIGATION_ITEMS: readonly NavigationItem[] =
  NAVIGATION_GROUPS.flatMap((group) => group.items);
