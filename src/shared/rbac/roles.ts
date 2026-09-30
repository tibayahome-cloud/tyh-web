export const ROLE_CLIENT = "client";
export const ROLE_PROVIDER = "provider";
export const ROLE_ADMIN = "admin";
export const ROLE_ADMIN_SUPER = "admin.super";
export const ROLE_ADMIN_OPS = "admin.ops";

export const PERMISSION_ADMIN_ACCESS = "admin.access";

export type RoleKey = typeof ROLE_CLIENT | typeof ROLE_PROVIDER | typeof ROLE_ADMIN | typeof ROLE_ADMIN_SUPER | string;
export type PermissionKey = typeof PERMISSION_ADMIN_ACCESS | string;

export const ROLE_PERMISSION_MAP: Record<string, PermissionKey[]> = {
  [ROLE_ADMIN]: [PERMISSION_ADMIN_ACCESS],
  [ROLE_ADMIN_SUPER]: [PERMISSION_ADMIN_ACCESS],
  [ROLE_ADMIN_OPS]: [
    PERMISSION_ADMIN_ACCESS,
    "facility:read",
    "facility:manage",
    "facility:services.manage",
    "facility:finance.manage",
    "provider:verify",
    "booking:manage"
  ]
};

export const isAdminPortalRole = (role: string | null | undefined): boolean =>
  role === ROLE_ADMIN || role === ROLE_ADMIN_SUPER || role === ROLE_ADMIN_OPS;
