import { z } from "zod";
import { coerceDate, coerceId, coerceNumber, coerceString, toObject } from "./helpers";
import { BookingSchema, mapBooking } from "./booking";

export const PaymentAttemptSchema = z.object({
  id: z.string(),
  status: z.string(),
  requestPayload: z.record(z.unknown()),
  responsePayload: z.record(z.unknown()),
  createdAt: z.string().nullable()
});

export type PaymentAttempt = z.infer<typeof PaymentAttemptSchema>;

export const PaymentSettlementSchema = z.object({
  bookingAmountCents: z.number(),
  platformFeeCents: z.number(),
  facilityShareCents: z.number(),
  providerPayoutCents: z.number(),
  providerCompensationMode: z.string().nullable()
});

export type PaymentSettlement = z.infer<typeof PaymentSettlementSchema>;

export const PaymentRecordSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  clientUserId: z.string().nullable(),
  providerUserId: z.string().nullable(),
  status: z.string(),
  channel: z.string().nullable(),
  providerRef: z.string().nullable(),
  amountCents: z.number(),
  currency: z.string(),
  description: z.string().nullable(),
  retryCount: z.number(),
  failureReason: z.string().nullable(),
  mpesaReceiptNumber: z.string().nullable(),
  merchantRequestId: z.string().nullable(),
  checkoutRequestId: z.string().nullable(),
  initiatedAt: z.string().nullable(),
  succeededAt: z.string().nullable(),
  failedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  refundStatus: z.string().nullable(),
  refundedAt: z.string().nullable(),
  settlement: PaymentSettlementSchema.nullable(),
  attempts: z.array(PaymentAttemptSchema),
  booking: BookingSchema.nullable().optional()
});

export type PaymentRecord = z.infer<typeof PaymentRecordSchema>;

export const PaymentSummarySchema = z.object({
  totalCollectedCents: z.number(),
  pendingCents: z.number(),
  failedCount: z.number(),
  totalProviderPayoutsCents: z.number(),
  platformMarginCents: z.number(),
  marginPercentage: z.number()
});

export type PaymentSummary = z.infer<typeof PaymentSummarySchema>;

export type PaymentListMeta = {
  page: {
    number: number;
    size: number;
    total: number;
    totalPages: number;
  };
  next_cursor?: string | null;
};

const mapAttempt = (payload: unknown): PaymentAttempt | null => {
  const raw = toObject(payload);
  const id = coerceId(raw.id);
  if (!id) {
    return null;
  }
  return {
    id,
    status: coerceString(raw.status) ?? "unknown",
    requestPayload:
      raw.request_payload && typeof raw.request_payload === "object"
        ? (raw.request_payload as Record<string, unknown>)
        : {},
    responsePayload:
      raw.response_payload && typeof raw.response_payload === "object"
        ? (raw.response_payload as Record<string, unknown>)
        : {},
    createdAt: coerceDate(raw.created_at)
  };
};

export const mapPaymentSettlement = (payload: unknown): PaymentSettlement | null => {
  const raw = toObject(payload);
  if (Object.keys(raw).length === 0) {
    return null;
  }
  const hasSettlementAmounts = [
    raw.booking_amount_cents ?? raw.bookingAmountCents,
    raw.platform_fee_cents ?? raw.platformFeeCents,
    raw.facility_share_cents ?? raw.facilityShareCents,
    raw.provider_payout_cents ?? raw.providerPayoutCents
  ].some((value) => coerceNumber(value) !== null);
  if (!hasSettlementAmounts) {
    return null;
  }
  return {
    bookingAmountCents: coerceNumber(raw.booking_amount_cents ?? raw.bookingAmountCents) ?? 0,
    platformFeeCents: coerceNumber(raw.platform_fee_cents ?? raw.platformFeeCents) ?? 0,
    facilityShareCents: coerceNumber(raw.facility_share_cents ?? raw.facilityShareCents) ?? 0,
    providerPayoutCents: coerceNumber(raw.provider_payout_cents ?? raw.providerPayoutCents) ?? 0,
    providerCompensationMode: coerceString(raw.provider_compensation_mode ?? raw.providerCompensationMode)
  };
};

