import api from "./api";
import { buildFieldParams, paymentAdminList, paymentDetailPreset } from "./fieldInclude";
import type {
  PaymentListMeta,
  PaymentRecord,
  PaymentSummary
} from "../schemas/payment";
import { mapPayment, mapPaymentListMeta, mapPayments, mapPaymentSummary } from "../schemas/payment";

const ADMIN_PAYMENTS_BASE = "/admin/payments";

const paymentPresetMap = {
  card: paymentAdminList,
  detail: paymentDetailPreset
} as const;

export type PaymentPresetName = keyof typeof paymentPresetMap;

export type PaymentListParams = {
  page?: number;
  pageSize?: number;
  cursor?: string | null;
  limit?: number;
  status?: string;
  method?: string;
  bookingId?: string;
  dateFrom?: string;
  dateTo?: string;
  preset?: PaymentPresetName;
};

export type PaymentListResult = {
  payments: PaymentRecord[];
  meta: PaymentListMeta;
  raw?: Record<string, unknown>;
};

export const fetchPaymentSummary = async (): Promise<PaymentSummary> => {
  const response = await api.get("/payments/summary");
  return mapPaymentSummary(response.data?.data);
};

export const fetchAdminPayments = async ({
  page = 1,
  pageSize = 25,
  cursor,
  limit = 25,
  status,
  method,
  dateFrom,
  dateTo,
  bookingId,
  preset = "card"
}: PaymentListParams = {}): Promise<PaymentListResult> => {
  const presetConfig = paymentPresetMap[preset] ?? paymentPresetMap.card;
  const params: Record<string, unknown> = {
    // Legacy support for page/size if cursor is not present, though backend will likely enforce one style
    "page[number]": page,
    "page[size]": cursor ? limit : pageSize,
    ...buildFieldParams(presetConfig)
  };
  if (cursor) {
    params.cursor = cursor;
  }
  if (status) {
    params["filter[status]"] = status;
  }
  if (bookingId) {
    params["filter[booking_id]"] = bookingId;
  }
  if (method) {
    params["filter[method]"] = method;
  }
  if (dateFrom) {
    params["filter[date_from]"] = dateFrom;
  }
  if (dateTo) {
    params["filter[date_to]"] = dateTo;
  }
  const response = await api.get(`${ADMIN_PAYMENTS_BASE}/payments`, { params });
  const payload = (response.data ?? {}) as Record<string, unknown>;
  const payments = mapPayments(payload.data);
  const meta = mapPaymentListMeta(payload.meta, {
    page: { number: page, size: cursor ? limit : pageSize, total: payments.length, totalPages: 1 }
  });
  return { payments, meta, raw: payload };
};

export const fetchFacilityPayments = async (
  facilityId: string,
  { page = 1, pageSize = 25, status }: { page?: number; pageSize?: number; status?: string } = {}
): Promise<PaymentListResult> => {
  const params: Record<string, unknown> = {
    "page[number]": page,
    "page[size]": pageSize
  };
  if (status) {
    params["filter[status]"] = status;
  }
  const response = await api.get(`/admin/payments/facilities/${facilityId}/payments`, { params });
  const payload = (response.data ?? {}) as Record<string, unknown>;
  const payments = mapPayments(payload.data);
  const meta = mapPaymentListMeta(payload.meta, {
    page: { number: page, size: pageSize, total: payments.length, totalPages: 1 }
  });
  return { payments, meta, raw: payload };
};

export const fetchAdminPayment = async (
  paymentId: string,
  preset: PaymentPresetName = "detail"
): Promise<PaymentRecord> => {
  const presetConfig = paymentPresetMap[preset] ?? paymentPresetMap.detail;
  const response = await api.get(`${ADMIN_PAYMENTS_BASE}/payments/${paymentId}`, {
    params: buildFieldParams(presetConfig)
  });
  const payment = mapPayment(response.data?.data);
  if (!payment) {
    throw new Error("Payment not found");
  }
  return payment;
};

export const retryPayment = async (paymentId: string) => {
  await api.post(`${ADMIN_PAYMENTS_BASE}/payments/${paymentId}/retry`);
};

export type UnmatchedC2BTransaction = {
  id: string;
  transId: string | null;
  transTime: string | null;
  amountCents: number;
  billRefNumber: string | null;
  msisdn: string | null;
  payerName: string | null;
  status: string;
  matchFailureReason: string | null;
  createdAt: string | null;
};

const mapUnmatchedC2BTransaction = (raw: Record<string, unknown>): UnmatchedC2BTransaction => {
  const name = [raw.first_name, raw.middle_name, raw.last_name]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ");
  return {
    id: String(raw.id ?? ""),
    transId: (raw.trans_id as string) ?? null,
    transTime: (raw.trans_time as string) ?? null,
    amountCents: typeof raw.amount_cents === "number" ? raw.amount_cents : 0,
    billRefNumber: (raw.bill_ref_number as string) ?? null,
    msisdn: (raw.msisdn as string) ?? null,
    payerName: name || null,
    status: (raw.status as string) ?? "unmatched",
    matchFailureReason: (raw.match_failure_reason as string) ?? null,
    createdAt: (raw.created_at as string) ?? null
  };
};

export const fetchUnmatchedC2BTransactions = async (pageSize = 25): Promise<UnmatchedC2BTransaction[]> => {
  const response = await api.get(`${ADMIN_PAYMENTS_BASE}/c2b/unmatched`, {
    params: { "page[size]": pageSize }
  });
  const data = Array.isArray(response.data?.data) ? response.data.data : [];
  return data.map((entry: Record<string, unknown>) => mapUnmatchedC2BTransaction(entry));
};

export const reconcileC2BTransaction = async (transactionId: string, bookingId: string, reason: string) => {
  const response = await api.post(`${ADMIN_PAYMENTS_BASE}/c2b/${transactionId}/reconcile`, {
    booking_id: bookingId,
    reason
  });
  return response.data?.data as { payment_id: string; status: string };
};

export const reassignPaymentBooking = async (paymentId: string, bookingId: string, reason: string) => {
  const response = await api.post(`${ADMIN_PAYMENTS_BASE}/payments/${paymentId}/reassign-booking`, {
    booking_id: bookingId,
    reason
  });
  return response.data?.data as { payment_id: string; booking_id: string };
};
