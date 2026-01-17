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

export const PaymentRecordSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  clientUserId: z.string().nullable(),
  providerUserId: z.string().nullable(),
  status: z.string(),
  channel: z.string().nullable(),
  amountCents: z.number(),
  currency: z.string(),
  description: z.string().nullable(),
  retryCount: z.number(),
  failureReason: z.string().nullable(),
  mpesaReceiptNumber: z.string().nullable(),
  merchantRequestId: z.string().nullable(),
  checkoutRequestId: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  refundStatus: z.string().nullable(),
  refundedAt: z.string().nullable(),
  attempts: z.array(PaymentAttemptSchema),
  booking: BookingSchema.nullable().optional()
});

export type PaymentRecord = z.infer<typeof PaymentRecordSchema>;

export const PaymentSummarySchema = z.object({
  totalCollectedCents: z.number(),
  pendingCents: z.number(),
  failedCount: z.number()
});

export type PaymentSummary = z.infer<typeof PaymentSummarySchema>;

export type PaymentListMeta = {
  page: {
    number: number;
    size: number;
    total: number;
    totalPages: number;
  };
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

export const mapPayment = (payload: unknown): PaymentRecord | null => {
  if (!payload) return null;
  const raw = toObject(payload);

  const normalized = {
    ...raw,
    bookingId: coerceId(raw.booking_id) || "",
    clientUserId: coerceId(raw.client_user_id),
    providerUserId: coerceId(raw.provider_user_id),
    amountCents: coerceNumber(raw.amount_cents) ?? 0,
    retryCount: coerceNumber(raw.retry_count) ?? 0,
    mpesaReceiptNumber: coerceString(raw.mpesa_receipt_number),
    merchantRequestId: coerceString(raw.merchant_request_id),
    checkoutRequestId: coerceString(raw.checkout_request_id),
    completedAt: coerceDate(raw.completed_at),
    createdAt: coerceDate(raw.created_at),
    updatedAt: coerceDate(raw.updated_at),
    refundStatus: coerceString(raw.refund_status),
    refundedAt: coerceDate(raw.refunded_at),
    attempts: (Array.isArray(raw.attempts) ? raw.attempts : [])
      .map(a => mapAttempt(a))
      .filter(Boolean),
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
    failedCount: coerceNumber(raw.failed_count) ?? 0
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
      number: toInt(pageRaw.number, defaultPage.number),
      size: toInt(pageRaw.size, defaultPage.size),
      total: toInt(pageRaw.total, defaultPage.total),
      totalPages: toInt(pageRaw.total_pages ?? pageRaw.totalPages, defaultPage.totalPages)
    }
  };
};
