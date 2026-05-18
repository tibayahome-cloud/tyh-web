import { useEffect, useState, useRef } from "react";
import { useSocket } from "./useSocket";

export interface LiveLocation {
    lat: number;
    lng: number;
    who: "client" | "provider";
    recorded_at: string;
}

/**
 * Hook to subscribe to real-time location updates for a booking.
 * Implements linear interpolation for smooth marker motion.
 */
export const useBookingLiveLocation = (
    bookingId: string | null,
    {
        initialLocation,
        who: filterWho
    }: {
        initialLocation?: { lat: number; lng: number } | null;
        who?: "client" | "provider";
    } = {}
) => {
    const socket = useSocket();
    const [rawLocation, setRawLocation] = useState<LiveLocation | null>(null);
    const [smoothLocation, setSmoothLocation] = useState<{ lat: number; lng: number } | null>(
        initialLocation || null
    );
    const [heading, setHeading] = useState<number | null>(null);

    // Animation state
    const lastTarget = useRef<{ lat: number; lng: number } | null>(initialLocation || null);
    const currentPos = useRef<{ lat: number; lng: number } | null>(initialLocation || null);
    const animationFrame = useRef<number>();

    useEffect(() => {
        if (!socket || !bookingId) return;

        const room = `booking:${bookingId}`;
        socket.emit("join_room", { room });

        const handleLocation = (data: any) => {
            if (data.id === bookingId || data.booking_id === bookingId) {
                if (filterWho && data.who !== filterWho) return;

                const newLoc: LiveLocation = {
                    lat: data.lat,
                    lng: data.lng,
                    who: data.who,
                    recorded_at: data.recorded_at
                };
                setRawLocation(newLoc);
                lastTarget.current = { lat: newLoc.lat, lng: newLoc.lng };

                if (!currentPos.current) {
                    currentPos.current = { lat: newLoc.lat, lng: newLoc.lng };
                    setSmoothLocation(currentPos.current);
                }
            }
        };

        socket.on("model.booking.location", handleLocation);

        return () => {
            socket.off("model.booking.location", handleLocation);
            socket.emit("leave_room", { room });
            if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
        };
    }, [socket, bookingId, filterWho]);

    // Linear Interpolation (Lerp) for smooth motion
    useEffect(() => {
        const animate = () => {
            if (currentPos.current && lastTarget.current) {
                const latDiff = lastTarget.current.lat - currentPos.current.lat;
                const lngDiff = lastTarget.current.lng - currentPos.current.lng;

                // Glide faster if further away, but always smooth
                const step = 0.05;

                if (Math.abs(latDiff) > 0.0000001 || Math.abs(lngDiff) > 0.0000001) {
                    const nextLat = currentPos.current.lat + latDiff * step;
                    const nextLng = currentPos.current.lng + lngDiff * step;

                    // Simple heading based on movement delta
                    // Note: In real scenarios, use spherical geometry if distance is large
                    // but for local navigation, atan2 is sufficient.
                    const newHeading = Math.atan2(lngDiff, latDiff) * (180 / Math.PI);
                    setHeading(newHeading);

                    currentPos.current = {
                        lat: nextLat,
                        lng: nextLng
                    };
                    setSmoothLocation({ ...currentPos.current });
                }
            }
            animationFrame.current = requestAnimationFrame(animate);
        };

        animationFrame.current = requestAnimationFrame(animate);
        return () => {
            if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
        };
    }, []);

    return {
        rawLocation,
        smoothLocation,
        heading,
        isTracking: !!rawLocation
    };
};
