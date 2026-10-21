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
  note: string | null;
};

const mapPreference = (raw: Record<string, unknown> | null | undefined): ProviderPreference | null => {
  if (!raw) return null;
  return {
    preferredGender: (raw.preferred_gender as string) ?? null,
    preferredLanguage: (raw.preferred_language as string) ?? null,
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

export type RescheduleSlots = { slots: Array<{ startAt: string; endAt: string }>; timezone: string | null };

/** Times that could be offered for this consultation, limited to what its assigned provider can actually take. */
export const fetchRescheduleSlots = async (
  bookingId: string,
  startDate: string,
  endDate: string
): Promise<RescheduleSlots> => {
  const response = await api.get(`/telemedicine/bookings/${bookingId}/reschedule-slots`, {
    params: { start_date: startDate, end_date: endDate }
  });
  const rows = Array.isArray(response.data?.data) ? (response.data.data as Array<Record<string, unknown>>) : [];
  const meta = (response.data?.meta ?? {}) as Record<string, unknown>;
  return {
    slots: rows
      .filter((row) => typeof row.start_at === "string" && typeof row.end_at === "string")
      .map((row) => ({ startAt: String(row.start_at), endAt: String(row.end_at) })),
    timezone: typeof meta.timezone === "string" && meta.timezone ? meta.timezone : null
  };
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
export const cancelReschedule = (requestId: string) => respond(requestId, "cancel");
export const declineReschedule = (requestId: string, note?: string) => respond(requestId, "decline", note);

// ---------------------------------------------------------------------------
// What is waiting on the signed-in person
// ---------------------------------------------------------------------------

// `time_confirmed` is a heads-up with nothing to answer: a consultation of the provider's now has a new
// confirmed time. It stays listed until it is opened.
export type AttentionKind = "reschedule_request" | "rebooking_offer" | "time_confirmed";

export type AttentionItem = {
  kind: AttentionKind;
  id: string;
  bookingId: string;
  proposedStartAt: string | null;
  // Only a replacement-time offer lapses.
  expiresAt: string | null;
  reason: string | null;
  createdAt: string | null;
  currentStartAt: string | null;
  role: "client" | "provider";
  serviceName: string;
  // The other participant, or the facility for a replacement-time offer.
  fromName: string | null;
  // True for a heads-up that is dismissed by opening it rather than answered.
  acknowledgeable: boolean;
};

const text = (value: unknown): string | null => (typeof value === "string" && value ? value : null);

export const mapAttentionItem = (value: unknown): AttentionItem | null => {
  const raw = (value ?? {}) as Record<string, unknown>;
  const kind =
    raw.kind === "reschedule_request" || raw.kind === "rebooking_offer" || raw.kind === "time_confirmed" ? raw.kind : null;
  const id = text(raw.id);
  const bookingId = text(raw.booking_id);
  if (!kind || !id || !bookingId) return null;
  return {
    kind,
    id,
    bookingId,
    proposedStartAt: text(raw.proposed_start_at),
    expiresAt: text(raw.expires_at),
    reason: text(raw.reason),
    createdAt: text(raw.created_at),
    currentStartAt: text(raw.current_start_at),
    role: raw.role === "provider" ? "provider" : "client",
    serviceName: text(raw.service_name) ?? "Consultation",
    fromName: text(raw.from_name),
    acknowledgeable: raw.acknowledgeable === true
  };
};

export const fetchTelemedicineAttention = async (): Promise<AttentionItem[]> => {
  const response = await api.get("/telemedicine/attention");
  const items = (response.data?.data?.items ?? []) as unknown[];
  return items.map(mapAttentionItem).filter((item): item is AttentionItem => item !== null);
};

export const acknowledgeAttentionItem = async (itemId: string): Promise<void> => {
  await api.post(`/telemedicine/attention/${itemId}/acknowledge`, {});
};

export const acceptRebookingOffer = async (bookingId: string): Promise<void> => {
  await api.post(`/telemedicine/bookings/${bookingId}/rebookings/accept`, {});
};

export const declineRebookingOffer = async (bookingId: string, note?: string): Promise<void> => {
  await api.post(`/telemedicine/bookings/${bookingId}/rebookings/decline`, note ? { note } : {});
};

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
  | "reschedule_escalation"
  | "provider_earnings_complaint";

/** One decision the operator may choose for an item, with what it does, supplied by the server. */
export type ReviewOutcome = { key: string; label: string; effect: string };

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
  clientName: string | null;
  providerName: string | null;
  serviceName: string | null;
  outcomes: ReviewOutcome[];
  /** What a full refund would send back, when the item has a payment that can be refunded. */
  refundableAmountCents: number | null;
  refundableCurrency: string | null;
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
  summary: raw.summary ?? null,
  clientName: raw.client_name ?? null,
  providerName: raw.provider_name ?? null,
  serviceName: raw.service_name ?? null,
  outcomes: Array.isArray(raw.outcomes) ? raw.outcomes : [],
  refundableAmountCents: typeof raw.refundable_amount_cents === "number" ? raw.refundable_amount_cents : null,
  refundableCurrency: raw.refundable_currency ?? null
});

export const fetchReviewQueue = async (categories?: ReviewCategory[]): Promise<ReviewItem[]> => {
  const params: Record<string, unknown> = {};
  if (categories?.length) params["filter[category]"] = categories.join(",");
  const response = await api.get("/admin/payments/reviews", { params });
  const rows = Array.isArray(response.data?.data) ? response.data.data : [];
  return rows.map(mapReviewItem);
};

export type ReviewResolution = {
  outcome: string;
  refund: { requested: boolean; payment_id: string | null; amount_cents: number | null; currency: string | null; already_requested: boolean };
};

/**
 * Close one review item with an outcome chosen from the item's own list. A reason is required by the backend, so it is
 * required here rather than sent empty and rejected. A refund must carry the amount the screen showed: the server
 * refuses if the payment is no longer that amount.
 */
export const resolveReviewItem = async (
  category: ReviewCategory,
  itemId: string,
  input: { reason: string; outcome: string; refundAmountCents?: number | null }
): Promise<ReviewResolution> => {
  if (!input.reason.trim()) {
    throw new Error("A reason is required to resolve a review item");
  }
  if (!input.outcome) {
    throw new Error("Choose what to do");
  }
  const response = await api.post(`/admin/payments/reviews/${category}/${itemId}/resolve`, {
    reason: input.reason,
    outcome: input.outcome,
    refund_amount_cents: input.refundAmountCents ?? undefined
  });
  return response.data?.data;
};
