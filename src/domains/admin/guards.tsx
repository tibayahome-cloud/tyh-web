import type { PropsWithChildren } from "react";

import { RequirePerm } from "../../shared/rbac/Can";
import { PERMISSION_ADMIN_ACCESS } from "../../shared/rbac/roles";

export const AdminGuard = ({ children }: PropsWithChildren<unknown>) => (
  <RequirePerm perm={PERMISSION_ADMIN_ACCESS}>{children}</RequirePerm>
);

