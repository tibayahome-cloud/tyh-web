import api from "./api";

/**
 * Client for the telemedicine operations endpoints: provider preferences, rescheduling, the
 * payment report and the operator review queue.
 *
 * Kept apart from telemedicine.ts, which covers the booking and consultation flow a client
 * walks through. These are the surfaces that exist because something went sideways, or because
 * an operator needs to see across bookings, and they have different audiences.
 */

// ---------------------------------------------------------------------------
// Provider preferences
// ---------------------------------------------------------------------------

/** What a client may ask for. Requests, never guarantees -- admin.ops assigns. */
export type ProviderPreference = {
  preferredGender: string | null;
  preferredLanguage: string | null;
  preferredSpecialty: string | null;
  note: string | null;
};

const mapPreference = (raw: Record<string, unknown> | null | undefined): ProviderPreference | null => {
  if (!raw) return null;
  return {
    preferredGender: (raw.preferred_gender as string) ?? null,
    preferredLanguage: (raw.preferred_language as string) ?? null,
    preferredSpecialty: (raw.preferred_specialty as string) ?? null,
    note: (raw.note as string) ?? null
  };
};

export const fetchProviderPreference = async (bookingId: string): Promise<ProviderPreference | null> => {
  const response = await api.get(`/telemedicine/bookings/${bookingId}/provider-preference`);
  return mapPreference(response.data?.data);
};

export const saveProviderPreference = async (
  bookingId: string,
  preference: Partial<ProviderPreference>
): Promise<ProviderPreference | null> => {
  const response = await api.put(`/telemedicine/bookings/${bookingId}/provider-preference`, {
    preferred_gender: preference.preferredGender ?? null,
    preferred_language: preference.preferredLanguage ?? null,
    preferred_specialty: preference.preferredSpecialty ?? null,
    note: preference.note ?? null
  });
  return mapPreference(response.data?.data);
};

// ---------------------------------------------------------------------------
// Rescheduling
// ---------------------------------------------------------------------------

export type RescheduleStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "expired"
  | "admin_approved";

export type RescheduleRequest = {
  id: string;
  bookingId: string;
  status: RescheduleStatus;
  proposedStartAt: string | null;
  proposedEndAt: string | null;
  reason: string | null;
  requestedByUserId: string | null;
  respondedByUserId: string | null;
  responseNote: string | null;
  resolvedAt: string | null;
};

const mapReschedule = (raw: Record<string, unknown>): RescheduleRequest => ({
  id: String(raw.id),
  bookingId: String(raw.booking_id),
  status: raw.status as RescheduleStatus,
  proposedStartAt: (raw.proposed_start_at as string) ?? null,
  proposedEndAt: (raw.proposed_end_at as string) ?? null,
  reason: (raw.reason as string) ?? null,
  requestedByUserId: (raw.requested_by_user_id as string) ?? null,
  respondedByUserId: (raw.responded_by_user_id as string) ?? null,
  responseNote: (raw.response_note as string) ?? null,
  resolvedAt: (raw.resolved_at as string) ?? null
});

export const fetchRescheduleRequests = async (bookingId: string): Promise<RescheduleRequest[]> => {
  const response = await api.get(`/telemedicine/bookings/${bookingId}/reschedule-requests`);
  const rows = Array.isArray(response.data?.data) ? response.data.data : [];
  return rows.map(mapReschedule);
};

export const proposeReschedule = async (
  bookingId: string,
  proposedStartAt: string,
  reason?: string
): Promise<RescheduleRequest> => {
  const response = await api.post(`/telemedicine/bookings/${bookingId}/reschedule-requests`, {
    proposed_start_at: proposedStartAt,
    reason: reason ?? null
  });
  return mapReschedule(response.data?.data);
};

const respond = async (requestId: string, action: string, note?: string): Promise<RescheduleRequest> => {
  const response = await api.post(`/telemedicine/reschedule-requests/${requestId}/${action}`, {
    note: note ?? null
  });
  return mapReschedule(response.data?.data);
};

export const acceptReschedule = (requestId: string, note?: string) => respond(requestId, "accept", note);
export const declineReschedule = (requestId: string, note?: string) => respond(requestId, "decline", note);
export const cancelReschedule = (requestId: string) => respond(requestId, "cancel");

// ---------------------------------------------------------------------------
// Payment report
// ---------------------------------------------------------------------------

