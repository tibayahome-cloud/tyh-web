import api from "./api";
import {
  mapServiceRequest,
  mapServiceRequests,
  type ServiceRequest,
  type ServiceRequestApprovalInput,
  type ServiceRequestCreateInput,
  type ServiceRequestStatus
} from "../schemas/serviceRequest";

const payloadData = (payload: unknown): unknown => {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: unknown }).data;
  }
  return payload;
};

const createPayload = (input: ServiceRequestCreateInput): Record<string, unknown> => ({
  proposed_name: input.proposedName,
  rationale: input.rationale,
  ...(input.proposedCategoryId ? { proposed_category_id: input.proposedCategoryId } : {}),
  ...(input.proposedCategoryName ? { proposed_category_name: input.proposedCategoryName } : {})
});

const approvalPayload = (input: ServiceRequestApprovalInput): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  if (input.serviceId) payload.service_id = input.serviceId;
  if (input.categoryId) payload.category_id = input.categoryId;
  if (input.key) payload.key = input.key;
  if (input.name) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.basePriceCents !== undefined) payload.base_price_cents = input.basePriceCents;
  if (input.currency) payload.currency = input.currency;
  if (input.defaultEstimateMinutes !== undefined) payload.default_estimate_minutes = input.defaultEstimateMinutes;
  if (input.isEmergencyCapable !== undefined) payload.is_emergency_capable = input.isEmergencyCapable;
  if (input.priceCents !== undefined) payload.price_cents = input.priceCents;
  if (input.estimateDurationMinutes !== undefined) payload.estimate_duration_minutes = input.estimateDurationMinutes;
  if (input.decisionNote) payload.decision_note = input.decisionNote;
  return payload;
};

export const fetchFacilityServiceRequests = async (
  facilityId: string,
  status?: ServiceRequestStatus
): Promise<ServiceRequest[]> => {
  const response = await api.get(`/facilities/${facilityId}/service-requests`, {
    params: status ? { "filter[status]": status } : undefined
  });
  return mapServiceRequests(payloadData(response.data));
};

export const createFacilityServiceRequest = async (
  facilityId: string,
  input: ServiceRequestCreateInput
): Promise<ServiceRequest> => {
  const response = await api.post(`/facilities/${facilityId}/service-requests`, createPayload(input));
  const request = mapServiceRequest(payloadData(response.data));
  if (!request) {
    throw new Error("Failed to create service request");
  }
  return request;
};

export const cancelFacilityServiceRequest = async (
  facilityId: string,
  requestId: string
): Promise<ServiceRequest> => {
  const response = await api.post(`/facilities/${facilityId}/service-requests/${requestId}/cancel`);
  const request = mapServiceRequest(payloadData(response.data));
  if (!request) {
    throw new Error("Failed to cancel service request");
  }
  return request;
};

export const fetchServiceRequests = async (params?: {
  facilityId?: string;
  status?: ServiceRequestStatus;
}): Promise<ServiceRequest[]> => {
  const response = await api.get("/service-requests", {
    params: {
      ...(params?.facilityId ? { "filter[facility_id]": params.facilityId } : {}),
      ...(params?.status ? { "filter[status]": params.status } : {})
    }
  });
  return mapServiceRequests(payloadData(response.data));
};

export const approveServiceRequest = async (
  requestId: string,
  input: ServiceRequestApprovalInput
): Promise<ServiceRequest> => {
  const response = await api.post(`/service-requests/${requestId}/approve`, approvalPayload(input));
  const request = mapServiceRequest(payloadData(response.data));
  if (!request) {
    throw new Error("Failed to approve service request");
  }
  return request;
};

export const rejectServiceRequest = async (
  requestId: string,
  decisionNote?: string
): Promise<ServiceRequest> => {
  const response = await api.post(`/service-requests/${requestId}/reject`, {
    ...(decisionNote ? { decision_note: decisionNote } : {})
  });
  const request = mapServiceRequest(payloadData(response.data));
  if (!request) {
    throw new Error("Failed to reject service request");
  }
  return request;
};
