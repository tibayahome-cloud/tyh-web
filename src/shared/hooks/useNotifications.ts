import { useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchNotificationEventPreferences,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
  updateNotificationPreferences
} from "../libs/notifications";
import type { Notification, NotificationEventPreference} from "../schemas/notification";
import { mapNotification } from "../schemas/notification";
import { useSocket } from "./useSocket";
import { useToast } from "../components/ToastProvider";

type UseNotificationsParams = {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
  enabled?: boolean;
};

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
    keepPreviousData: true,
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

const upsertNotification = (existing: Notification[], incoming: Notification): Notification[] => {
  const index = existing.findIndex((item) => item.id === incoming.id);
  if (index === -1) {
    return [incoming, ...existing];
  }
  const copy = [...existing];
  copy[index] = { ...existing[index], ...incoming };
  return copy;
};

const updateListsWithNotification = (
  data: NotificationListData | undefined,
  notification: Notification
): NotificationListData | undefined => {
  if (!data) {
    return data;
  }

  const notifications = upsertNotification(data.notifications, notification);
  const unread = notifications.filter((item) => !item.readAt).length;

  return {
    notifications,
    meta: {
      ...data.meta,
      unread
    }
  };
};

export const useNotificationSocket = () => {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleCreated = (payload: { payload?: unknown }) => {
      const resource = payload?.payload;
      try {
        const notification = fetchNotificationFromSocket(resource);
        queryClient.setQueriesData(
          { queryKey: notificationKeys.lists(), exact: false },
          (data: NotificationListData | undefined) => updateListsWithNotification(data, notification)
        );
        showToast({
          title: notification.title || "New notification",
          description: notification.body ? truncateText(notification.body, 140) : undefined,
          variant: notification.readAt ? "info" : "success"
        });
      } catch {
        // ignore malformed payloads
      }
    };

    const handleRead = (payload: { payload?: { notification_id?: string } }) => {
      const id = payload?.payload?.notification_id;
      if (!id) {
        return;
      }
      const readAt = nowIso();
      queryClient.setQueriesData(
        { queryKey: notificationKeys.lists(), exact: false },
        (data: NotificationListData | undefined) => updateListReadState(data, new Set([id]), readAt)
      );
    };

    socket.on("notification.created", handleCreated);
    socket.on("notification.read", handleRead);

    return () => {
      socket.off("notification.created", handleCreated);
      socket.off("notification.read", handleRead);
    };
  }, [queryClient, showToast, socket]);
};

const fetchNotificationFromSocket = (payload: unknown): Notification => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid notification payload");
  }
  const source = payload as Record<string, unknown>;
  const normalized: Record<string, unknown> = {
    ...source,
    id: source.notification_id ?? source.id,
    read_at: source.read_at ?? source.readAt,
    delivered_at: source.delivered_at ?? source.deliveredAt,
    created_at: source.created_at ?? source.createdAt,
    updated_at: source.updated_at ?? source.updatedAt,
    event_key: source.event_key ?? source.eventKey,
    event_name: source.event_name ?? source.eventName
  };
  return mapNotification(normalized);
};

const truncateText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}…`;
};
