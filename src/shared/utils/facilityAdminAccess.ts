import { isAxiosError } from "axios";

import type { FacilityAdminAccess } from "../libs/facilities";
import { classifyApiError } from "./errors";

// Two separate facts, never merged: the person's facility access (this assignment) and their
// account (sign-in, setup). A suspended facility assignment says nothing about the account, and an
// account suspended elsewhere says nothing about this assignment.
export type FacilityAccessLabel = "Access active" | "Access suspended" | "Access removed";
export type AccountLabel = "Setup pending" | "Invitation expired" | "Account active" | "Account suspended";

export type FacilityAdminAccessState = {
  access: FacilityAccessLabel;
  // Not shown for a removed assignment: the account is no longer this facility's concern.
  account: AccountLabel | null;
  // Profile editing, setup invitations and reset links only work on a current (active) assignment.
  canEdit: boolean;
  // Setup has not finished: the admin needs a (new) setup invitation.
  canResendInvitation: boolean;
  // The account is active: a forgotten password is recovered with a reset link instead.
  canSendResetLink: boolean;
  canSuspend: boolean;
  canReactivate: boolean;
};

const accountLabel = (admin: FacilityAdminAccess): AccountLabel => {
  if (admin.userStatus === "suspended") return "Account suspended";
  if (admin.userStatus === "active" || admin.invitation.status === "completed") return "Account active";
  return admin.invitation.status === "expired" || admin.invitation.status === "revoked" ? "Invitation expired" : "Setup pending";
};

// What a super admin sees and may do for one administrator. Driven by assignmentStatus, not by
// the raw `active` flag (a suspended and a removed assignment are both inactive).
export const facilityAdminAccessState = (admin: FacilityAdminAccess): FacilityAdminAccessState => {
  if (admin.assignmentStatus === "removed") {
    return { access: "Access removed", account: null, canEdit: false, canResendInvitation: false, canSendResetLink: false, canSuspend: false, canReactivate: false };
  }
  const account = accountLabel(admin);
  if (admin.assignmentStatus === "suspended") {
    return { access: "Access suspended", account, canEdit: false, canResendInvitation: false, canSendResetLink: false, canSuspend: false, canReactivate: true };
  }
  // A globally suspended account keeps its assignment, but no recovery link is offered for it.
  const accountSuspended = account === "Account suspended";
  return {
    access: "Access active",
    account,
    canEdit: true,
    canResendInvitation: account === "Setup pending" || account === "Invitation expired",
    canSendResetLink: account === "Account active" && !accountSuspended,
    canSuspend: true,
    canReactivate: false
  };
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
