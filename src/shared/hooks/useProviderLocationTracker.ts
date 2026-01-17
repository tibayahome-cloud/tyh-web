import { useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import { updateProviderLocation } from "../libs/providers";
import { useLocationAccess } from "./useLocationAccess";
import { distanceMeters } from "../utils/location";

const MIN_DISTANCE_METERS = 50;
const MIN_INTERVAL_MS = 60_000; // 1 minute for background/optimization tracking

/**
 * Hook to track provider location for broadcast optimization.
 * Runs whenever the provider is available and has granted location access.
 */
export const useProviderLocationTracker = (isAvailable: boolean) => {
    const { user, roles } = useAuth();
    const isProvider = roles.includes("provider");
    const { isGranted } = useLocationAccess();
    const lastSentRef = useRef<{ timestamp: number; lat: number; lng: number } | null>(null);
    const watchIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (!isProvider || !isAvailable || !isGranted || typeof navigator === "undefined" || !navigator.geolocation) {
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

                const movedEnough = !last || distanceMeters(last.lat, last.lng, latitude, longitude) >= MIN_DISTANCE_METERS || (now - last.timestamp >= MIN_INTERVAL_MS);

                if (movedEnough && user?.id) {
                    lastSentRef.current = { lat: latitude, lng: longitude, timestamp: now };
                    updateProviderLocation(user.id, latitude, longitude).catch(() => {
                        // best effort telemetry update
                    });
                }
            },
            (error) => {
                console.warn("Provider location tracking error:", error);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 30000,
                timeout: 15000
            }
        );

        return () => {
            if (watchIdRef.current !== null && navigator.geolocation) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
        };
    }, [isProvider, isAvailable, isGranted, user?.id]);
};
