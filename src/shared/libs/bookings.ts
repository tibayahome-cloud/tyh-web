import api, { type CursorMeta, type CursorResponse } from "./api";
import { buildFieldParams, bookingCard, bookingDetail, bookingTimeline, bookingEventFields } from "./fieldInclude";
import type {
  Booking,
  BookingConfirmDecision,
  BookingEvent,
  BookingListMeta,
  BookingLocationInput,
  BookingMarkAction,
  BookingMutateInput,
  BookingFeedbackInput,
  BookingFeedback
} from "../schemas/booking";
import { mapBooking, mapBookingEvent, mapBookingListMeta, mapBookings, mapFeedback } from "../schemas/booking";

const bookingPresetMap = {
  card: bookingCard,
  detail: bookingDetail,
  timeline: bookingTimeline
} as const;

export type BookingPresetName = keyof typeof bookingPresetMap;

export type BookingListParams = {
  page?: number;
  pageSize?: number;
  statuses?: string[];
  clientId?: string;
  providerId?: string;
  serviceId?: string;
  bookingType?: string;
  from?: string;
  to?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
  preset?: BookingPresetName;
};

export type BookingListResult = {
  bookings: Booking[];
  meta: BookingListMeta;
  raw?: Record<string, unknown>;
};

const toCsv = (values?: string[]) =>
  values && values.length ? values.filter((value) => Boolean(value)).join(",") : undefined;

export const fetchBookings = async ({
  page = 1,
  pageSize = 25,
  statuses,
  clientId,
  providerId,
  serviceId,
  bookingType,
  from,
  to,
  scheduledFrom,
  scheduledTo,
  preset = "card"
}: BookingListParams = {}): Promise<BookingListResult> => {
  const presetConfig = bookingPresetMap[preset] ?? bookingPresetMap.card;
  const params: Record<string, unknown> = {
    "page[number]": page,
    "page[size]": pageSize,
    ...buildFieldParams(presetConfig)
  };
  const statusCsv = toCsv(statuses);
  if (statusCsv) {
    params["filter[status]"] = statusCsv;
  }
  if (clientId) {
    params["filter[client_user_id]"] = clientId;
  }
  if (providerId) {
    params["filter[provider_user_id]"] = providerId;
  }
  if (serviceId) {
    params["filter[service_id]"] = serviceId;
  }
  if (bookingType) {
    params["filter[booking_type]"] = bookingType;
  }
  if (from) {
    params["filter[from]"] = from;
  }
  if (to) {
    params["filter[to]"] = to;
  }
  if (scheduledFrom) {
    params["filter[scheduled_from]"] = scheduledFrom;
  }
  if (scheduledTo) {
    params["filter[scheduled_to]"] = scheduledTo;
  }

  const response = await api.get("/bookings", { params });
  const payload = (response.data ?? {}) as Record<string, unknown>;
  const data = Array.isArray(payload.data) ? payload.data : [];
  const bookings = mapBookings(data);
  const meta = mapBookingListMeta(payload.meta, {
    page: {
      number: page,
      size: pageSize,
      total: bookings.length,
      totalPages: 1
    }
  });
  return { bookings, meta, raw: payload };
};

export const fetchBooking = async (bookingId: string, preset: BookingPresetName = "detail"): Promise<Booking> => {
  const presetConfig = bookingPresetMap[preset] ?? bookingPresetMap.detail;
  const response = await api.get(`/bookings/${bookingId}`, {
    params: buildFieldParams(presetConfig)
  });
  const booking = mapBooking(response.data?.data);
  if (!booking) {
    throw new Error("Booking not found");
  }
  return booking;
};

export const fetchBookingEvents = async (bookingId: string): Promise<BookingEvent[]> => {
  const response = await api.get(`/bookings/${bookingId}/events`, {
    params: buildFieldParams(bookingEventFields)
  });
  const payload = response.data ?? {};
  const data = Array.isArray(payload.data) ? payload.data : [];
  return data
    .map((entry: unknown) => mapBookingEvent(entry))
    .filter((entry: unknown): entry is BookingEvent => Boolean(entry));
};

