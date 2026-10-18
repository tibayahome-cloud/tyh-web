import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet, mockPatch, mockPost } = vi.hoisted(() => ({ mockGet: vi.fn(), mockPatch: vi.fn(), mockPost: vi.fn() }));
vi.mock("../api", () => ({ __esModule: true, default: { get: mockGet, patch: mockPatch, post: mockPost } }));

import { fetchFacilityAdminAccess, inviteFacilityAdmin, setFacilityAdminStatus, updateFacilityAdminProfile } from "../facilities";

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

describe("assignment status mapping", () => {
  beforeEach(() => vi.clearAllMocks());

  const entry = (over: Record<string, unknown>) => ({
    id: "a", facility_id: "f-1", user_id: "u", email: "a@c.test", user_status: "active", role_key: "admin.ops",
    invitation: { status: "completed" }, ...over
  });

  it("tells suspended from removed by assignment_status, though both have active=false", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          entry({ id: "s", active: false, assignment_status: "suspended", suspended_at: "2026-10-01T00:00:00Z", suspension_reason: "Left" }),
          entry({ id: "r", active: false, assignment_status: "removed", removed_at: "2026-08-01T00:00:00Z" }),
          entry({ id: "ok", active: true, assignment_status: "active" })
        ]
      }
    });
    const [suspended, removed, active] = await fetchFacilityAdminAccess("f-1");
    expect(suspended).toMatchObject({ assignmentStatus: "suspended", active: false, suspendedAt: "2026-10-01T00:00:00Z", suspensionReason: "Left", userStatus: "active" });
    expect(removed).toMatchObject({ assignmentStatus: "removed", active: false, suspendedAt: null });
    expect(active.assignmentStatus).toBe("active");
  });

  it("without assignment_status, never guesses suspension: inactive reads as removed", async () => {
    mockGet.mockResolvedValue({ data: { data: [entry({ active: false })] } });
    expect((await fetchFacilityAdminAccess("f-1"))[0].assignmentStatus).toBe("removed");
  });

  it("keeps the account's own status separate from the assignment", async () => {
    mockGet.mockResolvedValue({ data: { data: [entry({ active: true, assignment_status: "active", user_status: "suspended" })] } });
    expect((await fetchFacilityAdminAccess("f-1"))[0]).toMatchObject({ userStatus: "suspended", assignmentStatus: "active" });
  });
});

describe("inviteFacilityAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts the email to the invitations endpoint and maps the 201 body", async () => {
    mockPost.mockResolvedValue({
      data: { data: { facility_admin_id: "fa-1", user_id: "u-1", email: "new@c.test", assignment_status: "pending", invitation_sent: true, invitation_expires_at: "2026-10-09T00:00:00Z" } }
    });
    expect(await inviteFacilityAdmin("f-1", "new@c.test")).toEqual({
      facilityAdminId: "fa-1", userId: "u-1", email: "new@c.test", invitationSent: true, invitationExpiresAt: "2026-10-09T00:00:00Z"
    });
    expect(mockPost).toHaveBeenCalledWith("/facilities/f-1/admins/invitations", { email: "new@c.test" });
  });
});

describe("setFacilityAdminStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("suspends with a reason through the facility-scoped status endpoint, never the user-suspension one", async () => {
    mockPatch.mockResolvedValue({ data: { data: { user_id: "u-1", assignment_status: "suspended", suspended_at: "2026-10-08T00:00:00Z", suspension_reason: "Left" } } });
    expect(await setFacilityAdminStatus("f-1", "u-1", { status: "suspended", reason: "Left" })).toEqual({
      userId: "u-1", assignmentStatus: "suspended", suspendedAt: "2026-10-08T00:00:00Z", suspensionReason: "Left"
    });
    expect(mockPatch).toHaveBeenCalledWith("/facilities/f-1/admins/u-1/status", { status: "suspended", reason: "Left" });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("reactivates with only a status", async () => {
    mockPatch.mockResolvedValue({ data: { data: { user_id: "u-1", assignment_status: "active", suspended_at: null, suspension_reason: null } } });
    expect((await setFacilityAdminStatus("f-1", "u-1", { status: "active" })).assignmentStatus).toBe("active");
    expect(mockPatch).toHaveBeenCalledWith("/facilities/f-1/admins/u-1/status", { status: "active" });
  });
});
