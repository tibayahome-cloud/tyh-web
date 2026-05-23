import { useEffect, useRef } from "react";

import { useBookingLocationMutation } from "./useBookings";
import { watchPosition, clearWatch, type GeoPosition } from "../libs/geolocation";
import { distanceMeters } from "../utils/location";

const MIN_DISTANCE_METERS = 50;
const MIN_INTERVAL_MS = 60_000; // 1 minute

export const useLiveLocationPublisher = (bookingId: string | null, enabled: boolean) => {
  const mutation = useBookingLocationMutation();
  const lastSentRef = useRef<{ timestamp: number; lat: number; lng: number } | null>(null);
  const isWatchingRef = useRef(false);

  useEffect(() => {
    if (!bookingId || !enabled) {
      if (isWatchingRef.current) {
        clearWatch();
        isWatchingRef.current = false;
      }
      return;
    }

    const handlePosition = (position: GeoPosition) => {
      const { latitude, longitude, timestamp } = position;
      const now = Date.now();
      const last = lastSentRef.current;
      const movedEnough =
        !last ||
        distanceMeters(last.lat, last.lng, latitude, longitude) >= MIN_DISTANCE_METERS ||
        now - last.timestamp >= MIN_INTERVAL_MS;

      if (!movedEnough) return;

      lastSentRef.current = { lat: latitude, lng: longitude, timestamp: now };
      mutation.mutate({
        bookingId,
        input: {
          lat: latitude,
          lng: longitude,
          recordedAt: new Date(timestamp || now).toISOString()
        }
      });
    };

    isWatchingRef.current = true;
    watchPosition(handlePosition, undefined, true);

    return () => {
      if (isWatchingRef.current) {
        clearWatch();
        isWatchingRef.current = false;
      }
    };
  }, [bookingId, enabled, mutation]);
};

export type UseLiveLocationPublisherReturn = void;
