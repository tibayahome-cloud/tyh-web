// Which sign-in a role belongs to. Facility admins and system administrators are different
// audiences with different entry points; nothing public should suggest they share one.
// Keys mirror the backend: facility admins hold "admin.ops" (facility_admins.role_key),
// system administrators hold "admin.super" (and the legacy "admin").
export const FACILITY_ADMIN_ROLE = "admin.ops";
const SYSTEM_ADMIN_ROLES: readonly string[] = ["admin", "admin.super"];

export const isFacilityAdminRole = (role: string | null | undefined): boolean => role === FACILITY_ADMIN_ROLE;

export const isSystemAdminRole = (role: string | null | undefined): boolean =>
  role != null && SYSTEM_ADMIN_ROLES.includes(role);
