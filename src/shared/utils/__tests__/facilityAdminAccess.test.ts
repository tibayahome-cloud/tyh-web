import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import type { FacilityAdminAccess } from "../../libs/facilities";
import { describeRecoveryError, facilityAdminAccessState } from "../facilityAdminAccess";

const admin = (userStatus: string, invitation: FacilityAdminAccess["invitation"]["status"]): FacilityAdminAccess => ({
  id: "a-1",
  facilityId: "f-1",
  userId: "u-1",
  fullName: "Ops Admin",
  email: "ops@clinic.test",
  phone: null,
  userStatus,
  emailVerifiedAt: null,
  phoneVerifiedAt: null,
  roleKey: "admin.ops",
  active: true,
  assignmentStatus: "active",
  suspendedAt: null,
  suspensionReason: null,
  removedAt: null,
  pendingEmail: null,
  invitation: { status: invitation, resetId: null, expiresAt: null, redeemedAt: null }
});

const httpError = (status: number, message = "boom") =>
  new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: {} as never,
    data: { error: { code: "x", name: "y", message } }
  });

const withStatus = (assignmentStatus: FacilityAdminAccess["assignmentStatus"], over: Partial<FacilityAdminAccess> = {}) => ({
  ...admin("active", "completed"),
  assignmentStatus,
  active: assignmentStatus === "active",
  ...over
});

describe("facilityAdminAccessState: account label for a current assignment", () => {
  it.each([
    ["pending", "pending", "Setup pending", true, false],
    ["pending", "not_issued", "Setup pending", true, false],
    ["pending", "expired", "Invitation expired", true, false],
    ["pending", "revoked", "Invitation expired", true, false],
    ["active", "completed", "Account active", false, true],
    ["active", "expired", "Account active", false, true],
    ["pending", "completed", "Account active", false, true],
    ["suspended", "completed", "Account suspended", false, false],
    ["suspended", "expired", "Account suspended", false, false]
  ] as const)("account %s, invitation %s reads %s", (userStatus, invitation, account, resend, reset) => {
    expect(facilityAdminAccessState(admin(userStatus, invitation))).toEqual({
      access: "Access active",
      account,
      canEdit: true,
      canResendInvitation: resend,
      canSendResetLink: reset,
      canSuspend: true,
      canReactivate: false
    });
  });

  it("never offers both recovery actions at once", () => {
    for (const userStatus of ["pending", "active", "suspended"]) {
      for (const invitation of ["not_issued", "pending", "completed", "expired", "revoked"] as const) {
        const state = facilityAdminAccessState(admin(userStatus, invitation));
        expect(state.canResendInvitation && state.canSendResetLink).toBe(false);
      }
    }
  });
});

describe("facilityAdminAccessState: assignment status wins over the account", () => {
  it("a suspended assignment offers only reactivation, whatever the account looks like", () => {
    expect(facilityAdminAccessState(withStatus("suspended"))).toEqual({
      access: "Access suspended",
      account: "Account active",
      canEdit: false,
      canResendInvitation: false,
      canSendResetLink: false,
      canSuspend: false,
      canReactivate: true
    });
  });

  it("a removed assignment offers nothing and hides the account state", () => {
    expect(facilityAdminAccessState(withStatus("removed"))).toEqual({
      access: "Access removed",
      account: null,
      canEdit: false,
      canResendInvitation: false,
      canSendResetLink: false,
      canSuspend: false,
      canReactivate: false
    });
  });

  it("is driven by assignmentStatus, not the raw active flag", () => {
    // Both suspended and removed assignments have active=false; only the status tells them apart.
    expect(facilityAdminAccessState(withStatus("suspended", { active: false })).access).toBe("Access suspended");
    expect(facilityAdminAccessState(withStatus("removed", { active: false })).access).toBe("Access removed");
    expect(facilityAdminAccessState(withStatus("active", { active: false })).access).toBe("Access active");
  });
});

describe("describeRecoveryError", () => {
  it("explains the rate limit", () => {
    expect(describeRecoveryError(httpError(429, "Rate limit exceeded"))).toBe(
      "Too many requests. Wait a few minutes and try again."
    );
  });

  it("explains a timeout, a lost connection and a server fault without leaking internals", () => {
    expect(describeRecoveryError(new AxiosError("timeout", "ECONNABORTED"))).toMatch(/took too long/i);
    expect(describeRecoveryError(new AxiosError("Network Error", "ERR_NETWORK"))).toMatch(/could not reach the server/i);
    const server = describeRecoveryError(httpError(500, "psycopg exploded"));
    expect(server).toMatch(/something went wrong on our side/i);
    expect(server).not.toMatch(/psycopg/);
  });

  it("says only a super admin can do this for a 403", () => {
    expect(describeRecoveryError(httpError(403, "Super admin privileges required"))).toBe("Only a super admin can do this.");
  });

  it("shows the API's own guidance for a rejected request", () => {
    expect(
      describeRecoveryError(httpError(400, "Facility admin has not completed account setup; resend the setup invitation instead"))
    ).toMatch(/resend the setup invitation/);
  });
});
