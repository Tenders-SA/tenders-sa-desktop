import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ALL_NAVIGATION_ITEMS } from "./navigation-items";

/**
 * Command palette entry point (REQ-2), opened with Ctrl/Cmd+K.
 *
 * It lists every destination from the brief but only *runs* the ones
 * that exist; unavailable entries are shown as disabled options so the
 * palette does not become a way to route into a later-phase feature
 * that the sidebar correctly refuses to link to.
 *
 * Focus handling (A11Y-1): opening moves focus to the search field,
 * Escape closes and restores focus to whatever had it before.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();
  const listId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((wasOpen) => {
          if (!wasOpen) {
            restoreFocusTo.current = document.activeElement as HTMLElement;
          }
          return !wasOpen;
        });
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else {
      setQuery("");
      restoreFocusTo.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const matches = ALL_NAVIGATION_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-6 pt-24"
    >
      <div className="w-full max-w-lg rounded border border-border bg-popover p-3">
        <label htmlFor={`${listId}-input`} className="sr-only">
          Search commands
        </label>
        <input
          id={`${listId}-input`}
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search…"
          aria-controls={listId}
          className="w-full rounded border border-input bg-background px-3 py-2 text-popover-foreground"
        />

        <ul id={listId} className="mt-2 max-h-72 overflow-y-auto">
          {matches.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              No matching commands
            </li>
          )}
          {matches.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                disabled={!item.available}
                onClick={() => {
                  if (item.path) {
                    navigate(item.path);
                    setOpen(false);
                  }
                }}
                className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm text-popover-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-60"
              >
                <span>{item.label}</span>
                {!item.available && (
                  <span className="text-xs text-muted-foreground">
                    Not available
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
