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
      <div className="flex items-center gap-2 px-2">
        <img
          src="/tenders-sa-icon.png"
          alt=""
          aria-hidden="true"
          className="size-8 rounded-lg"
        />
        <span className="text-sm font-semibold text-foreground">
          Tenders-SA Desktop
        </span>
      </div>

      {NAVIGATION_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <h2 className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </h2>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              return item.available && item.path ? (
                <li key={item.label}>
                  <NavLink
                    to={item.path}
                    end
                    className={({ isActive }) =>
                      [
                        "flex items-center gap-2 rounded px-2 py-1.5 text-sm",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-secondary",
                      ].join(" ")
                    }
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    {item.label}
                  </NavLink>
                </li>
              ) : (
                <li key={item.label}>
                  <span
                    aria-disabled="true"
                    title="Not available in this build"
                    className="flex cursor-not-allowed items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground opacity-60"
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    {item.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
