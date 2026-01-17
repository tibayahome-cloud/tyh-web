import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useRbac } from "../hooks/useRbac";
import { Loading } from "../components/Loading";

type RoleValue = string | string[];
type PermissionValue = string | string[];

type CanProps = {
  role?: RoleValue;
  perm?: PermissionValue;
  requireAll?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
};

export const Can = ({ role, perm, requireAll = false, fallback = null, children }: CanProps) => {
  const { hasRole, hasPermission } = useRbac();

  const meetsRole = role ? hasRole(role, requireAll) : true;
  const meetsPerm = perm ? hasPermission(perm, requireAll) : true;

  if (!meetsRole || !meetsPerm) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

type RequireRoleProps = {
  role: RoleValue;
  children: ReactNode;
  requireAll?: boolean;
  redirectTo?: string;
  fallback?: ReactNode;
};

export const RequireRole = ({
  role,
  children,
  requireAll = false,
  redirectTo = "/login",
  fallback
}: RequireRoleProps) => {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const { hasRole } = useRbac();
  const location = useLocation();

  if (isBootstrapping) {
    return fallback ?? <Loading fullHeight />;
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (!hasRole(role, requireAll)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

type RequirePermProps = {
  perm: PermissionValue;
  children: ReactNode;
  requireAll?: boolean;
  redirectTo?: string;
  fallback?: ReactNode;
};

export const RequirePerm = ({
  perm,
  children,
  requireAll = false,
  redirectTo = "/admin/login",
  fallback
}: RequirePermProps) => {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const { hasPermission } = useRbac();
  const location = useLocation();

  if (isBootstrapping) {
    return fallback ?? <Loading fullHeight />;
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (!hasPermission(perm, requireAll)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

