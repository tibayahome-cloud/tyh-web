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
};

const STATUSES: OnboardingStatus[] = ["not_started", "documents_needed", "in_review", "needs_changes", "verified", "set_up_by_facility"];

/** Reads the server's onboarding status. An unknown value is treated as not started rather than guessed at. */
export const mapOnboardingSummary = (raw: Record<string, unknown>): OnboardingSummary => ({
  status: STATUSES.includes(raw.status as OnboardingStatus) ? (raw.status as OnboardingStatus) : "not_started",
  itemsDone: typeof raw.items_done === "number" ? raw.items_done : 0,
  itemsTotal: typeof raw.items_total === "number" ? raw.items_total : 0,
  items: Array.isArray(raw.items) ? (raw.items as OnboardingItem[]) : [],
  nextItem: (raw.next_item as OnboardingItem | null) ?? null,
  reviewerNote: typeof raw.reviewer_note === "string" ? raw.reviewer_note : null,
  readyToSubmit: raw.ready_to_submit === true,
  verifiedAt: typeof raw.verified_at === "string" ? raw.verified_at : null
});

export type StatusTone = "neutral" | "info" | "warning" | "success";

export type StatusCopy = {
  title: string;
  message: string;
  tone: StatusTone;
};

/** What to tell the provider, in plain words, for each status. */
export const describeOnboarding = (summary: OnboardingSummary): StatusCopy => {
  const { status, itemsDone, itemsTotal, nextItem, reviewerNote } = summary;
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
            title: `Documents needed (${itemsDone} of ${itemsTotal})`,
            message: nextItem ? `Next: ${nextItem.label}.` : "Upload the documents below.",
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
