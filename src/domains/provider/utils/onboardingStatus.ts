export type OnboardingStatus =
  | "not_started"
  | "documents_needed"
  | "in_review"
  | "needs_changes"
  | "verified"
  | "set_up_by_facility";

export type OnboardingItem = {
  requirement_key: string | null;
  label: string;
  input_type: string;
  status: string;
  reviewer_note: string | null;
  required?: boolean;
  has_expiry?: boolean;
  expires_on?: string | null;
};

export type OnboardingSummary = {
  status: OnboardingStatus;
  itemsDone: number;
  itemsTotal: number;
  items: OnboardingItem[];
  nextItem: OnboardingItem | null;
  reviewerNote: string | null;
  readyToSubmit: boolean;
  verifiedAt: string | null;
  /** How many documents are required, and how many of those are provided. Falls back to all items if none are marked. */
  requiredTotal: number;
  requiredDone: number;
  /** Set for providers who were working before documents became mandatory: the day their required ones are due. */
  documentsDueOn: string | null;
  documentsDaysLeft: number | null;
  documentsInOrder: boolean;
  /** Already verified, so they keep taking bookings while documents are checked. */
  providerVerified: boolean;
};

// An item the provider has supplied, whether or not a reviewer has looked at it yet.
const PROVIDED = new Set(["pending", "submitted", "verified"]);

const STATUSES: OnboardingStatus[] = ["not_started", "documents_needed", "in_review", "needs_changes", "verified", "set_up_by_facility"];

/** Reads the server's onboarding status. An unknown value is treated as not started rather than guessed at. */
export const mapOnboardingSummary = (raw: Record<string, unknown>): OnboardingSummary => {
  const items = Array.isArray(raw.items) ? (raw.items as OnboardingItem[]) : [];
  const required = items.filter((item) => item.required);
  const counted = required.length > 0 ? required : items;
  const requiredTotal =
    typeof raw.required_total === "number" && raw.required_total > 0
      ? raw.required_total
      : items.length > 0
        ? counted.length
        : typeof raw.items_total === "number"
          ? raw.items_total
          : 0;
  return {
    status: STATUSES.includes(raw.status as OnboardingStatus) ? (raw.status as OnboardingStatus) : "not_started",
    itemsDone: typeof raw.items_done === "number" ? raw.items_done : 0,
    itemsTotal: typeof raw.items_total === "number" ? raw.items_total : 0,
    items,
    nextItem: (raw.next_item as OnboardingItem | null) ?? null,
    reviewerNote: typeof raw.reviewer_note === "string" ? raw.reviewer_note : null,
    readyToSubmit: raw.ready_to_submit === true,
    verifiedAt: typeof raw.verified_at === "string" ? raw.verified_at : null,
    requiredTotal,
    requiredDone: Math.min(
      requiredTotal,
      items.length > 0 ? counted.filter((item) => PROVIDED.has(item.status)).length : typeof raw.items_done === "number" ? raw.items_done : 0
    ),
    documentsDueOn: typeof raw.documents_due_on === "string" ? raw.documents_due_on : null,
    documentsDaysLeft: typeof raw.documents_days_left === "number" ? raw.documents_days_left : null,
    // An older server sends nothing here; that means nothing is owed.
    documentsInOrder: raw.documents_in_order !== false,
    providerVerified: raw.provider_verified === true || raw.status === "verified" || raw.status === "set_up_by_facility"
  };
};

/** "in 12 days", "tomorrow", "today", or "was due 3 days ago". */
export const describeDaysLeft = (days: number): string => {
  if (days < 0) return `was due ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
};

export type StatusTone = "neutral" | "info" | "warning" | "success";

export type StatusCopy = {
  title: string;
  message: string;
  tone: StatusTone;
};

/** What to tell the provider, in plain words, for each status. */
export const describeOnboarding = (summary: OnboardingSummary): StatusCopy => {
  const { status, requiredDone, requiredTotal, nextItem, reviewerNote } = summary;
  // A provider already working who still owes documents is told so first, ahead of "you are verified".
  if ((status === "verified" || status === "set_up_by_facility") && !summary.documentsInOrder && summary.documentsDaysLeft !== null && summary.documentsDaysLeft >= 0) {
    return {
      title: "Add your documents to keep taking bookings",
      message: `Upload the required documents ${describeDaysLeft(summary.documentsDaysLeft)}${
        nextItem ? `. Next: ${nextItem.label}` : ""
      }. You can keep working until then.`,
      tone: "warning"
    };
  }
  switch (status) {
    case "not_started":
      return {
        title: "Not started",
        message: "Upload the documents we need to check, so clients can book you.",
        tone: "neutral"
      };
    case "documents_needed":
      return summary.readyToSubmit
        ? { title: "Ready to send", message: "Everything is uploaded. Send it for review.", tone: "info" }
        : {
            title: `Documents needed (${requiredDone} of ${requiredTotal})`,
            message: `${nextItem ? `Next: ${nextItem.label}.` : "Upload the documents below."}${
              summary.documentsDaysLeft !== null && summary.documentsDaysLeft >= 0
                ? ` Due ${describeDaysLeft(summary.documentsDaysLeft)}; you can keep working until then.`
                : ""
            }`,
            tone: "warning"
          };
    case "in_review":
      return { title: "In review", message: "We are checking your documents. We will tell you when it is done.", tone: "info" };
    case "needs_changes":
      return {
        title: "Needs changes",
        message: reviewerNote ?? (nextItem ? `Please replace: ${nextItem.label}.` : "A reviewer sent something back."),
        tone: "warning"
      };
    case "verified":
      return { title: "You are verified", message: "Set your hours so clients can start booking you.", tone: "success" };
    case "set_up_by_facility":
      return { title: "Your facility set you up", message: "You are verified. There is nothing to upload.", tone: "success" };
  }
};

const ITEM_LABELS: Record<string, string> = {
  missing: "Needed",
  pending: "Sent, waiting for review",
  submitted: "Sent, waiting for review",
  verified: "Approved",
  rejected: "Sent back"
};

export const itemStatusLabel = (status: string): string => ITEM_LABELS[status] ?? "In progress";