export const mapPayment = (payload: unknown): PaymentRecord | null => {
  if (!payload) return null;
  const raw = toObject(payload);
  const metadata = toObject(raw.meta_data ?? raw.metaData ?? raw.metadata);
  const settlement = mapPaymentSettlement(raw.b2b_settlement ?? raw.settlement ?? metadata.b2b_settlement);

  const normalized = {
    ...raw,
    bookingId: coerceId(raw.booking_id) || "",
    clientUserId: coerceId(raw.client_user_id),
    providerUserId: coerceId(raw.provider_user_id),
    channel: coerceString(raw.channel ?? raw.method),
    providerRef: coerceString(raw.provider_ref ?? raw.providerRef),
    amountCents: coerceNumber(raw.amount_cents) ?? 0,
    currency: coerceString(raw.currency) ?? "KES",
    description: coerceString(raw.description),
    retryCount: coerceNumber(raw.retry_count) ?? 0,
    failureReason: coerceString(raw.failure_reason),
    mpesaReceiptNumber: coerceString(raw.mpesa_receipt_number),
    merchantRequestId: coerceString(raw.merchant_request_id),
    checkoutRequestId: coerceString(raw.checkout_request_id),
    initiatedAt: coerceDate(raw.initiated_at ?? raw.created_at),
    succeededAt: coerceDate(raw.succeeded_at ?? raw.completed_at),
    failedAt: coerceDate(raw.failed_at),
    completedAt: coerceDate(raw.completed_at ?? raw.succeeded_at),
    createdAt: coerceDate(raw.created_at ?? raw.initiated_at),
    updatedAt: coerceDate(raw.updated_at ?? raw.succeeded_at ?? raw.failed_at ?? raw.initiated_at),
    refundStatus: coerceString(raw.refund_status),
    refundedAt: coerceDate(raw.refunded_at),
    attempts: (Array.isArray(raw.attempts) ? raw.attempts : [])
      .map(a => mapAttempt(a))
      .filter((attempt): attempt is PaymentAttempt => Boolean(attempt)),
    settlement,
    booking: raw.booking ? mapBooking(raw.booking) : null
  };

  const result = PaymentRecordSchema.safeParse(normalized);
  if (!result.success) {
    if (import.meta.env.DEV) {
      console.error("[Zod] Payment Schema Mismatch:", result.error);
    }
    return null;
  }
  return result.data;
};

export const mapPayments = (payload: unknown): PaymentRecord[] => {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .map((entry) => mapPayment(entry))
    .filter((entry): entry is PaymentRecord => Boolean(entry));
};

export const mapPaymentSummary = (payload: unknown): PaymentSummary => {
  const raw = toObject(payload);
  return {
    totalCollectedCents: coerceNumber(raw.total_collected_cents) ?? 0,
    pendingCents: coerceNumber(raw.pending_cents) ?? 0,
    failedCount: coerceNumber(raw.failed_count) ?? 0,
    totalProviderPayoutsCents: coerceNumber(raw.total_provider_payouts_cents) ?? 0,
    platformMarginCents: coerceNumber(raw.platform_margin_cents) ?? 0,
    marginPercentage: coerceNumber(raw.margin_percentage) ?? 0
  };
};

export const mapPaymentListMeta = (meta: unknown, fallback?: Partial<PaymentListMeta>): PaymentListMeta => {
  const raw = toObject(meta);
  const pageRaw = toObject(raw.page);
  const defaultPage = fallback?.page ?? { number: 1, size: 25, total: 0, totalPages: 1 };
  const toInt = (value: unknown, defaultValue: number): number => {
    const next = coerceNumber(value);
    return next === null ? defaultValue : Math.max(0, Math.trunc(next));
  };
  return {
    page: {
      number: toInt(pageRaw.number ?? pageRaw.page, defaultPage.number),
      size: toInt(pageRaw.size, defaultPage.size),
      total: toInt(pageRaw.total, defaultPage.total),
      totalPages: toInt(pageRaw.total_pages ?? pageRaw.totalPages, defaultPage.totalPages)
    },
    next_cursor: coerceString(raw.next_cursor)
  };
};
