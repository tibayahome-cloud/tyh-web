import { z } from "zod";
import { coerceDate, coerceId, coerceNumber, coerceString, toObject } from "./helpers";
import { mapUserResource } from "./user";

export const BookingPartySchema = z.object({
  id: z.string(),
  fullName: z.string(),
  avatarUrl: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable()
});

export type BookingParty = z.infer<typeof BookingPartySchema>;

export const BookingServiceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string().nullable(),
  basePriceCents: z.number().nullable(),
  defaultEstimateMinutes: z.number().nullable(),
  category: z.object({
    id: z.string(),
    name: z.string().nullable(),
    key: z.string().nullable()
  }).nullable().optional()
});

export type BookingServiceSummary = z.infer<typeof BookingServiceSummarySchema>;

export const BookingLocationPointSchema = z.object({
  id: z.string(),
  who: z.enum(["client", "provider", "unknown"]),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  recordedAt: z.string().nullable()
});

export type BookingLocationPoint = z.infer<typeof BookingLocationPointSchema>;

export const BookingEventSchema = z.object({
  id: z.string(),
  action: z.string(),
  payload: z.record(z.unknown()),
  at: z.string().nullable(),
  actor: BookingPartySchema.nullable()
});

export type BookingEvent = z.infer<typeof BookingEventSchema>;

export const BookingSchema = z.object({
  id: z.string(),
  status: z.string(),
  scheduledAt: z.string().nullable(),
  bookingType: z.enum(["immediate", "scheduled", "recurring_template"]),
  parentBookingId: z.string().nullable(),
  preferredProviderId: z.string().nullable(),
  addressText: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  priceCents: z.number(),
  currency: z.string(),
  estimateDurationMinutes: z.number().nullable(),
  acceptedAt: z.string().nullable(),
  arrivedAt: z.string().nullable(),
  serviceStartedAt: z.string().nullable(),
  serviceCompletedAt: z.string().nullable(),
  clientConfirmedAt: z.string().nullable(),
  paidAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  cancelReason: z.string().nullable(),
  escalationAt: z.string().nullable(),
  escalatedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  meta: z.record(z.unknown()),
  client: BookingPartySchema.nullable(),
  provider: BookingPartySchema.nullable(),
  service: BookingServiceSummarySchema.nullable(),
  locations: z.array(BookingLocationPointSchema),
  events: z.array(BookingEventSchema),
  feedback: z.array(z.any()) // Deep feedback schema opt.
});

export type Booking = z.infer<typeof BookingSchema>;

export type BookingListMeta = {
  page: {
    number: number;
    size: number;
    total: number;
    totalPages: number;
  };
};

const mapUserParty = (payload: unknown): BookingParty | null => {
  if (!payload) {
    return null;
  }
  try {
    const user = mapUserResource(payload);
    if (!user?.id) {
      return null;
    }
    return {
      id: user.id,
      fullName: user.fullName ?? "",
      avatarUrl: user.avatarUrl ?? null,
      email: user.email ?? null,
      phone: user.phone ?? null
    };
  } catch {
    const raw = toObject(payload);
    const id = coerceId(raw.id);
    if (!id) {
      return null;
    }
    return {
      id,
      fullName: coerceString(raw.full_name) ?? coerceString(raw.fullName) ?? "",
      avatarUrl: coerceString(raw.avatar_url) ?? coerceString(raw.avatarUrl),
      email: coerceString(raw.email),
      phone: coerceString(raw.phone)
    };
  }
};

const mapService = (payload: unknown): BookingServiceSummary | null => {
  const raw = toObject(payload);
  const id = coerceId(raw.id);
  if (!id) {
    return null;
  }
  const categoryRaw = toObject(raw.category);
  const categoryId = coerceId(categoryRaw.id);
  return {
    id,
    name: coerceString(raw.name) ?? "",
    key: coerceString(raw.key),
    basePriceCents: coerceNumber(raw.base_price_cents),
    defaultEstimateMinutes: coerceNumber(raw.default_estimate_minutes),
    category: categoryId
      ? {
        id: categoryId,
        name: coerceString(categoryRaw.name),
        key: coerceString(categoryRaw.key)
      }
      : null
  };
};

export const mapBookingLocation = (payload: unknown): BookingLocationPoint | null => {
  const raw = toObject(payload);
  const id = coerceId(raw.id);
  if (!id) {
    return null;
  }
  const lat = coerceNumber(raw.lat);
  const lng = coerceNumber(raw.lng);
  const whoRaw = coerceString(raw.who);
  const who = whoRaw === "client" || whoRaw === "provider" ? whoRaw : "unknown";
  return {
    id,
    who,
    lat,
    lng,
    recordedAt: coerceDate(raw.recorded_at)
  };
};

export const mapBookingEvent = (payload: unknown): BookingEvent | null => {
  const raw = toObject(payload);
  const id = coerceId(raw.id);
  if (!id) {
    return null;
  }
  const action = coerceString(raw.action) ?? "unknown";
  const payloadData =
    raw.payload && typeof raw.payload === "object" ? (raw.payload as Record<string, unknown>) : {};
  return {
    id,
    action,
    payload: payloadData,
    at: coerceDate(raw.at),
    actor: mapUserParty(raw.actor)
  };
};

const mapDispute = (payload: unknown): BookingDispute | null => {
  const raw = toObject(payload);
  const id = coerceId(raw.id);
  if (!id) {
    return null;
  }
  return {
    id,
    status: coerceString(raw.status) ?? "open",
    reason: coerceString(raw.reason),
    resolution: coerceString(raw.resolution),
    resolvedAt: coerceDate(raw.resolved_at),
    openedBy: mapUserParty(raw.opened_by)
  };
};

