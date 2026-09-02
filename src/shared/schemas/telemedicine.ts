import { z } from "zod";
import { coerceBoolean, coerceDate, coerceId, coerceNumber, coerceString, toObject } from "./helpers";

// Mirrors DISPUTE_TYPE_TELEMEDICINE_* on the backend (app/models/bookings.py) -- string literals
// checked against `booking.disputes[].disputeType`, kept here so every screen matches the same
// spelling rather than each hardcoding its own copy.
export const TELEMEDICINE_DISPUTE_TYPE_NO_SHOW = "telemedicine_no_show";
export const TELEMEDICINE_DISPUTE_TYPE_ASSIGNMENT_TIMEOUT = "telemedicine_assignment_timeout";
export const TELEMEDICINE_DISPUTE_TYPE_CANCELLATION_PAYMENT_REVIEW = "telemedicine_cancellation_payment_review";

export const BOOKING_STATUS_TELEMEDICINE_CANCELLED_PAYMENT_REVIEW = "telemedicine_cancelled_payment_review";
export const BOOKING_STATUS_TELEMEDICINE_UNATTENDED = "telemedicine_unattended";

export const TelemedicineHoldSchema = z.object({
  id: z.string(),
  facilityId: z.string(),
  facilityServiceId: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  status: z.enum(["active", "expired", "released", "consumed"]),
  isActive: z.boolean(),
  expiresAt: z.string(),
  remainingSeconds: z.number().int().nonnegative(),
  bookingId: z.string().nullable(),
  bookingStatus: z.string().nullable(),
  // Whether the server already has an outstanding payment attempt for this booking. Booking
  // status stays payment_pending from before the M-Pesa prompt is sent until after it is
  // approved, so it cannot answer this on its own -- and a reload during that window would
  // otherwise offer "Confirm & pay" for a prompt that is already on the client's phone.
  paymentPending: z.boolean()
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
    remainingSeconds: Math.max(0, Math.floor(coerceNumber(raw.remaining_seconds) ?? 0)),
    bookingId: coerceId(bookingRaw.id) || null,
    bookingStatus: coerceString(bookingRaw.status),
    // Absent on an older backend: treated as "no attempt outstanding", which is the
    // pre-existing behaviour rather than a new failure mode.
    paymentPending: bookingRaw.payment_pending === true
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

// GET /api/v1/telemedicine/policy -- the backend-owned source of truth for country support,
// display timezone, and the join/cancellation window. Never hardcode these values; a policy
// change (e.g. a longer join window) must reach every screen through this endpoint.
export const TelemedicinePolicySchema = z.object({
  policyVersion: z.string(),
  supportedCountryCodes: z.array(z.string()),
  defaultTimezone: z.string(),
  joinWindowBeforeMinutes: z.number(),
  cancellationCutoffMinutes: z.number(),
  remindersEnabled: z.boolean(),
  reminderWindowsMinutes: z.array(z.number())
});

export type TelemedicinePolicy = z.infer<typeof TelemedicinePolicySchema>;

export const mapTelemedicinePolicy = (payload: unknown): TelemedicinePolicy | null => {
  const raw = toObject(payload);
  const remindersRaw = toObject(raw.reminders);
  const cancellationRaw = toObject(raw.cancellation);
  const countryCodes = Array.isArray(raw.supported_country_codes)
    ? raw.supported_country_codes.filter((code): code is string => typeof code === "string")
    : [];
  const reminderWindows = Array.isArray(remindersRaw.windows_minutes_before)
    ? remindersRaw.windows_minutes_before.filter((value): value is number => typeof value === "number")
    : [];
  const normalized = {
    // The backend field is "version" (see get_telemedicine_policy in
    // telemedicine_policy_service.py), not "policy_version".
    policyVersion: coerceString(raw.version) ?? "",
    supportedCountryCodes: countryCodes,
    defaultTimezone: coerceString(raw.default_timezone) ?? "Africa/Nairobi",
    joinWindowBeforeMinutes: coerceNumber(raw.join_window_before_minutes) ?? 0,
    cancellationCutoffMinutes:
      coerceNumber(cancellationRaw.client_cutoff_minutes_before_scheduled_at) ?? coerceNumber(raw.join_window_before_minutes) ?? 0,
    remindersEnabled: coerceBoolean(remindersRaw.enabled) ?? false,
    reminderWindowsMinutes: reminderWindows
  };
  const result = TelemedicinePolicySchema.safeParse(normalized);
  if (!result.success) {
    if (import.meta.env.DEV) {
      console.error("[Zod] TelemedicinePolicy Schema Mismatch:", result.error, normalized);
    }
    return null;
  }
  return result.data;
};

// POST/GET/PATCH .../technical-issues -- a review-flag record, not a financial or dispute
// decision. `status` transitions are admin-only; nothing here ever confirms a refund.
export const TECHNICAL_ISSUE_STATUSES = ["open", "under_review", "resolved"] as const;

// Mirrors TECHNICAL_ISSUE_CATEGORIES in app/services/telemedicine_service.py exactly -- the
// backend rejects any other value with 400, so this is an enum, not free text.
export const TECHNICAL_ISSUE_CATEGORIES = ["connection", "audio", "video", "browser", "jitsi", "other"] as const;
export type TechnicalIssueCategory = (typeof TECHNICAL_ISSUE_CATEGORIES)[number];

export const TECHNICAL_ISSUE_CATEGORY_LABEL: Record<TechnicalIssueCategory, string> = {
  connection: "Connection",
  audio: "Audio",
  video: "Video",
  browser: "Browser",
  jitsi: "Jitsi / call platform",
  other: "Other"
};

export const TelemedicineTechnicalIssueSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  reporterRole: z.enum(["client", "provider"]),
  category: z.string().nullable(),
  description: z.string().nullable(),
  status: z.enum(TECHNICAL_ISSUE_STATUSES),
  adminNote: z.string().nullable(),
  createdAt: z.string().nullable()
});

