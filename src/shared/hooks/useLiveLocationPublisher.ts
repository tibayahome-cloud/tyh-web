import { useEffect, useRef } from "react";

import { useBookingLocationMutation } from "./useBookings";

import { distanceMeters } from "../utils/location";

const MIN_DISTANCE_METERS = 50;
const MIN_INTERVAL_MS = 60_000; // 1 minute


export const useLiveLocationPublisher = (bookingId: string | null, enabled: boolean) => {
  const mutation = useBookingLocationMutation();
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<{ timestamp: number; lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!bookingId || !enabled || typeof navigator === "undefined" || !navigator.geolocation) {
      if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const now = Date.now();
        const last = lastSentRef.current;
        const movedEnough =
          !last || distanceMeters(last.lat, last.lng, latitude, longitude) >= MIN_DISTANCE_METERS || now - last.timestamp >= MIN_INTERVAL_MS;
        if (!movedEnough) {
          return;
        }
        lastSentRef.current = { lat: latitude, lng: longitude, timestamp: now };
        mutation.mutate({
          bookingId,
          input: {
            lat: latitude,
            lng: longitude,
            recordedAt: new Date(position.timestamp || now).toISOString()
          }
        });
      },
      () => {
        // best-effort; do nothing on error
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000
      }
    );

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [bookingId, enabled, mutation]);
};

export type UseLiveLocationPublisherReturn = void;
