import { api } from "../../../../shared/libs/api";
import type { ReviewState } from "./reviewApi";
import { PAGE_SIZE } from "./reviewApi";

export type FacilityDocumentStatus = "missing" | "uploaded" | "submitted" | "verified" | "rejected" | "not_applicable";

export type FacilityDocument = {
  id: string;
  status: FacilityDocumentStatus;
  expires_on: string | null;
  comment: string | null;
  has_file: boolean;
  download_url: string | null;
  filename: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  /** The signed-in person may add or replace this document (a facility admin cannot touch the papers Tiba Ya Home adds). */
  can_upload: boolean;
  requirement: {
    id: string;
    key: string;
    label: string;
    description: string | null;
    required: boolean;
    only_if_offered: boolean;
    has_expiry: boolean;
    super_admin_uploads: boolean;
    display_order: number;
  };
};

export type FacilitySummary = {
  state: ReviewState;
  required_total: number;
  required_approved: number;
  waiting: number;
  sent_back: number;
  added_not_sent: number;
  missing_required: number;
  in_order: boolean;
  documents_due_on: string | null;
  documents_days_left: number | null;
};

export type FacilityDocumentsPayload = {
  facility: { id: string; name: string };
  documents: FacilityDocument[];
  summary: FacilitySummary;
};

export const facilityDocumentsKey = (facilityId: string) => ["admin", "facility-documents", "detail", facilityId] as const;
export const facilityQueueKey = (params: { state: ReviewState; search: string; page: number }) =>
  ["admin", "facility-documents", "queue", params] as const;

export const fetchFacilityDocuments = async (facilityId: string): Promise<FacilityDocumentsPayload> => {
  const response = await api.get<{ data: FacilityDocumentsPayload }>(`/facilities/${facilityId}/documents`);
  return response.data.data;
};

export const uploadFacilityDocument = async (facilityId: string, documentId: string, file: File, expiresOn?: string) => {
  const form = new FormData();
  form.append("file", file);
  if (expiresOn) form.append("expires_on", expiresOn);
  await api.post(`/facilities/${facilityId}/documents/${documentId}/upload`, form, {
    headers: { "Content-Type": "multipart/form-data" }
  });
};

export const removeFacilityDocument = async (facilityId: string, documentId: string) => {
  await api.delete(`/facilities/${facilityId}/documents/${documentId}/document`);
};

export const sendFacilityDocuments = async (facilityId: string): Promise<number> => {
  const response = await api.post<{ data: { sent: number } }>(`/facilities/${facilityId}/documents/send`, {});
  return response.data.data?.sent ?? 0;
};

export const setFacilityDocumentApplicable = async (facilityId: string, documentId: string, applicable: boolean) => {
  await api.post(`/facilities/${facilityId}/documents/${documentId}/applicability`, { applicable });
};

export type FacilityReviewDecision = { decision: "approved" } | { decision: "sent_back"; note: string };

export const reviewFacilityDocument = async (documentId: string, decision: FacilityReviewDecision) => {
  const response = await api.post<{ data: { summary: FacilitySummary } }>(
    `/facility-documents/${documentId}/review`,
    decision.decision === "sent_back" ? { decision: "sent_back", note: decision.note } : { decision: "approved" }
  );
  return response.data.data;
};

export type FacilityQueueRow = FacilitySummary & {
  facility_id: string;
  facility_name: string;
  facility_status: string;
  oldest_submitted_at: string | null;
};

export type FacilityQueue = {
  rows: FacilityQueueRow[];
  counts: Record<ReviewState, number>;
  page: { number: number; size: number; total: number; total_pages: number };
};

const EMPTY_COUNTS: Record<ReviewState, number> = { waiting: 0, sent_back: 0, incomplete: 0, complete: 0 };

export const fetchFacilityQueue = async (params: { state: ReviewState; search: string; page: number }): Promise<FacilityQueue> => {
  const response = await api.get<{
    data: FacilityQueueRow[];
    meta?: { counts?: Partial<Record<ReviewState, number>>; page?: FacilityQueue["page"] };
  }>("/facility-documents/review", {
    params: {
      "filter[state]": params.state,
      ...(params.search.trim() ? { "filter[search]": params.search.trim() } : {}),
      "page[number]": params.page,
      "page[size]": PAGE_SIZE
    }
  });
  const meta = response.data.meta ?? {};
  return {
    rows: response.data.data ?? [],
    counts: { ...EMPTY_COUNTS, ...(meta.counts ?? {}) },
    page: meta.page ?? { number: params.page, size: PAGE_SIZE, total: response.data.data?.length ?? 0, total_pages: 1 }
  };
};
