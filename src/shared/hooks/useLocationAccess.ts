import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type LocationPermissionStatus = "checking" | "granted" | "prompt" | "denied";

type LocationAccessState = {
  status: LocationPermissionStatus;
  lastPosition: GeolocationPosition | null;
  error?: string | null;
};

const isBrowser = () => typeof window !== "undefined" && typeof navigator !== "undefined";

export const useLocationAccess = () => {
  const [{ status, lastPosition, error }, setState] = useState<LocationAccessState>({
    status: isBrowser() ? "checking" : "prompt",
    lastPosition: null,
    error: null
  });

  // Use ref to track latest status to avoid stale closures
  const statusRef = useRef(status);
  statusRef.current = status;

  const requestAccess = useCallback((force = false) => {
    if (!isBrowser() || !navigator.geolocation) {
      setState({
        status: "denied",
        lastPosition: null,
        error: "Geolocation is not supported on this device."
      });
      return;
    }

    const currentStatus = statusRef.current;
    if (!force && (currentStatus === "granted" || currentStatus === "denied")) {
      // If already denied/granted, a regular request might be ignored by the browser. 
      // But we still try if force is true or if we are in 'prompt'/'checking'
      return;
    }

    setState((prev) => ({ ...prev, status: "checking", error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          status: "granted",
          lastPosition: position,
          error: null
        });
      },
      async (geoError) => {
        // If timeout/position unavailable but permission is actually granted, still mark as granted
        if (geoError.code === geoError.TIMEOUT || geoError.code === geoError.POSITION_UNAVAILABLE) {
          try {
            if (navigator.permissions?.query) {
              const result = await navigator.permissions.query({ name: "geolocation" as PermissionName });
              if (result.state === "granted") {
                // Permission granted but position fetch failed - still allow access
                setState({
                  status: "granted",
                  lastPosition: null,
                  error: null
                });
                return;
              }
            }
          } catch {
            // Fall through to default handling
          }
        }

        const denied = geoError.code === geoError.PERMISSION_DENIED;
        setState({
          status: denied ? "denied" : "prompt",
          lastPosition: null,
          error: geoError.message
        });
      },
      {
        enableHighAccuracy: false, // Use low accuracy for faster initial response
        timeout: 15000,
        maximumAge: 60000 // Accept cached positions up to 1 minute old
      }
    );
  }, []); // Remove status from deps - use ref instead

  // Initial check and permission watching
  useEffect(() => {
    if (!isBrowser()) return;

    let permissionStatus: PermissionStatus | null = null;

    const queryPermission = async () => {
      if (!navigator.permissions?.query) {
        requestAccess();
        return;
      }

      try {
        permissionStatus = await navigator.permissions.query({ name: "geolocation" as PermissionName });

        const updateStatus = () => {
          if (permissionStatus?.state === "granted") {
            // If permission is granted, immediately set status and try to get position
            setState(prev => ({ ...prev, status: "granted", error: null }));
            requestAccess(true);
          } else if (permissionStatus?.state === "denied") {
            setState(prev => ({ ...prev, status: "denied", error: "Location permission denied" }));
          } else {
            setState(prev => ({ ...prev, status: "prompt", error: null }));
          }
        };

        permissionStatus.onchange = updateStatus;
        updateStatus();
      } catch (e) {
        requestAccess();
      }
    };

    queryPermission();

    // Listen for visibility change (user comes back from settings)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Use ref to get latest status (avoids stale closure)
        if (statusRef.current !== "granted") {
          requestAccess(true);
        }
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
