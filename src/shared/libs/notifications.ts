import api from "./api";
import {
  notificationEventPreferences,
  notificationList,
  buildFieldParams
} from "./fieldInclude";
import type {
  Notification,
  NotificationEventPreference
} from "../schemas/notification";
import {
  mapNotification,
  mapNotificationEventPreferences,
  mapNotificationList
} from "../schemas/notification";

type NotificationListParams = {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
};

type NotificationListMeta = {
  total: number;
  page: number;
  size: number;
  totalPages: number;
  unread: number;
};

type NotificationListResult = {
  notifications: Notification[];
  meta: NotificationListMeta;
};

const defaultListMeta: NotificationListMeta = {
  total: 0,
  page: 1,
  size: 25,
  totalPages: 1,
  unread: 0
};

const normalizeMeta = (meta: unknown, fallback: NotificationListMeta = defaultListMeta): NotificationListMeta => {
  if (!meta || typeof meta !== "object") {
    return fallback;
  }
  const source = meta as Record<string, unknown>;
  const toNumber = (value: unknown, defaultValue: number) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : defaultValue;
    }
    return defaultValue;
  };
  return {
    total: toNumber(source.total, fallback.total),
    page: toNumber(source.page, fallback.page),
    size: toNumber(source.size, fallback.size),
    totalPages: toNumber(source.total_pages ?? source.totalPages, fallback.totalPages),
    unread: toNumber(source.unread, fallback.unread)
  };
};

export const fetchNotifications = async ({
  page = 1,
  pageSize = 25,
  unreadOnly = false
}: NotificationListParams = {}): Promise<NotificationListResult> => {
  const params = {
    ...buildFieldParams(notificationList),
    "page[number]": page,
    "page[size]": pageSize,
    ...(unreadOnly ? { unread: "true" } : {})
  };

  const response = await api.get("/notifications", { params });
  const payload = response.data ?? {};
  const notifications = mapNotificationList(payload.data);
  const meta = normalizeMeta(payload.meta);
  return { notifications, meta };
};

export const sendTestNotification = async (input: {
  eventKey: string;
  userId: string;
  title: string;
  body: string;
  channels?: string[];
  data?: Record<string, unknown>;
}) => {
  const response = await api.post("/notifications/test", {
    event_key: input.eventKey,
    user_id: input.userId,
    title: input.title,
    body: input.body,
    channels: input.channels,
    data: input.data
  });
  return mapNotification(response.data?.data);
};

export const markNotificationsRead = async (ids: string[]) => {
  const response = await api.post("/notifications/mark-read", {
    notification_ids: ids
  });
  return response.data?.data as { updated: number };
};

export const markAllNotificationsRead = async () => {
  const response = await api.post("/notifications/read-all");
  return response.data?.data as { updated: number };
};

export const fetchNotificationEventPreferences = async (): Promise<NotificationEventPreference[]> => {
  const params = buildFieldParams(notificationEventPreferences);
  const response = await api.get("/notifications/events", { params });
  const payload = response.data ?? {};
  return mapNotificationEventPreferences(payload.data);
};

export const updateNotificationPreferences = async (
  changes: Array<{ eventKey: string; channel: string; enabled: boolean; snoozedUntil?: string | null }>
): Promise<NotificationEventPreference[]> => {
  const response = await api.patch("/notifications/preferences", {
    preferences: changes.map((change) => ({
      event_key: change.eventKey,
      channel: change.channel,
      enabled: change.enabled,
      snoozed_until: change.snoozedUntil ?? null
    }))
  });
  const payload = response.data ?? {};
  return mapNotificationEventPreferences(payload.data);
};
