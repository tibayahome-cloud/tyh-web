import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { isNativePlatform } from "../libs/capacitor";
import {
  checkPermissions,
  requestPermissions,
  getCurrentPosition,
  type GeoPosition
} from "../libs/geolocation";

export type LocationPermissionStatus = "checking" | "granted" | "prompt" | "denied";

type LocationAccessState = {
  status: LocationPermissionStatus;
  lastPosition: GeoPosition | null;
  error?: string | null;
};

const isBrowser = () => typeof window !== "undefined" && typeof navigator !== "undefined";

export const useLocationAccess = () => {
  const [{ status, lastPosition, error }, setState] = useState<LocationAccessState>({
    status: isBrowser() ? "checking" : "prompt",
    lastPosition: null,
    error: null
  });

  const statusRef = useRef(status);
  statusRef.current = status;

  const requestAccess = useCallback(async (force = false) => {
    const currentStatus = statusRef.current;
    if (!force && (currentStatus === "granted" || currentStatus === "denied")) {
      return;
    }

    setState((prev) => ({ ...prev, status: "checking", error: null }));

    try {
      if (isNativePlatform()) {
        const permStatus = await requestPermissions();
        if (permStatus === "denied") {
          setState({ status: "denied", lastPosition: null, error: "Location permission denied" });
          return;
        }
      }

      const position = await getCurrentPosition(false);
      setState({ status: "granted", lastPosition: position, error: null });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to get location";
      const permStatus = await checkPermissions();
      setState({
        status: permStatus === "granted" ? "granted" : permStatus === "denied" ? "denied" : "prompt",
        lastPosition: null,
        error: errorMsg
      });
    }
  }, []);

  useEffect(() => {
    if (!isBrowser()) return;

    let permissionStatus: PermissionStatus | null = null;

    const queryPermission = async () => {
      try {
        const status = await checkPermissions();
        if (status === "granted") {
          setState((prev) => ({ ...prev, status: "granted", error: null }));
          requestAccess(true);
        } else if (status === "denied") {
          setState((prev) => ({ ...prev, status: "denied", error: "Location permission denied" }));
        } else {
          setState((prev) => ({ ...prev, status: "prompt", error: null }));
        }

        if (!isNativePlatform() && navigator.permissions?.query) {
          permissionStatus = await navigator.permissions.query({ name: "geolocation" as PermissionName });
          permissionStatus.onchange = () => {
            if (permissionStatus?.state === "granted") {
              setState((prev) => ({ ...prev, status: "granted", error: null }));
              requestAccess(true);
            } else if (permissionStatus?.state === "denied") {
              setState((prev) => ({ ...prev, status: "denied", error: "Location permission denied" }));
            } else {
              setState((prev) => ({ ...prev, status: "prompt", error: null }));
            }
          };
        }
      } catch {
        requestAccess();
      }
    };

    queryPermission();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && statusRef.current !== "granted") {
        requestAccess(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (permissionStatus) permissionStatus.onchange = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [requestAccess]);

  const isGranted = status === "granted";

  return useMemo(
    () => ({
      status,
      lastPosition,
      error,
      isGranted,
      requestAccess: () => requestAccess(true)
    }),
    [status, lastPosition, error, isGranted, requestAccess]
  );
};

export type UseLocationAccessReturn = ReturnType<typeof useLocationAccess>;
