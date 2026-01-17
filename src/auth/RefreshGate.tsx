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

  if (!attempted || isBootstrapping) {
    return <Loading fullHeight />;
  }

  return <>{children}</>;
};

