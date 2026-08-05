import { describe, expect, it } from "vitest";

import { mapServiceRequest, mapServiceRequests } from "../serviceRequest";

describe("service request schema mappers", () => {
  it("maps a pending service request payload", () => {
    const request = mapServiceRequest({
      id: "req-1",
      facility_id: "facility-1",
      facility: { id: "facility-1", name: "Nairobi Clinic" },
      requested_by_user_id: "user-1",
      requested_by: { id: "user-1", full_name: "Ada Ops" },
      proposed_name: "IV Therapy",
      proposed_category_id: "cat-1",
      proposed_category_name: null,
      rationale: "Clients keep asking for at-home IV drips.",
      status: "pending",
      reviewer_user_id: null,
      reviewed_at: null,
      decision_note: null,
      resulting_service_id: null,
      resulting_facility_service_id: null,
      created_at: "2026-08-05T10:00:00Z"
    });

    expect(request).toEqual({
      id: "req-1",
      facilityId: "facility-1",
      facilityName: "Nairobi Clinic",
      requestedByUserId: "user-1",
      requestedByName: "Ada Ops",
      proposedName: "IV Therapy",
      proposedCategoryId: "cat-1",
      proposedCategoryName: null,
      rationale: "Clients keep asking for at-home IV drips.",
      status: "pending",
      reviewerUserId: null,
      reviewedAt: null,
      decisionNote: null,
      resultingServiceId: null,
      resultingFacilityServiceId: null,
      createdAt: "2026-08-05T10:00:00Z"
    });
  });

  it("maps an approved service request with decision metadata", () => {
    const request = mapServiceRequest({
      id: "req-2",
      facility_id: "facility-1",
      proposed_name: "IV Therapy",
      rationale: "Clients keep asking for at-home IV drips.",
      status: "approved",
      reviewer_user_id: "admin-1",
      reviewed_at: "2026-08-05T12:00:00Z",
      decision_note: "Added to Wellness category.",
      resulting_service_id: "service-9",
      resulting_facility_service_id: "facility-service-9"
    });

    expect(request?.status).toBe("approved");
    expect(request?.resultingServiceId).toBe("service-9");
    expect(request?.resultingFacilityServiceId).toBe("facility-service-9");
    expect(request?.decisionNote).toBe("Added to Wellness category.");
  });

  it("rejects payloads missing required identity or status fields", () => {
    expect(mapServiceRequest({ id: "req-3", proposed_name: "IV Therapy", status: "pending" })).toBeNull();
    expect(mapServiceRequest({ id: "req-3", facility_id: "facility-1", status: "pending" })).toBeNull();
    expect(
      mapServiceRequest({ id: "req-3", facility_id: "facility-1", proposed_name: "IV Therapy", status: "unknown" })
    ).toBeNull();
  });

  it("maps a list and drops invalid entries", () => {
    const requests = mapServiceRequests([
      { id: "req-1", facility_id: "facility-1", proposed_name: "IV Therapy", status: "pending" },
      { id: "req-2" }
    ]);
    expect(requests).toHaveLength(1);
    expect(requests[0].id).toBe("req-1");
  });
});
