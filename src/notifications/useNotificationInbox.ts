'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  fetchInbox,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type InboxNotification,
} from './inbox.api';

const INBOX_KEY = ['notifications', 'inbox'] as const;
const UNREAD_KEY = ['notifications', 'unread-count'] as const;

/** Poll cadence for the badge while push (SSE/WebSocket) is deferred to phase 8. */
const UNREAD_POLL_MS = 30_000;

export interface NotificationInboxState {
  items: InboxNotification[];
  unreadCount: number;
  isLoading: boolean;
  isError: boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

/**
 * Persistent inbox backed by the Decision Engine. The unread badge polls on an interval
 * (real-time push arrives in phase 8); the list is fetched on demand and revalidated
 * whenever a read mutation settles. Mutations are optimistic-friendly via invalidation,
 * keeping the badge and list consistent without a manual refetch.
 */
export function useNotificationInbox(listEnabled: boolean): NotificationInboxState {
  const queryClient = useQueryClient();

  const unread = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: ({ signal }) => fetchUnreadCount(signal),
    refetchInterval: UNREAD_POLL_MS,
    refetchOnWindowFocus: true,
  });

  const inbox = useQuery({
    queryKey: INBOX_KEY,
    queryFn: ({ signal }) => fetchInbox({ pageSize: 20 }, signal),
    // Only fetch the (heavier) list once the panel is opened.
    enabled: listEnabled,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: INBOX_KEY });
    void queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
  }, [queryClient]);

  const readOne = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: invalidate,
  });

  const readAll = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: invalidate,
  });

  return {
    items: inbox.data?.items ?? [],
    unreadCount: unread.data ?? 0,
    isLoading: inbox.isLoading,
    isError: inbox.isError || unread.isError,
    markRead: readOne.mutate,
    markAllRead: readAll.mutate,
  };
}
