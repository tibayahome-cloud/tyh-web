import { describe, expect, it } from "vitest";

import { buildApproveForm, slugifyKey } from "../RequestsPage";
import type { ServiceRequest } from "../../../../../shared/schemas/serviceRequest";

const requestFactory = (overrides: Partial<ServiceRequest> = {}): ServiceRequest => ({
  id: "req-1",
  facilityId: "facility-1",
  facilityName: "Nairobi Clinic",
  requestedByUserId: "user-1",
  requestedByName: "Ada Ops",
  proposedName: "IV Therapy",
  proposedCategoryId: null,
  proposedCategoryName: null,
  rationale: "Clients keep asking for at-home IV drips.",
  status: "pending",
  reviewerUserId: null,
  reviewedAt: null,
  decisionNote: null,
  resultingServiceId: null,
  resultingFacilityServiceId: null,
  createdAt: "2026-08-05T10:00:00Z",
  ...overrides
});

describe("service request approval form", () => {
  it("slugifies a proposed name into a catalog key", () => {
    expect(slugifyKey("IV Therapy at Home")).toBe("iv_therapy_at_home");
    expect(slugifyKey("  Wound Care!! ")).toBe("wound_care");
  });

  it("falls back to a timestamped key when the name has no usable characters", () => {
    expect(slugifyKey("!!!")).toMatch(/^service_\d+$/);
  });

  it("defaults the approval form to create-new-service mode seeded from the request", () => {
    const form = buildApproveForm(requestFactory({ proposedCategoryId: "cat-1" }));

    expect(form.mode).toBe("create");
    expect(form.categoryId).toBe("cat-1");
    expect(form.name).toBe("IV Therapy");
    expect(form.key).toBe("iv_therapy");
    expect(form.serviceId).toBe("");
  });

  it("leaves category empty when the request did not suggest one", () => {
    const form = buildApproveForm(requestFactory({ proposedCategoryId: null }));
    expect(form.categoryId).toBe("");
  });
});
