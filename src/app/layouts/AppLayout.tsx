import { Outlet } from "react-router-dom";
import { Sidebar } from "../../components/navigation/Sidebar";
import { CommandPalette } from "../../components/navigation/CommandPalette";
import { SyncStatus } from "../../components/common/SyncStatus";

/**
 * Protected application layout (REQ-2). The sidebar collapses out of
 * the flow on narrow widths so the shell stays usable on a small
 * window without a separate mobile design.
 */
export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <div className="hidden md:flex">
        <Sidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-3">
          <span className="text-sm text-muted-foreground">
            Press Ctrl+K to open the command palette
          </span>
          <SyncStatus />
        </header>

        <main id="main-content" className="min-w-0 flex-1 p-6">
          <Outlet />
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}
