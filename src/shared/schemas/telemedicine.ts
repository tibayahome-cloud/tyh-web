import { z } from "zod";
import { coerceBoolean, coerceDate, coerceId, coerceNumber, coerceString, toObject } from "./helpers";

export const TelemedicineHoldSchema = z.object({
  id: z.string(),
  facilityId: z.string(),
  facilityServiceId: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  status: z.enum(["active", "expired", "released", "consumed"]),
  isActive: z.boolean(),
  expiresAt: z.string(),
  bookingId: z.string().nullable(),
  bookingStatus: z.string().nullable()
});

export type TelemedicineHold = z.infer<typeof TelemedicineHoldSchema>;

export const mapTelemedicineHold = (payload: unknown): TelemedicineHold | null => {
  const raw = toObject(payload);
  const id = coerceId(raw.id);
  if (!id) {
    return null;
  }
  const bookingRaw = toObject(raw.booking);
  const statusRaw = coerceString(raw.status) ?? "active";
  const status = ["active", "expired", "released", "consumed"].includes(statusRaw) ? statusRaw : "active";
  const normalized = {
    id,
    facilityId: coerceId(raw.facility_id),
    facilityServiceId: coerceId(raw.facility_service_id),
    startAt: coerceDate(raw.start_at) ?? "",
    endAt: coerceDate(raw.end_at) ?? "",
    status: status as TelemedicineHold["status"],
    isActive: coerceBoolean(raw.is_active) ?? false,
    expiresAt: coerceDate(raw.expires_at) ?? "",
    bookingId: coerceId(bookingRaw.id) || null,
    bookingStatus: coerceString(bookingRaw.status)
  };
  const result = TelemedicineHoldSchema.safeParse(normalized);
  if (!result.success) {
    if (import.meta.env.DEV) {
      console.error("[Zod] TelemedicineHold Schema Mismatch:", result.error, normalized);
    }
    return null;
  }
  return result.data;
};

export const TelemedicineSlotSchema = z.object({
  startAt: z.string(),
  endAt: z.string(),
  availableProviderCount: z.number()
});

export type TelemedicineSlot = z.infer<typeof TelemedicineSlotSchema>;

export const mapTelemedicineSlot = (payload: unknown): TelemedicineSlot | null => {
  const raw = toObject(payload);
  const startAt = coerceDate(raw.start_at);
  const endAt = coerceDate(raw.end_at);
  if (!startAt || !endAt) {
    return null;
  }
  const normalized = {
    startAt,
    endAt,
    availableProviderCount: coerceNumber(raw.available_provider_count) ?? 0
  };
  const result = TelemedicineSlotSchema.safeParse(normalized);
  return result.success ? result.data : null;
};

export const mapTelemedicineSlots = (payload: unknown): TelemedicineSlot[] => {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload.map(mapTelemedicineSlot).filter((slot): slot is TelemedicineSlot => Boolean(slot));
};

export const TelemedicineAssignableProviderSchema = z.object({
  providerUserId: z.string(),
  fullName: z.string().nullable()
});

export type TelemedicineAssignableProvider = z.infer<typeof TelemedicineAssignableProviderSchema>;

export const TelemedicineAssignmentBookingSchema = z.object({
  id: z.string(),
  facilityId: z.string(),
  serviceId: z.string(),
  serviceName: z.string().nullable(),
  clientUserId: z.string(),
  clientFullName: z.string().nullable(),
  scheduledAt: z.string().nullable(),
  estimateDurationMinutes: z.number().nullable(),
  status: z.string(),
  assignableProviders: z.array(TelemedicineAssignableProviderSchema)
});

export type TelemedicineAssignmentBooking = z.infer<typeof TelemedicineAssignmentBookingSchema>;

