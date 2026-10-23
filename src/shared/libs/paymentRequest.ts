import { api } from "./api";

export type PaymentRequestStatus = "none" | "sending" | "waiting" | "failed" | "paid" | "exhausted";

export type PaymentRequest = {
  state: PaymentRequestStatus;
  amountCents: number;
  currency: string;
  maxPrompts: number;
  promptsSent: number;
  /** The number the request went to, already masked by the server. Never a full number. */
  payerPhoneMasked: string | null;
  sentAt: string | null;
  /** When a failed or unanswered request may be sent again. */
  canResendAt: string | null;
};

const STATES: PaymentRequestStatus[] = ["none", "sending", "waiting", "failed", "paid", "exhausted"];

const mapPaymentRequest = (raw: Record<string, unknown>): PaymentRequest => ({
  state: STATES.includes(raw.state as PaymentRequestStatus) ? (raw.state as PaymentRequestStatus) : "none",
  amountCents: typeof raw.amount_cents === "number" ? raw.amount_cents : 0,
  currency: typeof raw.currency === "string" ? raw.currency : "KES",
  maxPrompts: typeof raw.max_prompts === "number" ? raw.max_prompts : 3,
  promptsSent: typeof raw.prompts_sent === "number" ? raw.prompts_sent : 0,
  payerPhoneMasked: typeof raw.payer_phone_masked === "string" ? raw.payer_phone_masked : null,
  sentAt: typeof raw.sent_at === "string" ? raw.sent_at : null,
  canResendAt: typeof raw.can_resend_at === "string" ? raw.can_resend_at : null
});

export const fetchPaymentRequest = async (bookingId: string): Promise<PaymentRequest> => {
  const response = await api.get(`/bookings/${bookingId}/payment-request`);
  return mapPaymentRequest((response.data?.data ?? {}) as Record<string, unknown>);
};

/** Asks the client to pay. The amount is the booking's own; only the number can be chosen. */
export const sendPaymentRequest = async (bookingId: string, payerPhone?: string): Promise<PaymentRequest> => {
  const response = await api.post(`/bookings/${bookingId}/payment-request`, payerPhone ? { payer_phone: payerPhone } : {});
  return mapPaymentRequest((response.data?.data ?? {}) as Record<string, unknown>);
};