export type PaymentReportRow = {
  paymentId: string;
  status: string;
  amountCents: number;
  currency: string;
  createdAt: string | null;
  failureReason: string | null;
  mpesaReceiptNumber: string | null;
  booking: { bookingId: string; status: string | null; scheduledAt: string | null };
  /** recorded is false until settlement actually runs; it never implies a payout. */
  settlement: { recorded: boolean; providerPayoutCents: number | null };
  review: { pending: boolean; disputeId: string | null; disputeType: string | null };
  refund: { status: string | null; refundedAt: string | null };
  client?: { userId: string; fullName: string | null } | null;
  facility?: { id: string; name: string | null } | null;
};

const mapReportRow = (raw: Record<string, any>): PaymentReportRow => ({
  paymentId: String(raw.payment_id),
  status: String(raw.status),
  amountCents: Number(raw.amount_cents ?? 0),
  currency: String(raw.currency ?? "KES"),
  createdAt: raw.created_at ?? null,
  failureReason: raw.failure_reason ?? null,
  mpesaReceiptNumber: raw.mpesa_receipt_number ?? null,
  booking: {
    bookingId: String(raw.booking?.booking_id ?? ""),
    status: raw.booking?.status ?? null,
    scheduledAt: raw.booking?.scheduled_at ?? null
  },
  settlement: {
    recorded: Boolean(raw.settlement?.recorded),
    providerPayoutCents: raw.settlement?.provider_payout_cents ?? null
  },
  review: {
    pending: Boolean(raw.review?.pending),
    disputeId: raw.review?.dispute_id ?? null,
    disputeType: raw.review?.dispute_type ?? null
  },
  refund: { status: raw.refund?.status ?? null, refundedAt: raw.refund?.refunded_at ?? null },
  client: raw.client ? { userId: String(raw.client.user_id), fullName: raw.client.full_name ?? null } : null,
  facility: raw.facility ? { id: String(raw.facility.id), name: raw.facility.name ?? null } : null
});

export type PaymentReportFilters = {
  status?: string;
  facilityId?: string;
  bookingId?: string;
  reference?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export const fetchPaymentReport = async (filters: PaymentReportFilters = {}) => {
  const params: Record<string, unknown> = {
    "page[number]": filters.page ?? 1,
    "page[size]": filters.pageSize ?? 25
  };
  if (filters.status) params["filter[status]"] = filters.status;
  if (filters.facilityId) params["filter[facility_id]"] = filters.facilityId;
  if (filters.bookingId) params["filter[booking_id]"] = filters.bookingId;
  if (filters.reference) params["filter[reference]"] = filters.reference;
  if (filters.from) params["filter[from]"] = filters.from;
  if (filters.to) params["filter[to]"] = filters.to;

  const response = await api.get("/admin/payments/report", { params });
  const rows = Array.isArray(response.data?.data) ? response.data.data : [];
  return { rows: rows.map(mapReportRow), meta: response.data?.meta ?? {} };
};

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------

export type ReviewCategory =
  | "payment_review"
  | "cancellation_payment_review"
  | "no_show"
  | "technical_issue"
  | "reschedule_escalation";

export type ReviewItem = {
  category: ReviewCategory;
  id: string;
  status: string;
  bookingId: string | null;
  facilityId: string | null;
  scheduledAt: string | null;
  paymentId: string | null;
  openedAt: string | null;
  summary: string | null;
};

const mapReviewItem = (raw: Record<string, any>): ReviewItem => ({
  category: raw.category,
  id: String(raw.id),
  status: String(raw.status ?? "open"),
  bookingId: raw.booking_id ?? null,
  facilityId: raw.facility_id ?? null,
  scheduledAt: raw.scheduled_at ?? null,
  paymentId: raw.payment_id ?? null,
  openedAt: raw.opened_at ?? null,
  summary: raw.summary ?? null
});

export const fetchReviewQueue = async (categories?: ReviewCategory[]): Promise<ReviewItem[]> => {
  const params: Record<string, unknown> = {};
  if (categories?.length) params["filter[category]"] = categories.join(",");
  const response = await api.get("/admin/payments/reviews", { params });
  const rows = Array.isArray(response.data?.data) ? response.data.data : [];
  return rows.map(mapReviewItem);
};

/**
 * Close one review item. A reason is required by the backend, so it is required here rather
 * than sent empty and rejected -- the caller finds out at the form, not after a round trip.
 */
export const resolveReviewItem = async (
  category: ReviewCategory,
  itemId: string,
  reason: string,
  outcome?: string
) => {
  if (!reason.trim()) {
    throw new Error("A reason is required to resolve a review item");
  }
  const response = await api.post(`/admin/payments/reviews/${category}/${itemId}/resolve`, {
    reason,
    outcome: outcome ?? ""
  });
  return response.data?.data;
};
