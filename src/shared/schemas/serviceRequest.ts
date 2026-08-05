import { z } from "zod";

import { coerceDate, coerceId, coerceString, toObject } from "./helpers";

export const SERVICE_REQUEST_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];

export const ServiceRequestSchema = z.object({
  id: z.string(),
  facilityId: z.string(),
  facilityName: z.string().nullable(),
  requestedByUserId: z.string().nullable(),
  requestedByName: z.string().nullable(),
  proposedName: z.string(),
  proposedCategoryId: z.string().nullable(),
  proposedCategoryName: z.string().nullable(),
  rationale: z.string(),
  status: z.enum(SERVICE_REQUEST_STATUSES),
  reviewerUserId: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  decisionNote: z.string().nullable(),
  resultingServiceId: z.string().nullable(),
  resultingFacilityServiceId: z.string().nullable(),
  createdAt: z.string().nullable()
});

export type ServiceRequest = z.infer<typeof ServiceRequestSchema>;

const isServiceRequestStatus = (value: string | null): value is ServiceRequestStatus =>
  Boolean(value && SERVICE_REQUEST_STATUSES.includes(value as ServiceRequestStatus));

const toResourceRecord = (payload: unknown): Record<string, unknown> => {
  const base = toObject(payload);
  const attributes = toObject(base.attributes);
  return { ...base, ...attributes };
};

export const mapServiceRequest = (payload: unknown): ServiceRequest | null => {
  const raw = toResourceRecord(payload);
  const id = coerceId(raw.id);
  const facilityId = coerceId(raw.facility_id ?? raw.facilityId ?? toObject(raw.facility).id);
  const status = coerceString(raw.status);
  const proposedName = coerceString(raw.proposed_name ?? raw.proposedName);
  if (!id || !facilityId || !isServiceRequestStatus(status) || !proposedName) {
    return null;
  }
  const facility = toObject(raw.facility);
  const requestedBy = toObject(raw.requested_by ?? raw.requestedBy);
  const category = toObject(raw.proposed_category ?? raw.proposedCategory);
  return {
    id,
    facilityId,
    facilityName: coerceString(facility.name),
    requestedByUserId: coerceString(raw.requested_by_user_id ?? raw.requestedByUserId),
    requestedByName: coerceString(requestedBy.full_name ?? requestedBy.fullName ?? requestedBy.email),
    proposedName,
    proposedCategoryId: coerceString(raw.proposed_category_id ?? raw.proposedCategoryId ?? category.id),
    proposedCategoryName: coerceString(raw.proposed_category_name ?? raw.proposedCategoryName ?? category.name),
    rationale: coerceString(raw.rationale) ?? "",
    status,
    reviewerUserId: coerceString(raw.reviewer_user_id ?? raw.reviewerUserId),
    reviewedAt: coerceDate(raw.reviewed_at ?? raw.reviewedAt),
    decisionNote: coerceString(raw.decision_note ?? raw.decisionNote),
    resultingServiceId: coerceString(raw.resulting_service_id ?? raw.resultingServiceId),
    resultingFacilityServiceId: coerceString(
      raw.resulting_facility_service_id ?? raw.resultingFacilityServiceId
    ),
    createdAt: coerceDate(raw.created_at ?? raw.createdAt)
  };
};

export const mapServiceRequests = (payload: unknown): ServiceRequest[] =>
  Array.isArray(payload)
    ? payload.map((entry) => mapServiceRequest(entry)).filter((entry): entry is ServiceRequest => Boolean(entry))
    : [];

export type ServiceRequestCreateInput = {
  proposedName: string;
  rationale: string;
  proposedCategoryId?: string | null;
  proposedCategoryName?: string | null;
};

export type ServiceRequestApprovalInput = {
  serviceId?: string;
  categoryId?: string;
  key?: string;
  name?: string;
  description?: string | null;
  basePriceCents?: number;
  currency?: string;
  defaultEstimateMinutes?: number;
  isEmergencyCapable?: boolean;
  priceCents?: number;
  estimateDurationMinutes?: number | null;
  decisionNote?: string;
};

export const STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled"
};
