import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import type { FacilityAdminAccess } from "../../libs/facilities";
import { describeRecoveryError, facilityAdminAccessState } from "../facilityAdminAccess";

const admin = (userStatus: string, invitation: FacilityAdminAccess["invitation"]["status"]): FacilityAdminAccess => ({
  id: "a-1",
  facilityId: "f-1",
  userId: "u-1",
  email: "ops@clinic.test",
  userStatus,
  roleKey: "admin.ops",
  active: true,
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

describe("facilityAdminAccessState", () => {
  it.each([
    ["pending", "pending", "Pending", true, false],
    ["pending", "not_issued", "Pending", true, false],
    ["pending", "expired", "Expired", true, false],
    ["pending", "revoked", "Expired", true, false],
    ["active", "completed", "Account active", false, true],
    ["active", "expired", "Account active", false, true],
    ["active", "not_issued", "Account active", false, true],
    ["pending", "completed", "Account active", false, true]
  ] as const)(
    "account %s with invitation %s reads %s",
    (userStatus, invitation, label, canResendInvitation, canSendResetLink) => {
      expect(facilityAdminAccessState(admin(userStatus, invitation))).toEqual({
        label,
        canResendInvitation,
        canSendResetLink
      });
    }
  );

  it("never offers both actions at once", () => {
    for (const userStatus of ["pending", "active", "suspended"]) {
      for (const invitation of ["not_issued", "pending", "completed", "expired", "revoked"] as const) {
        const state = facilityAdminAccessState(admin(userStatus, invitation));
        expect(state.canResendInvitation && state.canSendResetLink).toBe(false);
        expect(state.canResendInvitation || state.canSendResetLink).toBe(true);
      }
    }
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