export const createBooking = async (
  input: BookingMutateInput,
  preset: BookingPresetName = "detail"
): Promise<{ booking: Booking; meta?: Record<string, unknown> }> => {
  const presetConfig = bookingPresetMap[preset] ?? bookingPresetMap.detail;
  const payload: Record<string, unknown> = {
    service_id: input.serviceId,
    address_text: input.addressText,
    lat: input.lat,
    lng: input.lng,
    estimate_duration_minutes: input.estimateDurationMinutes,
    emergency: input.emergency,
    scheduled_at: input.scheduledAt,
    recurrence: input.recurrence
  };
  if (input.locationDetails) {
    payload.location_details = input.locationDetails;
  }
  const response = await api.post("/bookings", payload, {
    params: buildFieldParams(presetConfig)
  });
  const booking = mapBooking(response.data?.data);
  if (!booking) {
    throw new Error("Failed to create booking");
  }
  return { booking, meta: response.data?.meta };
};

export const acceptBooking = async (
  bookingId: string,
  preset: BookingPresetName = "detail"
): Promise<Booking> => {
  const presetConfig = bookingPresetMap[preset] ?? bookingPresetMap.detail;
  const response = await api.post(`/bookings/${bookingId}/accept`, {}, { params: buildFieldParams(presetConfig) });
  const booking = mapBooking(response.data?.data);
  if (!booking) {
    throw new Error("Failed to accept booking");
  }
  return booking;
};

export const markBooking = async (
  bookingId: string,
  action: BookingMarkAction,
  preset: BookingPresetName = "detail"
): Promise<Booking> => {
  const presetConfig = bookingPresetMap[preset] ?? bookingPresetMap.detail;
  const response = await api.post(
    `/bookings/${bookingId}/mark`,
    { action },
    { params: buildFieldParams(presetConfig) }
  );
  const booking = mapBooking(response.data?.data);
  if (!booking) {
    throw new Error("Failed to update booking status");
  }
  return booking;
};

export const confirmBooking = async (
  bookingId: string,
  decision: BookingConfirmDecision,
  reason?: string,
  preset: BookingPresetName = "detail"
): Promise<Booking> => {
  const presetConfig = bookingPresetMap[preset] ?? bookingPresetMap.detail;
  const response = await api.post(
    `/bookings/${bookingId}/confirm`,
    { decision, reason },
    { params: buildFieldParams(presetConfig) }
  );
  const booking = mapBooking(response.data?.data);
  if (!booking) {
    throw new Error("Failed to confirm booking");
  }
  return booking;
};

export const cancelBooking = async (
  bookingId: string,
  reason?: string,
  preset: BookingPresetName = "detail"
): Promise<Booking> => {
  const presetConfig = bookingPresetMap[preset] ?? bookingPresetMap.detail;
  const response = await api.post(
    `/bookings/${bookingId}/cancel`,
    { reason },
    { params: buildFieldParams(presetConfig) }
  );
  const booking = mapBooking(response.data?.data);
  if (!booking) {
    throw new Error("Failed to cancel booking");
  }
  return booking;
};

export const postBookingLocation = async (bookingId: string, input: BookingLocationInput) => {
  return api.post(`/bookings/${bookingId}/location`, {
    lat: input.lat,
    lng: input.lng,
    recorded_at: input.recordedAt
  });
};

export const reassignBooking = async (bookingId: string, providerUserId: string, reason?: string, preset: BookingPresetName = "detail"): Promise<Booking> => {
  const presetConfig = bookingPresetMap[preset] ?? bookingPresetMap.detail;
  const response = await api.post(
    `/bookings/${bookingId}/reassign`,
    { provider_user_id: providerUserId, reason },
    { params: buildFieldParams(presetConfig) }
  );
  const booking = mapBooking(response.data?.data);
  if (!booking) {
    throw new Error("Failed to reassign booking");
  }
  return booking;
};

export const submitBookingFeedback = async (
  bookingId: string,
  input: BookingFeedbackInput
): Promise<BookingFeedback> => {
  const response = await api.post(`/bookings/${bookingId}/feedback`, input);
  const feedback = mapFeedback(response.data?.data);
  if (!feedback) {
    throw new Error("Failed to submit feedback");
  }
  return feedback;
};

