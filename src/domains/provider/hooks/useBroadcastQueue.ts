import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useSocket } from "../../../shared/hooks/useSocket";
import { fetchBooking } from "../../../shared/libs/bookings";
import { bookingKeys } from "../../../shared/hooks/useBookings";
import type { Booking } from "../../../shared/schemas/booking";

export type BroadcastOffer = {
  booking: Booking;
  wave: number;
  radiusM: number;
  candidateCount: number;
  emergency?: boolean;
  distanceM?: number | null;
  receivedAt: string;
};

const BROADCASTABLE_STATUSES = new Set(["requested", "broadcasting"]);

const coerceBookingId = (payload: Record<string, unknown>): string | null => {
  const raw = payload.booking_id ?? payload.id;
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw;
  }
  if (typeof raw === "number") {
    return raw.toString();
  }
  return null;
};

const normalizeIdList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (typeof entry === "string" && entry.trim().length > 0) {
        return entry.trim();
      }
      if (typeof entry === "number") {
        return entry.toString();
      }
      return null;
    })
    .filter((entry): entry is string => Boolean(entry));
};

const matchesTargets = ({
  payload,
  userId,
  providerProfileId
}: {
  payload: Record<string, unknown>;
  userId?: string | null;
  providerProfileId?: string | null;
}) => {
  const queueUserIds = normalizeIdList(payload.provider_user_ids);
  const queueProfileIds = normalizeIdList(payload.provider_profile_ids);
  const ambiguousIds = normalizeIdList(payload.provider_ids);
  if (userId && (queueUserIds.includes(userId) || ambiguousIds.includes(userId))) {
    return true;
  }
  if (providerProfileId && (queueProfileIds.includes(providerProfileId) || ambiguousIds.includes(providerProfileId))) {
    return true;
  }
  return queueUserIds.length === 0 && queueProfileIds.length === 0 && ambiguousIds.length === 0;
};

export const useBroadcastQueue = (userId?: string | null, providerProfileId?: string | null) => {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<BroadcastOffer[]>([]);

  const dismiss = useCallback((bookingId: string) => {
    setQueue((prev) => prev.filter((offer) => offer.booking.id !== bookingId));
  }, []);

  useEffect(() => {
    if (!socket || (!userId && !providerProfileId)) {
      return;
    }

    const handleBroadcast = async (payload: Record<string, unknown>) => {
      const bookingIdRaw = payload.booking_id ?? payload.id;
      if (!bookingIdRaw) {
        return;
      }
      const bookingId = String(bookingIdRaw);
      if (!matchesTargets({ payload, userId, providerProfileId })) {
        return;
      }
      try {
        const booking = await queryClient.fetchQuery({
          queryKey: bookingKeys.detail(bookingId),
          queryFn: () => fetchBooking(bookingId, "detail")
        });
        setQueue((prev) => {
          if (prev.some((offer) => offer.booking.id === booking.id)) {
            return prev;
          }
          const distanceMap =
            typeof payload.distance_m === "object" && payload.distance_m !== null
              ? (payload.distance_m as Record<string, unknown>)
              : {};
          const providerDistanceKey = String(userId);
          const rawDistance = distanceMap[providerDistanceKey];
          const distanceValue = typeof rawDistance === "number" ? (rawDistance as number) : undefined;
          const offer: BroadcastOffer = {
            booking,
            wave: Number(payload.wave ?? 1) || 1,
            radiusM: Number(payload.radius_m ?? 0) || 0,
            candidateCount: Number(payload.candidate_count ?? 0) || 0,
            emergency: Boolean(payload.emergency),
            distanceM: distanceValue ?? null,
            receivedAt: new Date().toISOString()
          };
          if (typeof window !== "undefined" && window.console) {
            window.console.info(
              "[broadcast] Offer received",
              {
                bookingId: booking.id,
                service: booking.service?.name,
                status: booking.status,
                wave: offer.wave,
                radiusM: offer.radiusM,
                distanceM: offer.distanceM,
                queueSize: prev.length + 1
              }
            );
          }
          return [...prev, offer];
        });
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("Failed to load broadcast booking", bookingId, error);
        }
      }
    };
    socket.on("model.booking.broadcasted", handleBroadcast);
    return () => {
      socket.off("model.booking.broadcasted", handleBroadcast);
    };
  }, [socket, userId, providerProfileId, queryClient]);

  useEffect(() => {
    if (!socket) {
      return;
    }
    const dismissEvents = ["model.booking.accepted", "model.booking.cancelled"] as const;
    const dismissHandlers = dismissEvents.map((eventName) => {
      const handler = (payload: Record<string, unknown> = {}) => {
        const bookingId = coerceBookingId(payload);
        if (!bookingId) {
          return;
        }
        dismiss(bookingId);
      };
      socket.on(eventName, handler);
      return { eventName, handler };
    });
    const handleStatus = (payload: Record<string, unknown> = {}) => {
      const bookingId = coerceBookingId(payload);
      if (!bookingId) {
        return;
      }
      const status = (payload.status ?? payload.new_status) as string | undefined;
      if (!status) {
        return;
      }
      if (!BROADCASTABLE_STATUSES.has(status)) {
        dismiss(bookingId);
      }
    };
    socket.on("model.booking.status", handleStatus);
    return () => {
      dismissHandlers.forEach(({ eventName, handler }) => socket.off(eventName, handler));
      socket.off("model.booking.status", handleStatus);
    };
  }, [dismiss, socket]);

  return {
    queue,
    dismiss,
    clear: () => setQueue([])
  };
};

export type UseBroadcastQueueReturn = ReturnType<typeof useBroadcastQueue>;
