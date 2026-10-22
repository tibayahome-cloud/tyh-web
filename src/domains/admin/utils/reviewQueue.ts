import type { ReviewCategory, ReviewItem } from "../../../shared/libs/telemedicineOps";

export const CATEGORY_LABEL: Record<ReviewCategory, string> = {
  payment_review: "Payment held",
  cancellation_payment_review: "Cancelled after paying",
  no_show: "Nobody attended",
  technical_issue: "Technical problem",
  reschedule_escalation: "Reschedule waiting for an answer",
  provider_earnings_complaint: "Client complaint about a visit"
};

export const CATEGORY_TONE: Record<ReviewCategory, string> = {
  payment_review: "bg-amber-100 text-amber-900",
  cancellation_payment_review: "bg-amber-100 text-amber-900",
  no_show: "bg-rose-100 text-rose-900",
  technical_issue: "bg-slate-200 text-slate-900",
  reschedule_escalation: "bg-sky-100 text-sky-900",
  provider_earnings_complaint: "bg-rose-100 text-rose-900"
};

export const CATEGORIES = Object.keys(CATEGORY_LABEL) as ReviewCategory[];

/**
 * Items answered somewhere else, and where. A pending reschedule appears here so an operator can see it is waiting, but
 * closing it from this list would leave the appointment unchanged and the client still waiting.
 */
export const ANSWERED_ELSEWHERE: Partial<Record<ReviewCategory, string>> = {
  reschedule_escalation: "Open the booking to see the proposal. The client or provider has to accept or decline it."
};

const HOUR = 3_600_000;

/** How long an item has been open, in words, and whether it has been open longer than a day. */
export const ageOf = (openedAt: string | null, now: number): { label: string; overdue: boolean } => {
  if (!openedAt) return { label: "Open", overdue: false };
  const hours = Math.max(0, Math.floor((now - new Date(openedAt).getTime()) / HOUR));
  if (hours < 1) return { label: "Open for less than an hour", overdue: false };
  if (hours < 24) return { label: `Open for ${hours} hour${hours === 1 ? "" : "s"}`, overdue: false };
  const days = Math.floor(hours / 24);
  return { label: `Open for ${days} day${days === 1 ? "" : "s"}`, overdue: true };
};

/** Oldest first, so the item that has waited longest is at the top. */
export const oldestFirst = (items: ReviewItem[]): ReviewItem[] =>
  [...items].sort((a, b) => new Date(a.openedAt ?? 0).getTime() - new Date(b.openedAt ?? 0).getTime());

export const countByCategory = (items: ReviewItem[]): Record<ReviewCategory, number> => {
  const counts = Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<ReviewCategory, number>;
  items.forEach((item) => {
    if (item.category in counts) counts[item.category] += 1;
  });
  return counts;
};

export const formatMoney = (cents: number, currency: string | null) =>
  `${currency ?? "KES"} ${Math.round(cents / 100).toLocaleString("en-US")}`;

/** What choosing this outcome does, in words, with the amount when it moves money. */
export const outcomeEffect = (item: ReviewItem, outcomeKey: string): string => {
  const outcome = item.outcomes.find((entry) => entry.key === outcomeKey);
  if (!outcome) return "";
  if (outcomeKey === "refund_full" && item.refundableAmountCents != null) {
    return `Sends ${formatMoney(item.refundableAmountCents, item.refundableCurrency)} back to the client.`;
  }
  return outcome.effect;
};
