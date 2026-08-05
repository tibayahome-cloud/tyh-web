import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn()
}));

vi.mock("../api", () => ({
  __esModule: true,
  default: {
    get: mockGet,
    post: mockPost
  }
}));

import {
  approveServiceRequest,
  cancelFacilityServiceRequest,
  createFacilityServiceRequest,
  fetchFacilityServiceRequests,
  fetchServiceRequests,
  rejectServiceRequest
} from "../serviceRequests";

const requestResponse = {
  id: "req-1",
  facility_id: "facility-1",
  proposed_name: "IV Therapy",
  rationale: "Clients keep asking for at-home IV drips.",
  status: "pending"
};

describe("service request API helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists facility-scoped service requests with an optional status filter", async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [requestResponse] } });
    const requests = await fetchFacilityServiceRequests("facility-1", "pending");
    expect(mockGet).toHaveBeenCalledWith("/facilities/facility-1/service-requests", {
      params: { "filter[status]": "pending" }
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].proposedName).toBe("IV Therapy");
  });

  it("creates a facility service request with a snake_case payload", async () => {
    mockPost.mockResolvedValueOnce({ data: { data: requestResponse } });
    await createFacilityServiceRequest("facility-1", {
      proposedName: "IV Therapy",
      rationale: "Clients keep asking for at-home IV drips.",
      proposedCategoryId: "cat-1"
    });
    expect(mockPost).toHaveBeenCalledWith("/facilities/facility-1/service-requests", {
      proposed_name: "IV Therapy",
      rationale: "Clients keep asking for at-home IV drips.",
      proposed_category_id: "cat-1"
    });
  });

  it("cancels a pending facility service request", async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { ...requestResponse, status: "cancelled" } } });
    const cancelled = await cancelFacilityServiceRequest("facility-1", "req-1");
    expect(mockPost).toHaveBeenCalledWith("/facilities/facility-1/service-requests/req-1/cancel");
    expect(cancelled.status).toBe("cancelled");
  });

  it("lists global service requests with facility and status filters for super admin", async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [requestResponse] } });
    await fetchServiceRequests({ facilityId: "facility-1", status: "pending" });
    expect(mockGet).toHaveBeenCalledWith("/service-requests", {
      params: { "filter[facility_id]": "facility-1", "filter[status]": "pending" }
    });
  });

  it("approves a service request by selecting an existing catalog service", async () => {
    mockPost.mockResolvedValueOnce({
      data: { data: { ...requestResponse, status: "approved", resulting_service_id: "service-9" } }
    });
    const approved = await approveServiceRequest("req-1", { serviceId: "service-9", priceCents: 150000 });
    expect(mockPost).toHaveBeenCalledWith("/service-requests/req-1/approve", {
      service_id: "service-9",
      price_cents: 150000
    });
    expect(approved.status).toBe("approved");
  });

  it("approves a service request by creating a new catalog service", async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { ...requestResponse, status: "approved" } } });
    await approveServiceRequest("req-1", {
      categoryId: "cat-1",
      key: "iv_therapy",
      name: "IV Therapy",
      basePriceCents: 150000
    });
    expect(mockPost).toHaveBeenCalledWith("/service-requests/req-1/approve", {
      category_id: "cat-1",
      key: "iv_therapy",
      name: "IV Therapy",
      base_price_cents: 150000
    });
  });

  it("rejects a service request with an optional decision note", async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { ...requestResponse, status: "rejected" } } });
    const rejected = await rejectServiceRequest("req-1", "Duplicate of an existing service.");
    expect(mockPost).toHaveBeenCalledWith("/service-requests/req-1/reject", {
      decision_note: "Duplicate of an existing service."
    });
    expect(rejected.status).toBe("rejected");
  });
});
