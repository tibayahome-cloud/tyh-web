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
  bookingId?: string;
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
  const response = await api.get(`${ADMIN_PAYMENTS_BASE}/payments`, { params });
  const payload = (response.data ?? {}) as Record<string, unknown>;
  const payments = mapPayments(payload.data);
  const meta = mapPaymentListMeta(payload.meta, {
    page: { number: page, size: cursor ? limit : pageSize, total: payments.length, totalPages: 1 }
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
