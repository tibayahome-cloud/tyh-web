import { ROLE_ADMIN, ROLE_ADMIN_OPS, ROLE_ADMIN_SUPER, ROLE_CLIENT, ROLE_PROVIDER } from "./roles";

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

// A person can hold more than one role: an administrator who is also a provider in their facility, say. The areas of the app are
// separate and each is guarded by its own role, so such a person can open each of them. What they need is a way to get from one
// to another. The two helpers below answer "which areas do these roles open?" and "which one is this address in?". They ask which
// roles the account holds, never which one comes first: the API does not promise an order.
export type OpenArea = {
  key: "admin" | "provider" | "client";
  /** Lower case, to read after "Switch to". */
  label: string;
  path: string;
};

export const areasOpenedBy = (roles: readonly string[] | null | undefined): OpenArea[] => {
  const held = roles ?? [];
  const areas: OpenArea[] = [];
  if (held.some((role) => isFacilityAdminRole(role) || isSystemAdminRole(role))) {
    areas.push({
      key: "admin",
      label: held.some(isSystemAdminRole) ? "system admin area" : "facility admin area",
      path: adminPortalHome(held)
    });
  }
  if (held.includes(ROLE_PROVIDER)) {
    areas.push({ key: "provider", label: "provider area", path: "/pro/home" });
  }
  if (held.includes(ROLE_CLIENT)) {
    areas.push({ key: "client", label: "patient area", path: "/app/home" });
  }
  return areas;
};

const isInside = (pathname: string, root: string) => pathname === root || pathname.startsWith(`${root}/`);

export const areaOfPath = (pathname: string): OpenArea["key"] | null => {
  if (isInside(pathname, "/admin")) return "admin";
  if (isInside(pathname, "/pro")) return "provider";
  if (isInside(pathname, "/app")) return "client";
  return null;
};

export type PersonalSignInDestination =
  | { kind: "provider" }
  | { kind: "client" }
  | { kind: "staff"; audience: "facility" | "system" };

// Where the personal sign-in, the page for patients and providers, sends someone. A provider goes to the provider area, a patient
// to the patient area. Someone who holds only administrator roles belongs at a staff sign-in and is told so. An administrator who
// is also a provider (or a patient) came through the personal door as one, so that is where they land; the menu then offers the
// other area.
export const personalSignInDestination = (roles: readonly string[] | null | undefined): PersonalSignInDestination => {
  const held = roles ?? [];
  if (held.includes(ROLE_PROVIDER)) {
    return { kind: "provider" };
  }
  const isAdmin = held.some((role) => isFacilityAdminRole(role) || isSystemAdminRole(role));
  if (isAdmin && !held.includes(ROLE_CLIENT)) {
    return { kind: "staff", audience: held.some(isSystemAdminRole) ? "system" : "facility" };
  }
  return { kind: "client" };
};
