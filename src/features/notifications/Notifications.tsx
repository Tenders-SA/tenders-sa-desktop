import { useState } from "react";
import { AsyncSection } from "../../components/common/AsyncSection";
import { useAsync } from "../../hooks/use-async";
import {
  notificationHeading,
  type NotificationsEndpoint,
} from "../../services/api/endpoints/notifications";
import { formatTimestamp } from "../command-centre/activity-format";

export interface NotificationsScreenProps {
  endpoint: NotificationsEndpoint;
}

/**
 * Notifications (brief §5).
 *
 * Ordering is the parent's — unread first, then newest — and is not re-sorted
 * here. The server also filters out expired notifications, so an item that
 * arrives is one the user is still meant to see.
 *
 * Marking read is optimistic-with-reload rather than optimistic-only: the
 * unread count comes from the server and is what the navigation badge will
 * show, so guessing at it locally would let the badge and the list disagree.
 */
export function NotificationsScreen({ endpoint }: NotificationsScreenProps) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);

  const state = useAsync(
    (signal) => endpoint.list({ unreadOnly, offset, limit: 20 }, signal),
    [endpoint, unreadOnly, offset],
  );

  const markRead = (id: string) => {
    setBusy(true);
    endpoint
      .markRead(id)
      .catch(() => undefined)
      .finally(() => {
        setBusy(false);
        state.reload();
      });
  };

  const markAllRead = () => {
    setBusy(true);
    endpoint
      .markAllRead()
      .catch(() => undefined)
      .finally(() => {
        setBusy(false);
        state.reload();
      });
  };

  return (
    <section aria-labelledby="notifications-heading" className="max-w-3xl">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1
          id="notifications-heading"
          className="text-xl font-semibold text-foreground"
        >
          Notifications
        </h1>
        <button
          type="button"
          disabled={busy}
          onClick={markAllRead}
          className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
        >
          Mark all as read
        </button>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={unreadOnly}
          onChange={(event) => {
            setOffset(0);
            setUnreadOnly(event.target.checked);
          }}
          className="size-4"
        />
        Show only unread
      </label>

      <div className="mt-6">
        <AsyncSection
          state={state}
          subject="your notifications"
          onRetry={state.reload}
          isEmpty={(result) => result.notifications.length === 0}
          empty={
            <p className="text-sm text-muted-foreground">
              {unreadOnly
                ? "Nothing unread."
                : "You have no notifications yet."}
            </p>
          }
        >
          {(result) => (
            <>
              <p className="text-sm text-muted-foreground">
                {result.unreadCount} unread of {result.total}
              </p>

              <ul className="mt-3 flex flex-col gap-2">
                {result.notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className="flex items-start justify-between gap-4 rounded border border-border bg-card p-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-card-foreground">
                        {notificationHeading(notification)}
                        {!notification.read && (
                          // Unread is stated, not only styled (A11Y-1).
                          <span className="ml-2 text-xs font-normal uppercase tracking-wide text-primary">
                            Unread
                          </span>
                        )}
                      </p>
                      {notification.message && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {notification.message}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatTimestamp(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.read && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => markRead(notification.id)}
                        className="shrink-0 rounded border border-border px-2 py-1 text-xs text-foreground disabled:opacity-50"
                      >
                        Mark read
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              <nav
                aria-label="Pagination"
                className="mt-6 flex items-center justify-between"
              >
                <button
                  type="button"
                  disabled={offset === 0}
                  onClick={() => setOffset((o) => Math.max(0, o - 20))}
                  className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!result.hasMore}
                  onClick={() => setOffset((o) => o + 20)}
                  className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            </>
          )}
        </AsyncSection>
      </div>
    </section>
  );
}
