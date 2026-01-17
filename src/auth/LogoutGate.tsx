import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../shared/hooks/useAuth";
import { Loading } from "../shared/components/Loading";

type LogoutGateProps = {
  children: ReactNode;
  redirectTo: string;
};

export const LogoutGate = ({ children, redirectTo }: LogoutGateProps) => {
  const { isAuthenticated, isBootstrapping, sessionExpired } = useAuth();
  const location = useLocation();

  if (sessionExpired) {
    return <Navigate to="/session-expired" replace />;
  }

  if (isBootstrapping) {
    return <Loading fullHeight />;
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

