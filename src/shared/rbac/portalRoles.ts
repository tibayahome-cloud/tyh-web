import { ROLE_ADMIN, ROLE_ADMIN_OPS, ROLE_ADMIN_SUPER } from "./roles";

// Which sign-in a role belongs to. Facility admins and system administrators are different
// audiences with different entry points; nothing public should suggest they share one.
// Keys mirror the backend: facility admins hold "admin.ops" (facility_admins.role_key),
// system administrators hold "admin.super" (and the legacy "admin").
export const isFacilityAdminRole = (role: string | null | undefined): boolean => role === ROLE_ADMIN_OPS;

export const isSystemAdminRole = (role: string | null | undefined): boolean =>
  role === ROLE_ADMIN || role === ROLE_ADMIN_SUPER;

// Where an admin-portal account lands after signing in. This only chooses the first screen: the
// API still decides which facility (or none) an account may open, and every screen behind it
// asks the API again. A facility admin goes to the facility portal, a system administrator to
// the system dashboard; anything else falls back to the dashboard, whose guard redirects.
export const adminPortalHome = (roles: readonly string[] | null | undefined): string => {
  if (roles?.some(isSystemAdminRole)) {
    return "/admin/dashboard";
  }
  if (roles?.some(isFacilityAdminRole)) {
    return "/admin/facility";
  }
  return "/admin/dashboard";
};
