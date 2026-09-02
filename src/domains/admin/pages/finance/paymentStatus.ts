/**
 * How a payment's state is described to an operator.
 *
 * Two rules run through this. Every state says what is true right now rather than what is
 * hoped for, and nothing here implies money has moved unless the backend says it has --
 * "refund pending" is a decision, "refunded" is a fact, and only one of them means the client
 * has their money.
 */

export type PaymentStatusValue =
  | "pending"
  | "awaiting_callback"
  | "succeeded"
  | "failed"
  | "refunded"
  | "cancelled";

export const STATUS_LABEL: Record<PaymentStatusValue, string> = {
  pending: "Not yet sent",
  // Split from "pending" in the backend because the two need different handling: this one has
  // an STK prompt outstanding with the payer and may still succeed on its own.
  awaiting_callback: "Prompt sent, awaiting M-Pesa",
  succeeded: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  cancelled: "Cancelled"
};

export const STATUS_TONE: Record<PaymentStatusValue, string> = {
  pending: "bg-slate-200 text-slate-700",
  awaiting_callback: "bg-amber-100 text-amber-700",
  succeeded: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
  refunded: "bg-indigo-100 text-indigo-700",
  cancelled: "bg-slate-200 text-slate-600"
};

/** What an operator should do next, if anything. Absent when the payment needs nothing. */
export const NEXT_ACTION: Partial<Record<PaymentStatusValue, string>> = {
  awaiting_callback: "Wait, or retry if no callback arrives",
  failed: "The slot was released; the client can rebook"
};

/**
 * A payment held for an operator decision.
 *
 * Deliberately separate from status. The payment succeeded -- money arrived -- and saying so
 * while also flagging the review is the honest description. Folding review into the status
 * column would erase the fact that the client paid.
 */
export const REVIEW_BADGE = {
  label: "Needs review",
  tone: "bg-amber-100 text-amber-800"
};

/**
 * Settlement is only ever reported from what the backend recorded.
 *
 * An absent settlement means no payout has been written, never that one is assumed to have
 * happened. Showing a provider as paid when nothing was disbursed is the single most damaging
 * thing this table could get wrong.
 */
export const describeSettlement = (recorded: boolean, payoutCents: number | null) => {
  if (!recorded) return { label: "Not settled", tone: "bg-slate-100 text-slate-500" };
  if (!payoutCents) return { label: "Settled, no payout", tone: "bg-slate-100 text-slate-600" };
  return { label: "Settled", tone: "bg-emerald-50 text-emerald-700" };
};

/**
 * Refund state, kept distinct from a decision to refund.
 *
 * An operator approving a refund does not move money; the gateway does. Until the backend
 * reports it, this says pending rather than refunded.
 */
export const describeRefund = (status: string | null) => {
  if (!status) return null;
  if (status === "succeeded") return { label: "Refunded", tone: "bg-indigo-100 text-indigo-700" };
  if (status === "failed") return { label: "Refund failed", tone: "bg-rose-100 text-rose-700" };
  return { label: "Refund pending", tone: "bg-amber-100 text-amber-700" };
};
