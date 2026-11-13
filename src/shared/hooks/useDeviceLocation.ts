import { useCallback, useEffect, useRef, useState } from "react";

export type DeviceLocationStatus = "idle" | "asking" | "found" | "denied" | "unavailable" | "timeout";

export type DeviceLocation = {
  status: DeviceLocationStatus;
  coords: { lat: number; lng: number } | null;
  /** How far off the reading may be, in metres. A reading worse than a few hundred metres is worth confirming on a map. */
  accuracyM: number | null;
  ask: () => void;
};

/**
 * The device's position, the way a ride app reads it. It asks once when `auto` is true and again whenever `ask` is called.
 * Nothing is kept: the position lives in this component's state and goes to the API only when the person confirms it.
 */
export const useDeviceLocation = (auto: boolean): DeviceLocation => {
  const [status, setStatus] = useState<DeviceLocationStatus>("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const ask = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    setStatus("asking");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!alive.current) return;
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setAccuracyM(Number.isFinite(position.coords.accuracy) ? Math.round(position.coords.accuracy) : null);
        setStatus("found");
      },
      (failure) => {
        if (!alive.current) return;
        setStatus(failure.code === failure.PERMISSION_DENIED ? "denied" : failure.code === failure.TIMEOUT ? "timeout" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }, []);

  const asked = useRef(false);
  useEffect(() => {
    if (auto && !asked.current) {
      asked.current = true;
      ask();
    }
  }, [auto, ask]);

  return { status, coords, accuracyM, ask };
};
