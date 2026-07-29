/**
 * Notifications.
 *
 * Refs: brief §5 "Notifications", INT-A3
 * Parent routes (read from source at `8ff2e4c2`):
 *   GET  /api/v1/notifications             -> {notifications[], pagination:{total,limit,offset,hasMore}, unreadCount}
 *   GET  /api/v1/notifications/unread-count -> {unreadCount, breakdown}
 *   POST /api/notifications/[id]/read
 *   POST /api/notifications/mark-all-read
 *
 * Note the two families: the list is under `/api/v1/`, while the mutations
 * are under `/api/notifications/` with no version segment. That asymmetry is
 * the parent's, and the desktop follows it rather than "correcting" it into a
 * 404.
 *
 * The list returns unread first then newest, and filters out expired
 * notifications server-side, so the desktop does no reordering — reversing
 * that here would put stale items above unread ones.
 */

import { z } from "zod";
import { AuthenticatedEndpoint } from "./base";

/**
 * Fields the desktop renders. `passthrough` because `UserNotification` is
 * selected whole by the parent and carries delivery metadata the desktop has
 * no use for; unknown extras must not fail validation.
 */
const notificationSchema = z
  .object({
    id: z.string(),
    type: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    message: z.string().nullable().optional(),
    read: z.boolean(),
    createdAt: z.string(),
    expiresAt: z.string().nullable().optional(),
    actionUrl: z.string().nullable().optional(),
  })
  .passthrough();

export type Notification = z.infer<typeof notificationSchema>;

const notificationsSchema = z.object({
  notifications: z.array(notificationSchema),
  pagination: z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  }),
  unreadCount: z.number(),
});

export interface NotificationsResult {
  notifications: Notification[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  unreadCount: number;
}

export interface NotificationsQuery {
  unreadOnly?: boolean;
  types?: string[];
  limit?: number;
  offset?: number;
}

const unreadCountSchema = z.object({
  unreadCount: z.number(),
  breakdown: z.unknown().optional(),
});

export class NotificationsEndpoint extends AuthenticatedEndpoint {
  async list(
    query: NotificationsQuery = {},
    signal?: AbortSignal,
  ): Promise<NotificationsResult> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const body = await this.transport.request({
      method: "GET",
      path: "/api/v1/notifications",
      query: {
        limit,
        offset,
        unreadOnly: query.unreadOnly ? "true" : undefined,
        types: query.types?.length ? query.types.join(",") : undefined,
      },
      schema: notificationsSchema,
      headers: await this.authHeaders(),
      signal,
    });

    return {
      notifications: body.notifications,
      total: body.pagination.total,
      offset: body.pagination.offset,
      limit: body.pagination.limit,
      hasMore: body.pagination.hasMore,
      unreadCount: body.unreadCount,
    };
  }

  /** For the navigation badge. */
  async unreadCount(signal?: AbortSignal): Promise<number> {
    const body = await this.transport.request({
      method: "GET",
      path: "/api/v1/notifications/unread-count",
      schema: unreadCountSchema,
      headers: await this.authHeaders(),
      signal,
    });
    return body.unreadCount;
  }

  /** Unversioned path — this mutation is not under `/api/v1/`. */
  async markRead(id: string, signal?: AbortSignal): Promise<void> {
    await this.transport.request({
      method: "POST",
      path: `/api/notifications/${encodeURIComponent(id)}/read`,
      schema: z.unknown(),
      headers: await this.authHeaders(),
      signal,
    });
  }

  async markAllRead(signal?: AbortSignal): Promise<void> {
    await this.transport.request({
      method: "POST",
      path: "/api/notifications/mark-all-read",
      schema: z.unknown(),
      headers: await this.authHeaders(),
      signal,
    });
  }
}

/**
 * A heading for a notification, whatever the parent supplied.
 *
 * `title` is often null and `type` is a SCREAMING_SNAKE enum, so this falls
 * back through both before giving up. It never returns an empty string: a
 * blank row reads as a rendering bug.
 */
export function notificationHeading(notification: Notification): string {
  const title = notification.title?.trim();
  if (title) return title;
  const type = notification.type?.trim();
  if (type) {
    const words = type.replace(/_/g, " ").toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return "Notification";
}
