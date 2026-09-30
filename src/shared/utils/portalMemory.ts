import { isFacilityAdminRole, isSystemAdminRole } from "../rbac/portalRoles";
import { ROLE_PROVIDER } from "../rbac/roles";

// Which part of the app the last signed-in person was using. It only chooses which sign-in page
// to send someone back to after they sign out or their session ends -- a page reached by
// mistake shows a sign-in form, nothing more. It grants nothing: the API and the route guards
// still decide what any account may open.
export type Area = "system" | "facility" | "provider" | "client";

const STORAGE_KEY = "tiba.lastArea";
const AREAS: readonly Area[] = ["system", "facility", "provider", "client"];

export const areaForRoles = (roles: readonly string[] | null | undefined): Area | null => {
  if (!roles || roles.length === 0) {
    return null;
  }
  if (roles.some(isSystemAdminRole)) {
    return "system";
  }
  if (roles.some(isFacilityAdminRole)) {
    return "facility";
  }
  if (roles.includes(ROLE_PROVIDER)) {
    return "provider";
  }
  return "client";
};

export const rememberArea = (area: Area | null): void => {
  if (!area) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, area);
  } catch {
    // Storage can be blocked or full; the fallback sign-in page is used instead.
  }
};

export const readArea = (): Area | null => {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return AREAS.includes(value as Area) ? (value as Area) : null;
  } catch {
    return null;
  }
};

// Sign-in page for someone whose session ended. Nothing remembered means the personal sign-in.
export const sessionLoginPath = (): string => {
  switch (readArea()) {
    case "system":
      return "/admin/login";
    case "facility":
      return "/facility/login";
    default:
      return "/login";
  }
};

// Sign-in page for someone who reached the admin area without a session. System administrators
// who last used the system area go back to their own page; everyone else gets the neutral
// facility sign-in, which does not mention any other kind of administrator.
export const adminLoginPath = (): string => (readArea() === "system" ? "/admin/login" : "/facility/login");
