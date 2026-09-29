import { ROLE_ADMIN, ROLE_ADMIN_OPS, ROLE_ADMIN_SUPER } from "./roles";

// Which sign-in a role belongs to. Facility admins and system administrators are different
// audiences with different entry points; nothing public should suggest they share one.
// Keys mirror the backend: facility admins hold "admin.ops" (facility_admins.role_key),
// system administrators hold "admin.super" (and the legacy "admin").
export const isFacilityAdminRole = (role: string | null | undefined): boolean => role === ROLE_ADMIN_OPS;

export const isSystemAdminRole = (role: string | null | undefined): boolean =>
  role === ROLE_ADMIN || role === ROLE_ADMIN_SUPER;
