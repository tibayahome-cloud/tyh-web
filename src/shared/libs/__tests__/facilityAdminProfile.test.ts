import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet, mockPatch } = vi.hoisted(() => ({ mockGet: vi.fn(), mockPatch: vi.fn() }));
vi.mock("../api", () => ({ __esModule: true, default: { get: mockGet, patch: mockPatch, post: vi.fn() } }));

import { fetchFacilityAdminAccess, updateFacilityAdminProfile } from "../facilities";

describe("facility admin list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps name, phone, verification, assignment status and a pending email change", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          {
            id: "a-1", facility_id: "f-1", user_id: "u-1", full_name: "Amina Ops", email: "amina@clinic.test",
            phone: "+254700000001", user_status: "active", email_verified_at: "2026-09-01T00:00:00Z",
            phone_verified_at: null, role_key: "admin.ops", active: true, assignment_status: "active", removed_at: null,
            invitation: { status: "completed" },
            email_change: { status: "pending_verification", email: "new@clinic.test" }
          },
          {
            id: "a-2", facility_id: "f-1", user_id: "u-2", full_name: "Old Admin", email: "old@clinic.test",
            phone: null, user_status: "active", role_key: "admin.ops", active: false, assignment_status: "removed",
            removed_at: "2026-08-01T00:00:00Z", invitation: { status: "completed" }, email_change: null
          }
        ]
      }
    });

    const [current, removed] = await fetchFacilityAdminAccess("f-1");
    expect(current).toMatchObject({
      fullName: "Amina Ops", phone: "+254700000001", phoneVerifiedAt: null, active: true,
      assignmentStatus: "active", pendingEmail: "new@clinic.test"
    });
    expect(removed).toMatchObject({ active: false, assignmentStatus: "removed", removedAt: "2026-08-01T00:00:00Z", pendingEmail: null });
  });
});

describe("updateFacilityAdminProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends only the supplied fields, in the API's names, to the facility-scoped endpoint", async () => {
    mockPatch.mockResolvedValue({ data: { data: { user_id: "u-1", full_name: "Amina", email: "a@c.test", phone: null } } });
    await updateFacilityAdminProfile("f-1", "u-1", { fullName: "Amina", phone: null });
    expect(mockPatch).toHaveBeenCalledWith("/facilities/f-1/admins/u-1", { full_name: "Amina", phone: null });
  });

  it("returns the pending email change from a 202 response", async () => {
    mockPatch.mockResolvedValue({
      data: {
        data: {
          user_id: "u-1", full_name: "Amina", email: "old@c.test", phone: null,
          email_change: { status: "pending_verification", email: "new@c.test", expires_in_seconds: 3600 }
        }
      }
    });
    const result = await updateFacilityAdminProfile("f-1", "u-1", { email: "new@c.test" });
    expect(result.emailChange).toEqual({ status: "pending_verification", email: "new@c.test", expiresInSeconds: 3600 });
    expect(result.admin.email).toBe("old@c.test");
  });

  it("returns no email change when none was requested", async () => {
    mockPatch.mockResolvedValue({ data: { data: { user_id: "u-1", full_name: "A", email: "a@c.test", phone: null, email_change: null } } });
    expect((await updateFacilityAdminProfile("f-1", "u-1", { fullName: "A" })).emailChange).toBeNull();
  });
});
