import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../shared/hooks/useAuth";
import { Loading } from "../shared/components/Loading";
import { areaForRoles, rememberArea } from "../shared/utils/portalMemory";

type LogoutGateProps = {
  children: ReactNode;
  // A function is evaluated when the redirect happens, so it can use what was remembered while
  // the person was signed in (which sign-in page they belong on).
  redirectTo: string | (() => string);
};

export const LogoutGate = ({ children, redirectTo }: LogoutGateProps) => {
  const { isAuthenticated, isBootstrapping, sessionExpired, roles } = useAuth();
  const location = useLocation();

  // Remember which area this session belongs to, for the sign-in page shown after sign-out.
  useEffect(() => {
    if (isAuthenticated) {
      rememberArea(areaForRoles(roles));
    }
  }, [isAuthenticated, roles]);

  if (sessionExpired) {
    return <Navigate to="/session-expired" replace />;
  }

  if (isBootstrapping) {
    return <Loading fullHeight />;
  }

  if (!isAuthenticated) {
    return <Navigate to={typeof redirectTo === "function" ? redirectTo() : redirectTo} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

