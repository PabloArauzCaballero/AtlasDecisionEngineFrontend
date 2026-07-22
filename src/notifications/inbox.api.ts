import { z } from 'zod';
import { apiRequest } from '../api/http-client';

/**
 * Backend notification inbox contract (GET/POST /v1/notifications). Every payload is
 * validated with zod before it reaches the UI, so a drifted backend surfaces as a
 * contract error rather than a render crash. All calls go through apiRequest — never a
 * bare fetch — so the session/refresh handling is shared with the rest of the app.
 */
export const inboxNotificationSchema = z.object({
  id: z.string(),
  category: z.string(),
  priority: z.string(),
  title: z.string(),
  body: z.string(),
  entityType: z.string().nullable().optional(),
  entityId: z.string().nullable().optional(),
  actionUrl: z.string().nullable().optional(),
  eventType: z.string(),
  readAt: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type InboxNotification = z.infer<typeof inboxNotificationSchema>;

const inboxPageSchema = z.object({
  items: z.array(inboxNotificationSchema),
  pageSize: z.number(),
  nextCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
});

export type InboxPage = z.infer<typeof inboxPageSchema>;

const unreadCountSchema = z.object({ unread: z.number() });

export interface InboxQuery {
  cursor?: string;
  unreadOnly?: boolean;
  pageSize?: number;
}

export async function fetchInbox(query: InboxQuery = {}, signal?: AbortSignal): Promise<InboxPage> {
  const params = new URLSearchParams();
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.unreadOnly) params.set('unreadOnly', 'true');
  params.set('pageSize', String(query.pageSize ?? 20));
  return apiRequest<InboxPage>(`/v1/notifications?${params.toString()}`, {
    signal,
    responseSchema: inboxPageSchema,
  });
}

export async function fetchUnreadCount(signal?: AbortSignal): Promise<number> {
  const result = await apiRequest('/v1/notifications/unread-count', {
    signal,
    responseSchema: unreadCountSchema,
  });
  return result.unread;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiRequest(`/v1/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiRequest('/v1/notifications/read-all', { method: 'POST' });
}
