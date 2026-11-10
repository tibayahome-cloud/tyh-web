import type { ReactNode} from "react";
import { useEffect, useState } from "react";

import { useAuth } from "../shared/hooks/useAuth";
import { Loading } from "../shared/components/Loading";

type RefreshGateProps = {
  children: ReactNode;
};

export const RefreshGate = ({ children }: RefreshGateProps) => {
  const { accessToken, hasRefreshToken, refresh, isBootstrapping } = useAuth();
  const [attempted, setAttempted] = useState(false);
  // True from the first time the app is let through. The gate is for the first load, so that a stored session is restored
  // before any page decides the person is signed out. After that it stays out of the way.
  const [released, setReleased] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!accessToken && hasRefreshToken && !attempted) {
      refresh()
        .catch(() => {
          /* handled via auth state */
        })
        .finally(() => {
          if (!cancelled) {
            setAttempted(true);
          }
        });
      return () => {
        cancelled = true;
      };
    }

    if (!attempted && (accessToken || !hasRefreshToken)) {
      setAttempted(true);
    }

    return () => {
      cancelled = true;
    };
  }, [accessToken, hasRefreshToken, refresh, attempted]);

  const ready = attempted && !isBootstrapping;

  useEffect(() => {
    if (ready) {
      setReleased(true);
    }
  }, [ready]);

  // Signing in later refreshes the profile in the background, which sets isBootstrapping again. Swapping the whole app for
  // a spinner then unmounted every page, and a booking made without an account lost its place the moment the account
  // existed. The areas that need the profile (LogoutGate, LegalConsentGate, Can) wait for it themselves.
  if (!ready && !released) {
    return <Loading fullHeight />;
  }

  return <>{children}</>;
};