export type TelemedicineTechnicalIssue = z.infer<typeof TelemedicineTechnicalIssueSchema>;

export const mapTelemedicineTechnicalIssue = (payload: unknown): TelemedicineTechnicalIssue | null => {
  const raw = toObject(payload);
  const id = coerceId(raw.id);
  const bookingId = coerceId(raw.booking_id);
  if (!id || !bookingId) {
    return null;
  }
  const roleRaw = coerceString(raw.reporter_role);
  const statusRaw = coerceString(raw.status) ?? "open";
  const normalized = {
    id,
    bookingId,
    reporterRole: roleRaw === "provider" ? "provider" : "client",
    category: coerceString(raw.category),
    description: coerceString(raw.description),
    status: (TECHNICAL_ISSUE_STATUSES as readonly string[]).includes(statusRaw) ? statusRaw : "open",
    adminNote: coerceString(raw.admin_note),
    createdAt: coerceDate(raw.created_at)
  };
  const result = TelemedicineTechnicalIssueSchema.safeParse(normalized);
  if (!result.success) {
    if (import.meta.env.DEV) {
      console.error("[Zod] TelemedicineTechnicalIssue Schema Mismatch:", result.error, normalized);
    }
    return null;
  }
  return result.data;
};

export const mapTelemedicineTechnicalIssues = (payload: unknown): TelemedicineTechnicalIssue[] => {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .map(mapTelemedicineTechnicalIssue)
    .filter((entry): entry is TelemedicineTechnicalIssue => Boolean(entry));
};

// GET /api/v1/admin/telemedicine/jitsi-health -- deliberately excludes domains, room
// identifiers, and secrets; this is an operational status view, not connection detail.
export const TelemedicineJitsiHealthSchema = z.object({
  status: z.string(),
  checkedAt: z.string().nullable(),
  latencyMs: z.number().nullable(),
  errorCategory: z.string().nullable()
});

export type TelemedicineJitsiHealth = z.infer<typeof TelemedicineJitsiHealthSchema>;

export const mapTelemedicineJitsiHealth = (payload: unknown): TelemedicineJitsiHealth | null => {
  const raw = toObject(payload);
  const normalized = {
    status: coerceString(raw.status) ?? "unknown",
    checkedAt: coerceDate(raw.checked_at),
    latencyMs: coerceNumber(raw.latency_ms),
    errorCategory: coerceString(raw.error_category)
  };
  const result = TelemedicineJitsiHealthSchema.safeParse(normalized);
  return result.success ? result.data : null;
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
