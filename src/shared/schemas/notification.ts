import { z } from "zod";

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string())
  .nullish();

const notificationDeliverySchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    channel: z.string(),
    status: z.string(),
    sent_at: isoDate,
    delivered_at: isoDate,
    read_at: isoDate,
    error_message: z.string().nullish(),
    external_reference: z.string().nullish()
  })
  .passthrough()
  .optional();

const notificationSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    title: z.string().optional(),
    body: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().nullish(),
    event_key: z.string().nullish(),
    event_name: z.string().nullish(),
    data: z.record(z.any()).nullish(),
    read_at: isoDate,
    delivered_at: isoDate,
    created_at: isoDate,
    updated_at: isoDate,
    deliveries: z.array(notificationDeliverySchema).nullish()
  })
  .passthrough();

const channelPreferenceSchema = z
  .object({
    channel: z.string(),
    enabled: z.boolean(),
    source: z.string().nullish(),
    snoozed_until: isoDate
  })
  .passthrough();

const notificationEventSchema = z
  .object({
    key: z.string(),
    name: z.string(),
    category: z.string().nullish(),
    description: z.string().nullish(),
    supported_channels: z.array(z.string()).optional(),
    default_channels: z.array(z.string()).optional(),
    allow_user_toggle: z.boolean().optional(),
    critical: z.boolean().optional()
  })
  .passthrough();

const notificationEventPreferenceSchema = z
  .object({
    event: notificationEventSchema.nullish(),
    channels: z.array(channelPreferenceSchema).nullish(),
    effective_channels: z.array(z.string()).nullish()
  })
  .passthrough();

export type NotificationDelivery = {
  id: string | null;
  channel: string;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  errorMessage: string | null;
  externalReference: string | null;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  status: string;
  priority: string | null;
  eventKey: string | null;
  eventName: string | null;
  data: Record<string, unknown>;
  readAt: string | null;
  deliveredAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  deliveries: NotificationDelivery[];
};

export type NotificationChannelPreference = {
  channel: string;
  enabled: boolean;
  source: string;
  snoozedUntil: string | null;
};

export type NotificationEventPreference = {
  event: {
    key: string;
    name: string;
    category: string | null;
    description: string | null;
    supportedChannels: string[];
    defaultChannels: string[];
    allowUserToggle: boolean;
    critical: boolean;
  } | null;
  channels: NotificationChannelPreference[];
  effectiveChannels: string[];
};

const coerceId = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return value.toString();
  }
  return "";
};

const coerceDate = (value: unknown): string | null => {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return null;
};

const parseDelivery = (payload: unknown): NotificationDelivery | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const parsed = notificationDeliverySchema.safeParse(payload);
  if (!parsed.success || !parsed.data) {
    return null;
  }
  const value = parsed.data;
  const idRaw = (value as { id?: string | number }).id;
  return {
    id: idRaw === undefined ? null : coerceId(idRaw),
    channel: typeof value.channel === "string" ? value.channel : "unknown",
    status: typeof value.status === "string" ? value.status : "pending",
    sentAt: coerceDate(value.sent_at),
    deliveredAt: coerceDate(value.delivered_at),
    readAt: coerceDate(value.read_at),
    errorMessage: typeof value.error_message === "string" ? value.error_message : null,
    externalReference:
      typeof value.external_reference === "string" ? value.external_reference : null
  };
};

export const mapNotification = (payload: unknown): Notification => {
  const parsed = notificationSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Invalid notification payload");
  }
  const value = parsed.data;
  const deliveriesRaw = Array.isArray(value.deliveries) ? value.deliveries : [];
  const deliveries = deliveriesRaw
    .map((entry) => parseDelivery(entry))
    .filter((entry): entry is NotificationDelivery => Boolean(entry));
  return {
    id: coerceId(value.id),
    title: typeof value.title === "string" ? value.title : "",
    body: typeof value.body === "string" ? value.body : "",
    status: typeof value.status === "string" ? value.status : "pending",
    priority: value.priority ?? null,
    eventKey: value.event_key ?? null,
    eventName: value.event_name ?? null,
    data: (value.data && typeof value.data === "object" ? (value.data as Record<string, unknown>) : {}) ?? {},
    readAt: coerceDate(value.read_at),
    deliveredAt: coerceDate(value.delivered_at),
    createdAt: coerceDate(value.created_at),
    updatedAt: coerceDate(value.updated_at),
    deliveries
  };
};

export const mapNotificationList = (payload: unknown): Notification[] => {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload.map((item) => {
    try {
      return mapNotification(item);
    } catch {
      return null;
    }
  }).filter((item): item is Notification => Boolean(item));
};

export const mapNotificationEventPreference = (
  payload: unknown
): NotificationEventPreference => {
  const parsed = notificationEventPreferenceSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Invalid notification preference payload");
  }
  const value = parsed.data;
  const eventValue = value.event ?? null;
  const event =
    eventValue === null
      ? null
      : {
          key: eventValue.key,
          name: eventValue.name,
          category: eventValue.category ?? null,
          description: eventValue.description ?? null,
          supportedChannels: eventValue.supported_channels ?? [],
          defaultChannels: eventValue.default_channels ?? [],
          allowUserToggle: eventValue.allow_user_toggle ?? true,
          critical: eventValue.critical ?? false
        };

  const channelsRaw = Array.isArray(value.channels) ? value.channels : [];
  const channels = channelsRaw
    .map((entry) => channelPreferenceSchema.safeParse(entry))
    .filter((entry): entry is { success: true; data: z.infer<typeof channelPreferenceSchema> } => entry.success)
    .map(({ data }) => ({
      channel: data.channel,
      enabled: data.enabled,
      source: data.source ?? "default",
      snoozedUntil: coerceDate(data.snoozed_until)
    }));

  return {
    event,
    channels,
    effectiveChannels: Array.isArray(value.effective_channels) ? value.effective_channels : []
  };
};

export const mapNotificationEventPreferences = (payload: unknown): NotificationEventPreference[] => {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .map((item) => {
      try {
        return mapNotificationEventPreference(item);
      } catch {
        return null;
      }
    })
    .filter((item): item is NotificationEventPreference => Boolean(item));
};
