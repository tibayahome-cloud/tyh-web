import type { PropsWithChildren } from "react";

import { RequirePerm, RequireRole } from "../../shared/rbac/Can";
import { PERMISSION_ADMIN_ACCESS } from "../../shared/rbac/roles";

export const AdminGuard = ({ children }: PropsWithChildren<unknown>) => (
  <RequirePerm perm={PERMISSION_ADMIN_ACCESS}>{children}</RequirePerm>
);

/** Restrict platform-wide admin screens to platform administrators. */
export const PlatformAdminGuard = ({ children }: PropsWithChildren<unknown>) => (
  <RequireRole role={["admin.super", "admin"]} redirectTo="/admin/facility">
    {children}
  </RequireRole>
);
