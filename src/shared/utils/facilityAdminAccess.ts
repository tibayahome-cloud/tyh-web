import { isAxiosError } from "axios";

import type { FacilityAdminAccess } from "../libs/facilities";
import { classifyApiError } from "./errors";

export type FacilityAdminAccessLabel = "Pending" | "Expired" | "Account active" | "Suspended" | "Removed";

export type FacilityAdminAccessState = {
  label: FacilityAdminAccessLabel;
  // Setup has not finished: the admin needs a (new) setup invitation.
  canResendInvitation: boolean;
  // The account is active: a forgotten password is recovered with a reset link instead.
  canSendResetLink: boolean;
};

// The states a super admin sees. An account that has finished setup is "Account active"
// whatever its old invitation looks like; otherwise the invitation decides between Pending and
// Expired. A superseded (revoked) invitation with no live replacement reads as Expired, and an
// invitation that was never sent reads as Pending.
export const facilityAdminAccessState = (admin: FacilityAdminAccess): FacilityAdminAccessState => {
  // Neither a suspended account nor a removed assignment can be recovered from here: no setup
  // invitation or reset link is offered, and the API refuses both anyway.
  if (!admin.active) {
    return { label: "Removed", canResendInvitation: false, canSendResetLink: false };
  }
  if (admin.userStatus === "suspended") {
    return { label: "Suspended", canResendInvitation: false, canSendResetLink: false };
  }
  if (admin.userStatus === "active" || admin.invitation.status === "completed") {
    return { label: "Account active", canResendInvitation: false, canSendResetLink: true };
  }
  const expired = admin.invitation.status === "expired" || admin.invitation.status === "revoked";
  return { label: expired ? "Expired" : "Pending", canResendInvitation: true, canSendResetLink: false };
};

// Says what happened when a recovery request fails, including the rate limit.
export const describeRecoveryError = (error: unknown): string => {
  if (isAxiosError(error) && error.response?.status === 429) {
    return "Too many requests. Wait a few minutes and try again.";
  }
  const { category, message } = classifyApiError(error, "We could not send that. Try again.");
  if (category === "timeout") {
    return "The server took too long to respond. Check your connection and try again.";
  }
  if (category === "unavailable") {
    return isAxiosError(error) && error.response
      ? "Something went wrong on our side. Try again in a moment."
      : "We could not reach the server. Check your connection and try again.";
  }
  if (category === "forbidden") {
    return "Only a super admin can do this.";
  }
  return message;
};
