import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { Loading } from "../shared/components/Loading";
import { useAuth } from "../shared/hooks/useAuth";
import { legalConsentIsComplete } from "../shared/schemas/legal";

type LegalConsentGateProps = {
  children: ReactNode;
};

export const LegalConsentGate = ({ children }: LegalConsentGateProps) => {
  const { user, isAuthenticated, isBootstrapping, bootstrapMe } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || isBootstrapping || user?.legalConsent) {
      return;
    }

    setChecking(true);
    bootstrapMe().finally(() => setChecking(false));
  }, [bootstrapMe, isAuthenticated, isBootstrapping, user?.legalConsent]);

  useEffect(() => {
    const handler = () => {
      navigate("/legal/consent", { replace: true, state: { from: location } });
    };
    window.addEventListener("tiba:legal-consent-required", handler);
    return () => window.removeEventListener("tiba:legal-consent-required", handler);
  }, [location, navigate]);

  if (isBootstrapping || checking || (isAuthenticated && !user?.legalConsent)) {
    return <Loading fullHeight label="Checking account requirements" />;
  }

  if (isAuthenticated && !legalConsentIsComplete(user?.legalConsent)) {
    return <Navigate to="/legal/consent" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};
