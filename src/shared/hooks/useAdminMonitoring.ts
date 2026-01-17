import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import api from "../libs/api";
import { useSocket } from "./useSocket";

export type MonitoringLocation = {
  lat: number | null;
  lng: number | null;
  recordedAt: string | null;
};

export type MonitoringBooking = {
  id: string;
  status: string;
  service: {
    id: string;
    name: string | null;
  } | null;
  client: {
    id: string;
    name: string | null;
  } | null;
  provider: {
    id: string | null;
    name: string | null;
  } | null;
  destination: {
    lat: number | null;
    lng: number | null;
    address_text?: string | null;
  } | null;
  providerLocation: MonitoringLocation | null;
  clientLocation: MonitoringLocation | null;
  estimateDurationMinutes: number | null;
  distanceToDestinationM: number | null;
  priorityScore: number | null;
  timestamps: Record<string, string | null>;
  meta: Record<string, unknown>;
};

export type MonitoringMapPayload = {
  map: {
    center: { lat: number; lng: number } | null;
    zoom: number;
  };
  bookings: MonitoringBooking[];
};

type MonitoringParams = {
  statuses?: string[];
  limit?: number;
  zoom?: number;
};

const normalizeLocation = (value: unknown): MonitoringLocation | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const lat = typeof value.lat === "number" ? value.lat : null;
  const lng = typeof value.lng === "number" ? value.lng : null;
  const recordedAt =
    typeof value.recorded_at === "string"
      ? value.recorded_at
      : typeof value.recordedAt === "string"
        ? value.recordedAt
        : null;
  if (lat === null || lng === null) {
    return null;
  }
  return { lat, lng, recordedAt };
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const mapMonitoringResponse = (payload: unknown): MonitoringMapPayload => {
  const root = toRecord(payload);
  const data = toRecord(root.data ?? root);
  const bookingsRaw = Array.isArray(data.bookings) ? data.bookings : [];
  const bookings = bookingsRaw.map((entry) => {
    const booking = toRecord(entry);
    const serviceRaw = toRecord(booking.service);
    const clientRaw = toRecord(booking.client);
    const providerRaw = toRecord(booking.provider);
    const destinationRaw = toRecord(booking.destination);

    return {
      id: String(booking.id),
      status: typeof booking.status === "string" ? booking.status : "unknown",
      service: booking.service
        ? {
          id: String(serviceRaw.id),
          name: serviceRaw.name && typeof serviceRaw.name === "string" ? serviceRaw.name : null
        }
        : null,
      client: booking.client
        ? {
          id: String(clientRaw.id),
          name: clientRaw.name && typeof clientRaw.name === "string" ? clientRaw.name : null
        }
        : null,
      provider: booking.provider
        ? {
          id: providerRaw.id ? String(providerRaw.id) : null,
          name: providerRaw.name && typeof providerRaw.name === "string" ? providerRaw.name : null
        }
        : null,
      destination:
        booking.destination && typeof destinationRaw.lat === "number" && typeof destinationRaw.lng === "number"
          ? {
            lat: destinationRaw.lat,
            lng: destinationRaw.lng,
            address_text:
              typeof destinationRaw.address_text === "string"
                ? destinationRaw.address_text
                : typeof destinationRaw.addressText === "string"
                  ? destinationRaw.addressText
                  : null
          }
          : null,
      providerLocation: normalizeLocation(booking.provider_location ?? booking.providerLocation),
      clientLocation: normalizeLocation(booking.client_location ?? booking.clientLocation),
      estimateDurationMinutes:
        typeof booking.estimate_duration_minutes === "number" ? booking.estimate_duration_minutes : null,
      distanceToDestinationM:
        typeof booking.distance_to_destination_m === "number" ? booking.distance_to_destination_m : null,
      priorityScore: typeof booking.priority_score === "number" ? booking.priority_score : null,
      timestamps: toRecord(booking.timestamps),
      meta: toRecord(booking.meta ?? booking.meta_data)
    };
  });
  const mapInfo = toRecord(data.map);
  const mapCenterRaw = toRecord(mapInfo.center);
  const mapZoom =
    typeof mapInfo.zoom === "number"
      ? mapInfo.zoom
      : typeof mapInfo.default_zoom === "number"
        ? mapInfo.default_zoom
        : 12;
  return {
    map: {
      center:
        typeof mapCenterRaw.lat === "number" && typeof mapCenterRaw.lng === "number"
          ? { lat: mapCenterRaw.lat, lng: mapCenterRaw.lng }
          : null,
      zoom: mapZoom
    },
    bookings
  };
};

export const useAdminMonitoringFeed = (params: MonitoringParams = {}) => {
  const socket = useSocket();
  const query = useQuery({
    queryKey: ["admin", "monitoring", "live-map", params],
    queryFn: async () => {
      const response = await api.get("/admin/analytics/monitoring/live-map", {
        params: {
          status: params.statuses?.join(","),
          limit: params.limit,
          zoom: params.zoom
        }
      });
      return mapMonitoringResponse(response.data);
    },
    staleTime: 30_000,
    refetchInterval: 45_000
  });

  useEffect(() => {
    if (!socket) {
      return;
    }
    const events = [
      "model.booking.location",
      "model.booking.status",
      "model.booking.escalation",
      "model.booking.accepted",
      "model.booking.reassigned"
    ];
    const handleUpdate = () => {
      void query.refetch();
    };
    events.forEach((event) => socket.on(event, handleUpdate));
    return () => {
      events.forEach((event) => socket.off(event, handleUpdate));
    };
  }, [socket, query]);

  return query;
};
