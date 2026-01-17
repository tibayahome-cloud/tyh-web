import type { PropsWithChildren } from "react";

import { RequireRole } from "../../shared/rbac/Can";
import { ROLE_CLIENT } from "../../shared/rbac/roles";

export const ClientGuard = ({ children }: PropsWithChildren<unknown>) => (
  <RequireRole role={ROLE_CLIENT}>{children}</RequireRole>
);

