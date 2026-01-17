import { useCallback, useMemo } from "react";

import { useAuth } from "./useAuth";
import { ROLE_ADMIN_SUPER, ROLE_PERMISSION_MAP } from "../rbac/roles";

const toArray = (value: string | string[]): string[] => (Array.isArray(value) ? value : [value]);

export const useRbac = () => {
  const { roles, permissions } = useAuth();

  const roleSet = useMemo(() => new Set(roles), [roles]);
  const isSuperAdmin = roleSet.has(ROLE_ADMIN_SUPER);
  const permissionSet = useMemo(() => {
    const derived = roles.flatMap((role) => ROLE_PERMISSION_MAP[role] ?? []);
    if (isSuperAdmin) {
      return new Set<string>(["*"]);
    }
    return new Set([...permissions, ...derived]);
  }, [permissions, roles, isSuperAdmin]);

  const hasRole = useCallback(
    (role: string | string[], requireAll = false) => {
      const required = toArray(role);
      if (requireAll) {
        return required.every((item) => roleSet.has(item));
      }
      return required.some((item) => roleSet.has(item));
    },
    [roleSet]
  );

  const hasPermission = useCallback(
    (perm: string | string[], requireAll = false) => {
      if (isSuperAdmin) {
        return true;
      }
      const required = toArray(perm);
      if (requireAll) {
        return required.every((item) => permissionSet.has(item));
      }
      return required.some((item) => permissionSet.has(item));
    },
    [permissionSet, isSuperAdmin]
  );

  return {
    roles,
    permissions,
    hasRole,
    hasPermission
  };
};
