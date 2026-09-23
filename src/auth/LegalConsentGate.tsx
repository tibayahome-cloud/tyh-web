import type { ReactNode } from "react";
import { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { BootstrapFailedNotice } from "./BootstrapFailedNotice";
import { Loading } from "../shared/components/Loading";
import { useBoundedBootstrap } from "../shared/hooks/useBoundedBootstrap";
import { legalConsentIsComplete } from "../shared/schemas/legal";

type LegalConsentGateProps = {
  children: ReactNode;
};

export const LegalConsentGate = ({ children }: LegalConsentGateProps) => {
  const { user, isAuthenticated, isBootstrapping, bootstrapMe, checking, bootstrapFailed, retryBootstrap } =
    useBoundedBootstrap();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => {
      // A 428 means the server just decided this account's consent is required and incomplete
      // right now -- but nothing else in the app refetches /auth/me in the background, so
      // user.legalConsent can still hold whatever was true at the last bootstrap (e.g. "complete",
      // fetched at login, before a new legal document was published or a consent record was
      // reset). Navigating without refreshing first means LegalConsentPage's own "already
      // complete" check runs against that stale value and immediately bounces back to the page
      // that just 428'd -- an infinite loop between the two routes. bootstrapMe() re-fetches
      // /auth/me, which computes legal_consent with the exact same consent_summary() the backend
      // used to raise this 428, so by the time LegalConsentPage mounts it sees the true state.
      void bootstrapMe().finally(() => {
        navigate("/legal/consent", { replace: true, state: { from: location } });
      });
    };
    window.addEventListener("tiba:legal-consent-required", handler);
    return () => window.removeEventListener("tiba:legal-consent-required", handler);
  }, [bootstrapMe, location, navigate]);

  if (bootstrapFailed) {
    return <BootstrapFailedNotice onRetry={retryBootstrap} />;
  }

  // user.legalConsent is `undefined` until the first bootstrap settles, and `null` afterward if
  // the server genuinely has no consent summary for this account (mapLegalConsentSummary maps a
  // missing/invalid meta.legal_consent to null, not to a rejected bootstrap). Only `undefined`
  // means "we don't have an answer yet" -- `!user?.legalConsent` used to treat null the same way
  // and never stopped waiting for an answer that had already arrived.
  const hasConsentAnswer = user?.legalConsent !== undefined;

  if (isBootstrapping || checking || (isAuthenticated && !hasConsentAnswer)) {
    return <Loading fullHeight label="Checking account requirements" />;
  }

  // legalConsentIsComplete(null | undefined) is `true` by design (see schemas/legal.ts): an
  // account with no consent summary at all is not required to have one, so it is treated the
  // same as "complete" rather than redirected. In practice this should be unreachable from a
  // real backend response: /auth/me always sets meta.legal_consent = consent_summary(user)
  // (app/routes/auth.py), the same function that decides whether a request 428s, so a genuine
  // consent requirement always arrives as a real object with complete:false, never as a missing
  // field. This branch exists for a degraded response (network/parsing failure, a version
  // mismatch during a rolling deploy) rather than any known valid account state. Redirecting
  // here anyway would also be a dead end: LegalConsentPage has no document data to render
  // without a real summary and would itself spin forever waiting for one that will never arrive.
  if (isAuthenticated && !legalConsentIsComplete(user?.legalConsent)) {
    return <Navigate to="/legal/consent" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};
