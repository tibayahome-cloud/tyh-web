import { api } from "../../../../shared/libs/api";
import { buildFieldParams, providerApplicationReview } from "../../../../shared/libs/fieldInclude";

/** Whose turn it is for a provider's documents. waiting is the reviewer's; the others are the provider's. */
export type ReviewState = "waiting" | "sent_back" | "incomplete" | "complete";

export const REVIEW_STATES: ReviewState[] = ["waiting", "sent_back", "incomplete", "complete"];

export type ReviewRow = {
  application_id: string;
  provider_user_id: string;
  provider_name: string | null;
  facility_id: string | null;
  facility_name: string | null;
  provider_verified: boolean;
  application_status: string;
  state: ReviewState;
  waiting: number;
  sent_back: number;
  missing_required: number;
  approved: number;
  required_total: number;
  submitted_at: string | null;
  documents_due_on: string | null;
  documents_days_left: number | null;
};

export type ReviewQueue = {
  rows: ReviewRow[];
  counts: Record<ReviewState, number>;
  page: { number: number; size: number; total: number; total_pages: number };
};

export type QueueParams = { state: ReviewState; search: string; page: number };

export const PAGE_SIZE = 20;

export const reviewQueueKey = (params: QueueParams) => ["admin", "document-review", "queue", params] as const;
export const reviewDetailKey = (applicationId: string) => ["admin", "document-review", "detail", applicationId] as const;

const EMPTY_COUNTS: Record<ReviewState, number> = { waiting: 0, sent_back: 0, incomplete: 0, complete: 0 };

export const fetchReviewQueue = async ({ state, search, page }: QueueParams): Promise<ReviewQueue> => {
  const response = await api.get<{
    data: ReviewRow[];
    meta?: { counts?: Partial<Record<ReviewState, number>>; page?: ReviewQueue["page"] };
  }>("/provider-documents/review", {
    params: {
      "filter[state]": state,
      ...(search.trim() ? { "filter[search]": search.trim() } : {}),
      "page[number]": page,
      "page[size]": PAGE_SIZE
    }
  });
  const meta = response.data.meta ?? {};
  return {
    rows: response.data.data ?? [],
    counts: { ...EMPTY_COUNTS, ...(meta.counts ?? {}) },
    page: meta.page ?? { number: page, size: PAGE_SIZE, total: response.data.data?.length ?? 0, total_pages: 1 }
  };
};

export type ReviewItem = {
  id: string;
  status: string;
  value_text?: string | null;
  file_url?: string | null;
  download_url?: string | null;
  comment?: string | null;
  expires_on?: string | null;
  requirement_type?: {
    id: string;
    key?: string;
    label: string;
    input_type: "file" | "image" | "text";
    display_order?: number | null;
    required_for_verification?: boolean;
    has_expiry?: boolean;
  };
};

export type ReviewApplication = {
  id: string;
  status: string;
  user_id?: string;
  submitted_at?: string | null;
  user?: { id: string; full_name?: string | null; email?: string | null };
  items?: ReviewItem[];
};

export const fetchApplicationForReview = async (applicationId: string): Promise<ReviewApplication> => {
  const response = await api.get<{ data: ReviewApplication }>(`/provider-applications/${applicationId}`, {
    params: buildFieldParams(providerApplicationReview)
  });
  return response.data.data;
};

export type ReviewDecision = { decision: "approved" } | { decision: "sent_back"; note: string };

export type ReviewResult = { application_status?: string; provider_verified?: boolean };

export const reviewItem = async (applicationId: string, itemId: string, decision: ReviewDecision): Promise<ReviewResult> => {
  const response = await api.post<{ data: ReviewResult }>(
    `/provider-applications/${applicationId}/items/${itemId}/review`,
    decision.decision === "sent_back" ? { decision: "sent_back", note: decision.note } : { decision: "approved" }
  );
  return response.data.data ?? {};
};