export const mapTelemedicineAssignmentBooking = (payload: unknown): TelemedicineAssignmentBooking | null => {
  const raw = toObject(payload);
  const id = coerceId(raw.id);
  if (!id) {
    return null;
  }
  const providers = Array.isArray(raw.assignable_providers) ? raw.assignable_providers : [];
  const normalized = {
    id,
    facilityId: coerceId(raw.facility_id),
    serviceId: coerceId(raw.service_id),
    serviceName: coerceString(raw.service_name),
    clientUserId: coerceId(raw.client_user_id),
    clientFullName: coerceString(raw.client_full_name),
    scheduledAt: coerceDate(raw.scheduled_at),
    estimateDurationMinutes: coerceNumber(raw.estimate_duration_minutes),
    status: coerceString(raw.status) ?? "",
    assignableProviders: providers.map((entry: unknown) => {
      const providerRaw = toObject(entry);
      return {
        providerUserId: coerceId(providerRaw.provider_user_id),
        fullName: coerceString(providerRaw.full_name)
      };
    })
  };
  const result = TelemedicineAssignmentBookingSchema.safeParse(normalized);
  if (!result.success) {
    if (import.meta.env.DEV) {
      console.error("[Zod] TelemedicineAssignmentBooking Schema Mismatch:", result.error, normalized);
    }
    return null;
  }
  return result.data;
};

export const mapTelemedicineAssignmentBookings = (payload: unknown): TelemedicineAssignmentBooking[] => {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .map(mapTelemedicineAssignmentBooking)
    .filter((entry): entry is TelemedicineAssignmentBooking => Boolean(entry));
};

export const TelemedicineSessionJoinSchema = z.object({
  sessionId: z.string(),
  roomName: z.string(),
  domain: z.string(),
  token: z.string(),
  expiresAt: z.string(),
  role: z.enum(["client", "provider"]),
  isModerator: z.boolean(),
  status: z.string()
});

export type TelemedicineSessionJoin = z.infer<typeof TelemedicineSessionJoinSchema>;

export const mapTelemedicineSessionJoin = (payload: unknown): TelemedicineSessionJoin | null => {
  const raw = toObject(payload);
  const sessionId = coerceId(raw.session_id);
  const roomName = coerceString(raw.room_name);
  const token = coerceString(raw.token);
  if (!sessionId || !roomName || !token) {
    return null;
  }
  const roleRaw = coerceString(raw.role);
  const normalized = {
    sessionId,
    roomName,
    domain: coerceString(raw.domain) ?? "",
    token,
    expiresAt: coerceDate(raw.expires_at) ?? "",
    role: roleRaw === "provider" ? "provider" : "client",
    isModerator: coerceBoolean(raw.is_moderator) ?? false,
    status: coerceString(raw.status) ?? ""
  };
  const result = TelemedicineSessionJoinSchema.safeParse(normalized);
  if (!result.success) {
    if (import.meta.env.DEV) {
      console.error("[Zod] TelemedicineSessionJoin Schema Mismatch:", result.error, normalized);
    }
    return null;
  }
  return result.data;
};

// Nested summary attached to a Booking (see mapBooking in ./booking.ts), not the join-token
// response above -- this is the session's current lifecycle state, not a fresh token.
export const TelemedicineSessionSummarySchema = z.object({
  id: z.string(),
  roomName: z.string().nullable(),
  status: z.string(),
  providerJoinedAt: z.string().nullable(),
  clientJoinedAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable()
});

export type TelemedicineSessionSummary = z.infer<typeof TelemedicineSessionSummarySchema>;

export const mapTelemedicineSessionSummary = (payload: unknown): TelemedicineSessionSummary | null => {
  const raw = toObject(payload);
  const id = coerceId(raw.id);
  if (!id) {
    return null;
  }
  const normalized = {
    id,
    roomName: coerceString(raw.room_name),
    status: coerceString(raw.status) ?? "scheduled",
    providerJoinedAt: coerceDate(raw.provider_joined_at),
    clientJoinedAt: coerceDate(raw.client_joined_at),
    startedAt: coerceDate(raw.started_at),
    endedAt: coerceDate(raw.ended_at)
  };
  const result = TelemedicineSessionSummarySchema.safeParse(normalized);
  return result.success ? result.data : null;
};