export const mapFeedback = (payload: unknown): BookingFeedback | null => {
  const raw = toObject(payload);
  const id = coerceId(raw.id);
  if (!id) {
    return null;
  }
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const score = coerceNumber(raw.score) ?? 0;
  const analysisRaw = toObject(raw.analysis);
  const analysis = analysisRaw.sentiment_label
    ? {
      sentimentScore: coerceNumber(analysisRaw.sentiment_score) ?? 0,
      sentimentLabel: coerceString(analysisRaw.sentiment_label) ?? "neutral",
      summary: coerceString(analysisRaw.summary)
    }
    : null;

  return {
    id,
    score,
    tags,
    comment: coerceString(raw.comment),
    ratedAt: coerceDate(raw.rated_at),
    rater: mapUserParty(raw.rater),
    target: mapUserParty(raw.target),
    analysis
  };
};

const mapMeta = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

export const mapBooking = (payload: unknown): Booking | null => {
  if (!payload) return null;
  const raw = toObject(payload);

  // Normalize fields to match Zod schema expectation (camelCase)
  const normalized = {
    ...raw,
    scheduledAt: coerceDate(raw.scheduled_at),
    bookingType: coerceString(raw.booking_type) ?? "immediate",
    parentBookingId: coerceId(raw.parent_booking_id),
    preferredProviderId: coerceId(raw.preferred_provider_id),
    addressText: coerceString(raw.address_text),
    priceCents: coerceNumber(raw.price_cents) ?? 0,
    estimateDurationMinutes: coerceNumber(raw.estimate_duration_minutes),
    acceptedAt: coerceDate(raw.accepted_at),
    arrivedAt: coerceDate(raw.arrived_at),
    serviceStartedAt: coerceDate(raw.service_started_at),
    serviceCompletedAt: coerceDate(raw.service_completed_at),
    clientConfirmedAt: coerceDate(raw.client_confirmed_at),
    paidAt: coerceDate(raw.paid_at),
    cancelledAt: coerceDate(raw.cancelled_at),
    cancelReason: coerceString(raw.cancel_reason),
    escalationAt: coerceDate(raw.escalation_at),
    escalatedAt: coerceDate(raw.escalated_at),
    createdAt: coerceDate(raw.created_at),
    updatedAt: coerceDate(raw.updated_at),
    meta: raw.meta_data ?? raw.meta ?? {},
    client: mapUserParty(raw.client),
    provider: mapUserParty(raw.provider),
    service: mapService(raw.service),
    locations: (Array.isArray(raw.locations) ? raw.locations : [])
      .map(l => mapBookingLocation(l))
      .filter(Boolean),
    events: (Array.isArray(raw.events) ? raw.events : [])
      .map(e => mapBookingEvent(e))
      .filter(Boolean),
    feedback: Array.isArray(raw.feedback) ? raw.feedback : []
  };

  const result = BookingSchema.safeParse(normalized);
  if (!result.success) {
    if (import.meta.env.DEV) {
      console.error("[Zod] Booking Schema Mismatch:", result.error, normalized);
    }
    // Fallback or handle as needed - the $50k plan is strict
    return null;
  }
  return result.data;
};

export const mapBookings = (payload: unknown): Booking[] => {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .map((entry) => mapBooking(entry))
    .filter((entry): entry is Booking => Boolean(entry));
};

export const mapBookingListMeta = (meta: unknown, fallback?: Partial<BookingListMeta>): BookingListMeta => {
  const metaObj = toObject(meta);
  const pageRaw = toObject(metaObj.page);
  const defaultPage = fallback?.page ?? { number: 1, size: 25, total: 0, totalPages: 1 };
  const toInt = (value: unknown, defaultValue: number): number => {
    const num = coerceNumber(value);
    return num === null ? defaultValue : Math.max(0, Math.trunc(num));
  };
  return {
    page: {
      number: toInt(pageRaw.number, defaultPage.number),
      size: toInt(pageRaw.size, defaultPage.size),
      total: toInt(pageRaw.total, defaultPage.total),
      totalPages: toInt(pageRaw.total_pages ?? pageRaw.totalPages, defaultPage.totalPages)
    }
  };
};

export type BookingMutateInput = {
  serviceId: string;
  addressText?: string;
  lat?: number;
  lng?: number;
  estimateDurationMinutes?: number | null;
  emergency?: boolean;
  scheduledAt?: string;
  recurrence?: Record<string, unknown>;
  locationDetails?: Record<string, string>;
};

export type BookingMarkAction = "en_route" | "nearby" | "arrived" | "start_service" | "complete";

export type BookingConfirmDecision = "confirm" | "decline";

export type BookingLocationInput = {
  lat: number;
  lng: number;
  recordedAt?: string;
};

export type BookingFeedbackInput = {
  score: number;
  comment?: string;
  tags?: string[];
};

export interface BookingFeedback {
  id: string;
  score: number;
  tags: string[];
  comment: string | null;
  ratedAt: string | null;
  rater: BookingParty | null;
  target: BookingParty | null;
  analysis?: {
    sentimentScore: number;
    sentimentLabel: string;
    summary?: string | null;
  } | null;
}

export interface BookingDispute {
  id: string;
  status: string;
  reason: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  openedBy: BookingParty | null;
}
