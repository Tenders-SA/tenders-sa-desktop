import { NavLink } from "react-router-dom";
import { NAVIGATION_GROUPS } from "./navigation-items";

/**
 * Primary navigation rail (REQ-2). Unavailable destinations render as
 * `aria-disabled` list items rather than links: they stay visible so
 * the product shape is legible, but they are not focusable targets
 * that lead nowhere.
 */
export function Sidebar() {
  return (
    <nav
      aria-label="Primary"
      className="flex w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-sidebar-border bg-sidebar-background p-4"
    >
      <span className="px-2 text-sm font-semibold text-foreground">
        Tenders-SA Desktop
      </span>

      {NAVIGATION_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <h2 className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </h2>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) =>
              item.available && item.path ? (
                <li key={item.label}>
                  <NavLink
                    to={item.path}
                    end
                    className={({ isActive }) =>
                      [
                        "block rounded px-2 py-1.5 text-sm",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-secondary",
                      ].join(" ")
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ) : (
                <li key={item.label}>
                  <span
                    aria-disabled="true"
                    title="Not available in this build"
                    className="block cursor-not-allowed rounded px-2 py-1.5 text-sm text-muted-foreground opacity-60"
                  >
                    {item.label}
                  </span>
                </li>
              ),
            )}
          </ul>
        </div>
      ))}
    </nav>
  );
}
