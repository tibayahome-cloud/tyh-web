export const ROLE_CLIENT = "client";
export const ROLE_PROVIDER = "provider";
export const ROLE_ADMIN = "admin";
export const ROLE_ADMIN_SUPER = "admin.super";

export const PERMISSION_ADMIN_ACCESS = "admin.access";

export type RoleKey = typeof ROLE_CLIENT | typeof ROLE_PROVIDER | typeof ROLE_ADMIN | typeof ROLE_ADMIN_SUPER | string;
export type PermissionKey = typeof PERMISSION_ADMIN_ACCESS | string;

export const ROLE_PERMISSION_MAP: Record<string, PermissionKey[]> = {
  [ROLE_ADMIN]: [PERMISSION_ADMIN_ACCESS],
  [ROLE_ADMIN_SUPER]: [PERMISSION_ADMIN_ACCESS]
};
