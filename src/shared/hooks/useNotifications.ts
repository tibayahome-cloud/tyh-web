import { useCallback, useEffect } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchNotificationEventPreferences,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
  updateNotificationPreferences
} from "../libs/notifications";
import type { NotificationEventPreference } from "../schemas/notification";
import { useSocket } from "./useSocket";
import { useAuth } from "./useAuth";

type UseNotificationsParams = {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
  enabled?: boolean;
};

/**
 * The page size NotificationCenter fetches by default. useNotificationBadge shares this value
 * so both consumers hit the identical query key and React Query serves them from one cached
 * request instead of two -- pageSize is part of the cache key (see notificationKeys.list below),
 * so any drift between the two reintroduces the duplicate-request bug this constant exists to
 * prevent.
 */
export const NOTIFICATION_CENTER_PAGE_SIZE = 10;

type NotificationListData = Awaited<ReturnType<typeof fetchNotifications>>;

const notificationKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationKeys.all, "list"] as const,
  list: (params: { page: number; pageSize: number; unreadOnly: boolean }) =>
    [...notificationKeys.lists(), params] as const,
  preferences: () => [...notificationKeys.all, "preferences"] as const
};

const nowIso = () => new Date().toISOString();

const updateListReadState = (
  data: NotificationListData | undefined,
  ids: Set<string>,
  readAt: string
): NotificationListData | undefined => {
  if (!data) {
    return data;
  }

  let affected = 0;
  const updatedNotifications = data.notifications.map((item) => {
    if (!ids.has(item.id) || item.readAt) {
      return item;
    }
    affected += 1;
    return {
      ...item,
      readAt
    };
  });

  const updatedUnread = Math.max(0, data.meta.unread - affected);

  return {
    notifications: updatedNotifications,
    meta: {
      ...data.meta,
      unread: updatedUnread
    }
  };
};

const markAllReadState = (data: NotificationListData | undefined, readAt: string): NotificationListData | undefined => {
  if (!data) {
    return data;
  }
  return {
    notifications: data.notifications.map((item) =>
      item.readAt
        ? item
        : {
            ...item,
            readAt
          }
    ),
    meta: {
      ...data.meta,
      unread: 0
    }
  };
};

export const useNotifications = ({
  page = 1,
  pageSize = 25,
  unreadOnly = false,
  enabled = true
}: UseNotificationsParams = {}) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: notificationKeys.list({ page, pageSize, unreadOnly }),
    queryFn: () => fetchNotifications({ page, pageSize, unreadOnly }),
    placeholderData: keepPreviousData,
    enabled
  });

  const markReadMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) {
        return { updated: 0 };
      }
      return markNotificationsRead(ids);
    },
    onSuccess: (result, ids) => {
      if (!ids.length) {
        return;
      }
      const readAt = nowIso();
      const idSet = new Set(ids);
      queryClient.setQueriesData({ queryKey: notificationKeys.lists(), exact: false }, (data: NotificationListData | undefined) =>
        updateListReadState(data, idSet, readAt)
      );
      if (result?.updated && result.updated > 0) {
        queryClient.invalidateQueries({ queryKey: notificationKeys.list({ page, pageSize, unreadOnly }) }).catch(() => {});
      }
    }
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      const readAt = nowIso();
      queryClient.setQueriesData(
        { queryKey: notificationKeys.lists(), exact: false },
        (data: NotificationListData | undefined) => markAllReadState(data, readAt)
      );
    }
  });

  const markAsRead = useCallback(
    (ids: string[]) => {
      markReadMutation.mutate(ids);
    },
    [markReadMutation]
  );

  const markAllAsRead = useCallback(() => {
    markAllMutation.mutate();
  }, [markAllMutation]);

  return {
    notifications: query.data?.notifications ?? [],
    meta: query.data?.meta,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    markAsRead,
    markAllAsRead,
    isMarkingRead: markReadMutation.isPending || markAllMutation.isPending,
    refetch: query.refetch
  };
};

export const useNotificationPreferences = () => {
  const queryClient = useQueryClient();

  const query = useQuery<NotificationEventPreference[]>({
    queryKey: notificationKeys.preferences(),
    queryFn: fetchNotificationEventPreferences
  });

  const mutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (updatedPreferences) => {
      queryClient.setQueryData(notificationKeys.preferences(), (previous: NotificationEventPreference[] | undefined) => {
        if (!previous || previous.length === 0) {
          return updatedPreferences;
        }
        const map = new Map<string, NotificationEventPreference>();
        for (const entry of previous) {
          const key = entry.event?.key;
          if (key) {
            map.set(key, entry);
          }
        }
        for (const entry of updatedPreferences) {
          const key = entry.event?.key;
          if (key) {
            map.set(key, entry);
          }
        }
        return Array.from(map.values());
      });
    }
  });

  return {
    preferences: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updatePreferences: mutation.mutateAsync,
    isUpdating: mutation.isPending
  };
};

export const useNotificationSocket = () => {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!socket) {
      return;
    }

    // The server sends the event with flat fields and only to the person it is for; this also ignores anything that
    // names someone else. The list is simply fetched again, so the bell and the unread count are exactly the server's.
    const refresh = (payload?: { user_id?: string }) => {
      if (payload?.user_id && user?.id && payload.user_id !== user.id) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists(), exact: false }).catch(() => undefined);
    };

    socket.on("notification.created", refresh);
    socket.on("notification.read", refresh);

    return () => {
      socket.off("notification.created", refresh);
      socket.off("notification.read", refresh);
    };
  }, [queryClient, socket, user?.id]);
};
