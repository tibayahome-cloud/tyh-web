import type { ReviewItem, ReviewRow, ReviewState } from "./reviewApi";

export const STATE_TAB_LABEL: Record<ReviewState, string> = {
  waiting: "Waiting for you",
  sent_back: "Sent back",
  incomplete: "Not finished",
  complete: "Done"
};

export const STATE_CHIP_LABEL: Record<ReviewState, string> = {
  waiting: "Waiting for review",
  sent_back: "Sent back to provider",
  incomplete: "Provider has not finished",
  complete: "All approved"
};

export const STATE_EMPTY_TEXT: Record<ReviewState, { title: string; hint: string }> = {
  waiting: { title: "Nothing is waiting for you", hint: "When a provider sends documents for review, they appear here." },
  sent_back: { title: "No documents are with a provider", hint: "Documents you send back for a change appear here until the provider replaces them." },
  incomplete: { title: "Every provider has sent what is needed", hint: "Providers who have not finished their documents appear here." },
  complete: { title: "No providers are fully approved yet", hint: "Providers whose required documents are all approved appear here." }
};

/** "2 waiting for you · 1 of 3 required approved" */
export const describeRow = (row: ReviewRow): string => {
  const parts: string[] = [];
  if (row.waiting) parts.push(`${row.waiting} ${row.waiting === 1 ? "document" : "documents"} waiting`);
  if (row.sent_back) parts.push(`${row.sent_back} sent back`);
  if (row.missing_required) parts.push(`${row.missing_required} required not added`);
  if (row.required_total) {
    const approvedRequired = Math.max(0, row.required_total - row.missing_required - row.waiting - row.sent_back);
    parts.push(`${approvedRequired} of ${row.required_total} required approved`);
  }
  return parts.join(" · ") || "No documents yet";
};

/** What a due date means to a reviewer, only while documents are still owed. */
export const describeDue = (row: ReviewRow): string | null => {
  if (row.documents_days_left === null || row.documents_days_left === undefined) return null;
  if (row.documents_days_left < 0) return "Documents overdue";
  if (row.documents_days_left === 0) return "Documents due today";
  return `${row.documents_days_left} ${row.documents_days_left === 1 ? "day" : "days"} left`;
};

export type ItemView = {
  label: "Waiting for your review" | "Approved" | "Sent back" | "Not added" | "Not sent yet";
  tone: "amber" | "green" | "rose" | "slate";
  /** The reviewer can act on it: it is provided, the provider has sent the application, and it is not decided yet. */
  canDecide: boolean;
};

/** One document as the reviewer reads it. Pending documents are only the reviewer's once the provider has sent them. */
export const describeItem = (item: ReviewItem, applicationStatus: string): ItemView => {
  const sent = applicationStatus === "submitted" || applicationStatus === "approved";
  if (item.status === "verified") return { label: "Approved", tone: "green", canDecide: false };
  if (item.status === "rejected") return { label: "Sent back", tone: "rose", canDecide: false };
  if (item.status === "pending") {
    return sent
      ? { label: "Waiting for your review", tone: "amber", canDecide: true }
      : { label: "Not sent yet", tone: "slate", canDecide: false };
  }
  return { label: "Not added", tone: "slate", canDecide: false };
};

export const requiredProgress = (items: ReviewItem[]): { approved: number; total: number } => {
  const required = items.filter((item) => item.requirement_type?.required_for_verification);
  return { approved: required.filter((item) => item.status === "verified").length, total: required.length };
};

const byOrder = (a: ReviewItem, b: ReviewItem) =>
  (a.requirement_type?.display_order ?? 0) - (b.requirement_type?.display_order ?? 0);

/** Required documents first, then the rest, each in checklist order. */
export const splitItems = (items: ReviewItem[]): { required: ReviewItem[]; other: ReviewItem[] } => ({
  required: items.filter((item) => item.requirement_type?.required_for_verification).sort(byOrder),
  other: items.filter((item) => !item.requirement_type?.required_for_verification).sort(byOrder)
});
