import type { PropsWithChildren } from "react";

import { RequireRole } from "../../shared/rbac/Can";
import { ROLE_PROVIDER } from "../../shared/rbac/roles";

export const ProviderGuard = ({ children }: PropsWithChildren<unknown>) => (
  <RequireRole role={ROLE_PROVIDER}>{children}</RequireRole>
);