// ============================================================================
// BOOKING NOTES API
// ============================================================================

import type {
  BookingNote,
  NoteTemplate,
  CreateNoteInput,
  UpdateNoteInput,
  AddAttachmentInput
} from "../schemas/bookingNotes";
import { mapBookingNotes, mapBookingNote, mapNoteTemplates } from "../schemas/bookingNotes";

export const fetchBookingNotes = async (
  bookingId: string,
  noteType?: string,
  cursor?: string | null,
  limit?: number
): Promise<CursorResponse<BookingNote>> => {
  const params: Record<string, string | number> = {};
  if (noteType) {
    params["filter[note_type]"] = noteType;
  }
  if (cursor) {
    params.cursor = cursor;
  }
  if (limit) {
    params.limit = limit;
  }
  const response = await api.get(`/bookings/${bookingId}/notes`, { params });
  const payload = response.data ?? {};
  const data = Array.isArray(payload.data) ? payload.data : [];
  const meta = payload.meta as CursorMeta;

  return {
    data: mapBookingNotes(data),
    meta: meta || { limit: limit ?? 20, next_cursor: null }
  };
};

export const createBookingNote = async (
  bookingId: string,
  input: CreateNoteInput
): Promise<BookingNote> => {
  const payload = {
    content: input.content,
    note_type: input.noteType ?? "observation",
    is_flagged: input.isFlagged ?? false,
    carry_forward: input.carryForward ?? false,
    attachments: input.attachments,
    template_id: input.templateId
  };
  const response = await api.post(`/bookings/${bookingId}/notes`, payload);
  const note = mapBookingNote(response.data?.data);
  if (!note) {
    throw new Error("Failed to create note");
  }
  return note;
};

export const updateBookingNote = async (
  bookingId: string,
  noteId: string,
  input: UpdateNoteInput
): Promise<BookingNote> => {
  const payload: Record<string, unknown> = {};
  if (input.content !== undefined) payload.content = input.content;
  if (input.noteType !== undefined) payload.note_type = input.noteType;
  if (input.isFlagged !== undefined) payload.is_flagged = input.isFlagged;
  if (input.carryForward !== undefined) payload.carry_forward = input.carryForward;
  if (input.attachments !== undefined) payload.attachments = input.attachments;

  const response = await api.patch(`/bookings/${bookingId}/notes/${noteId}`, payload);
  const note = mapBookingNote(response.data?.data);
  if (!note) {
    throw new Error("Failed to update note");
  }
  return note;
};

export const deleteBookingNote = async (bookingId: string, noteId: string): Promise<void> => {
  await api.delete(`/bookings/${bookingId}/notes/${noteId}`);
};

export const addNoteAttachment = async (
  bookingId: string,
  noteId: string,
  input: AddAttachmentInput
): Promise<BookingNote> => {
  const response = await api.post(`/bookings/${bookingId}/notes/${noteId}/attachments`, {
    url: input.url,
    type: input.type ?? "image/jpeg",
    caption: input.caption
  });
  const note = mapBookingNote(response.data?.data);
  if (!note) {
    throw new Error("Failed to add attachment");
  }
  return note;
};

export const removeNoteAttachment = async (
  bookingId: string,
  noteId: string,
  attachmentId: string
): Promise<BookingNote> => {
  const response = await api.delete(
    `/bookings/${bookingId}/notes/${noteId}/attachments/${attachmentId}`
  );
  const note = mapBookingNote(response.data?.data);
  if (!note) {
    throw new Error("Failed to remove attachment");
  }
  return note;
};

// ============================================================================
// NOTE TEMPLATES API
// ============================================================================

export const fetchNoteTemplates = async (
  serviceId: string,
  activeOnly = true
): Promise<NoteTemplate[]> => {
  const params: Record<string, string> = {};
  if (!activeOnly) {
    params.active_only = "false";
  }
  const response = await api.get(`/services/${serviceId}/note-templates`, { params });
  const payload = response.data ?? {};
  const data = Array.isArray(payload.data) ? payload.data : [];
  return mapNoteTemplates(data);
};
