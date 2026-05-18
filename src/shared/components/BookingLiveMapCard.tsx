import { useEffect, useMemo, useState } from "react";

import { Card } from "./Card";
import { MapView } from "./MapView";
import type { MapMarker, MapPolyline } from "./MapView";
import { Skeleton } from "./Skeleton";
import { useBookingDetail, bookingKeys } from "../hooks/useBookings";
import { useBookingStore } from "../stores/useBookingStore";
import { useSocket } from "../hooks/useSocket";
import { useBookingLiveLocation } from "../hooks/useBookingLiveLocation";
import classNames from "classnames";
import { useQueryClient } from "@tanstack/react-query";
import { Navigation } from "lucide-react";

const ACTIVE_TRACKING_STATUSES = new Set([
  "accepted",
  "en_route",
  "nearby",
  "arrived",
  "in_service",
  "completed_by_provider",
  "client_completed",
  "client_confirmed"
]);

const formatTime = (iso?: string | null) => {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  });
};

const formatDurationMs = (ms: number) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  }
  return `${seconds}s`;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const distanceBetweenCoordinates = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371e3;
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lng2 - lng1);
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const stripHtmlTags = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const formatDistanceText = (meters: number) =>
  meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;

export type NavigationStep = {
  id: string;
  instruction: string;
  distanceText?: string | null;
  durationText?: string | null;
};

const STATUS_META: Record<
  string,
  {
    label: string;
    description: string;
    badgeClass: string;
  }
> = {
  broadcasting: {
    label: "Matching",
    description: "We are notifying nearby providers for you.",
    badgeClass: "bg-amber-100 text-amber-700"
  },
  accepted: {
    label: "Accepted",
    description: "Your provider has accepted and is heading your way.",
    badgeClass: "bg-sky-100 text-sky-700"
  },
  en_route: {
    label: "En route",
    description: "Track their live progress to your location.",
    badgeClass: "bg-sky-100 text-sky-700"
  },
  nearby: {
    label: "Arriving soon",
    description: "Your provider is a few minutes away.",
    badgeClass: "bg-emerald-100 text-emerald-700"
  },
  arrived: {
    label: "Arrived",
    description: "Meet your provider and confirm instructions.",
    badgeClass: "bg-emerald-100 text-emerald-700"
  },
  in_service: {
    label: "In service",
    description: "Service is underway. We are tracking duration.",
    badgeClass: "bg-indigo-100 text-indigo-700"
  },
  completed_by_provider: {
    label: "Awaiting confirmation",
    description: "Confirm completion or flag an issue.",
    badgeClass: "bg-purple-100 text-purple-700"
  },
  client_completed: {
    label: "Client confirmed",
    description: "Awaiting payment to fully close the booking.",
    badgeClass: "bg-neutral-200 text-neutral-700"
  },
  client_confirmed: {
    label: "Completed",
    description: "Thanks for confirming. We’re wrapping things up.",
    badgeClass: "bg-neutral-200 text-neutral-700"
  },
  fully_completed: {
    label: "Fully completed",
    description: "Payment received. This booking is closed.",
    badgeClass: "bg-neutral-200 text-neutral-700"
  },
  default: {
    label: "In progress",
    description: "Live updates appear here.",
    badgeClass: "bg-neutral-200 text-neutral-700"
  }
};

const UBER_WAITING_STATUSES = new Set(["accepted", "en_route", "nearby", "arrived", "broadcasting"]);

const formatElapsed = (iso?: string | null) => {
  if (!iso) {
    return null;
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const diffMs = Date.now() - parsed.getTime();
  if (diffMs < 0) {
    return null;
  }
  const minutes = Math.floor(diffMs / 60000);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
  return `${minutes}m`;
};

type BookingLiveMapCardProps = {
  bookingId: string;
  role: "client" | "provider" | "admin";
  height?: number | string;
  className?: string;
  onOpenChat?: (bookingId: string) => void;
  variant?: "default" | "immersive";
  mapOnly?: boolean;
  hideOverlays?: boolean;
  onNavigationSteps?: (steps: NavigationStep[]) => void;
  onProgressUpdate?: (progress: number | null, label: string | null) => void;
};

export const BookingLiveMapCard = ({
  bookingId,
  role,
  height,
  className,
  variant = "default",
  mapOnly = false,
  hideOverlays = false,
  onOpenChat,
  onNavigationSteps,
  onProgressUpdate
}: BookingLiveMapCardProps) => {
  const queryClient = useQueryClient();
  const { data: bookingData, isLoading } = useBookingDetail(bookingId, "detail", { enabled: Boolean(bookingId) });
  const stored = useBookingStore((state) => state.active[bookingId]);
  const upsertBooking = useBookingStore((state) => state.upsertBooking);
  const socket = useSocket();

  const providerInitial = useMemo(() => {
    const points = bookingData?.locations ?? [];
    const providerPoints = points.filter(l => l.who === "provider" && l.lat && l.lng);
    return providerPoints.length ? { lat: providerPoints[providerPoints.length - 1].lat as number, lng: providerPoints[providerPoints.length - 1].lng as number } : null;
  }, [bookingData?.locations]);

  const clientInitial = useMemo(() => {
    const points = bookingData?.locations ?? [];
    const clientPoints = points.filter(l => l.who === "client" && l.lat && l.lng);
    if (clientPoints.length) return { lat: clientPoints[clientPoints.length - 1].lat as number, lng: clientPoints[clientPoints.length - 1].lng as number };
    if (bookingData?.lat && bookingData?.lng) return { lat: bookingData.lat, lng: bookingData.lng };
    return null;
  }, [bookingData?.locations, bookingData?.lat, bookingData?.lng]);

  const { smoothLocation: providerSmooth, rawLocation: providerRaw, heading: providerHeading } = useBookingLiveLocation(bookingId, {
    initialLocation: providerInitial,
    who: "provider"
  });

  const { smoothLocation: clientSmooth, rawLocation: clientRaw } = useBookingLiveLocation(bookingId, {
    initialLocation: clientInitial,
    who: "client"
  });

  const [routePolyline, setRoutePolyline] = useState<MapPolyline | null>(null);
  const [routeSummary, setRouteSummary] = useState<{ durationText: string | null; distanceText: string | null } | null>(
    null
  );
  const [navigationSteps, setNavigationSteps] = useState<NavigationStep[]>([]);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number | null>(null);
  const [countdownLabel, setCountdownLabel] = useState("—");
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [showAllSteps, setShowAllSteps] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (bookingData) {
      upsertBooking(bookingData);
    }
  }, [bookingData, upsertBooking]);

  useEffect(() => {
    setShowAllSteps(false);
  }, [navigationSteps.length]);

  const booking = stored ?? bookingData;

  useEffect(() => {
    if (!booking) {
      return;
    }
    if (!stored) {
      upsertBooking(booking);
    }
  }, [booking, stored, upsertBooking]);



  const providerTrail = useMemo(() => {
    const points = booking?.locations ?? [];
    return points
      .filter((location) => location.who === "provider" && location.lat && location.lng)
      .map((point) => ({
        lat: point.lat as number,
        lng: point.lng as number,
        recordedAt: point.recordedAt
      }));
  }, [booking?.locations]);

  const clientTrail = useMemo(() => {
    const points = booking?.locations ?? [];
    return points
      .filter((location) => location.who === "client" && location.lat && location.lng)
      .map((point) => ({
        lat: point.lat as number,
        lng: point.lng as number,
        recordedAt: point.recordedAt
      }));
  }, [booking?.locations]);

  const providerMarker = useMemo(() => {
    if (providerSmooth) {
      return {
        lat: providerSmooth.lat,
        lng: providerSmooth.lng,
        recordedAt: new Date().toISOString()
      };
    }
    return providerTrail.length ? providerTrail[providerTrail.length - 1] : null;
  }, [providerSmooth, providerTrail]);

  const clientMarker =
    clientTrail.length > 0
      ? clientTrail[clientTrail.length - 1]
      : booking?.lat && booking?.lng
        ? { lat: booking.lat, lng: booking.lng, recordedAt: booking?.acceptedAt }
        : null;
  const destinationMarker =
    booking?.lat && booking?.lng
      ? {
        lat: booking.lat,
        lng: booking.lng
      }
      : null;
  const targetMarker = clientMarker ?? destinationMarker;


  useEffect(() => {
    const origin = providerRaw || providerInitial;
    const dest = clientRaw || clientInitial || destinationMarker;

    if (!origin || !dest) {
      setRoutePolyline(null);
      setRouteSummary(null);
      setNavigationSteps([]);
      setRouteDistanceMeters(null);
      return;
    }
    if (typeof window === "undefined" || typeof google === "undefined" || !google.maps?.DirectionsService) {
      return;
    }
    let cancelled = false;
    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: dest.lat, lng: dest.lng },
        travelMode: google.maps.TravelMode.DRIVING
      },
      (result, status) => {
        if (cancelled) return;
        if (status === "OK" && result?.routes?.length) {
          const route = result.routes[0];
          const pathPoints = (route.overview_path ?? []).map((point) => ({ lat: point.lat(), lng: point.lng() }));
          if (pathPoints.length && booking) {
            setRoutePolyline({
              id: `${booking.id}-directions`,
              path: pathPoints,
              color: "#0ea5e9",
              weight: 6,
              variant: "route"
            });
          }
          const leg = route.legs?.[0];
          if (leg) {
            setNavigationSteps(
              (leg.steps ?? []).map((step, index) => ({
                id: `${booking?.id ?? "route"}-step-${index}`,
                instruction: stripHtmlTags(step.instructions || (step as any).html_instructions || "Continue straight"),
                distanceText: step.distance?.text ?? null,
                durationText: step.duration?.text ?? null
              }))
            );
            setRouteDistanceMeters(leg.distance?.value ?? null);
          } else {
            setNavigationSteps([]);
            setRouteDistanceMeters(null);
          }
          setRouteSummary({
            durationText: leg?.duration?.text ?? null,
            distanceText: leg?.distance?.text ?? null
          });
        } else {
          setRoutePolyline(null);
          setRouteSummary(null);
          setNavigationSteps([]);
          setRouteDistanceMeters(null);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [
    providerRaw,
    clientRaw,
    destinationMarker?.lat,
    destinationMarker?.lng,
    booking?.id,
    onNavigationSteps,
    onProgressUpdate
  ]);

  useEffect(() => {
    const estimateMinutes = booking?.estimateDurationMinutes;
    if (!booking || !estimateMinutes) {
      setCountdownLabel("—");
      return;
    }
    const baseIso =
      booking.serviceStartedAt ?? booking.arrivedAt ?? booking.acceptedAt ?? booking.clientConfirmedAt ?? booking.createdAt;
    if (!baseIso) {
      setCountdownLabel(`${estimateMinutes}m`);
      return;
    }
    const endTime = new Date(baseIso).getTime() + estimateMinutes * 60_000;
    const updateCountdown = () => {
      const remaining = endTime - Date.now();
      setCountdownLabel(remaining <= 0 ? "0m" : formatDurationMs(remaining));
    };
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1_000);
    return () => window.clearInterval(interval);
  }, [
    booking,
    booking?.estimateDurationMinutes,
    booking?.serviceStartedAt,
    booking?.arrivedAt,
    booking?.acceptedAt,
    booking?.clientConfirmedAt,
    booking?.createdAt
  ]);

  const statusKey = booking?.status ?? "default";
  const statusLabel = statusKey.replace(/_/g, " ");
  const statusMeta = STATUS_META[statusKey] ?? STATUS_META.default;
  const timerLabel = formatElapsed(booking?.serviceStartedAt) ?? formatElapsed(booking?.acceptedAt);
  const estimateLabel = booking?.estimateDurationMinutes ? `${booking.estimateDurationMinutes} mins` : null;
  const providerName = booking?.provider?.fullName ?? null;
  const destinationLabel = booking?.addressText || booking?.service?.name || "Destination";
  const etaLabel = routeSummary?.durationText ?? estimateLabel ?? null;
  const remainingDistanceMeters =
    providerMarker && targetMarker
      ? distanceBetweenCoordinates(providerMarker.lat, providerMarker.lng, targetMarker.lat, targetMarker.lng)
      : null;
  const progressPercent =
    routeDistanceMeters && remainingDistanceMeters !== null && routeDistanceMeters > 0
      ? Math.max(
        0,
        Math.min(100, ((routeDistanceMeters - remainingDistanceMeters) / routeDistanceMeters) * 100)
      )
      : null;
  const progressLabel =
    progressPercent !== null
      ? `${Math.round(progressPercent)}% along route`
      : routeSummary?.distanceText ??
      (remainingDistanceMeters ? `${formatDistanceText(remainingDistanceMeters)} remaining` : null);

  useEffect(() => {
    onNavigationSteps?.(navigationSteps);
  }, [navigationSteps, onNavigationSteps]);

  useEffect(() => {
    onProgressUpdate?.(progressPercent, progressLabel);
  }, [progressPercent, progressLabel, onProgressUpdate]);

  const stepsToShow = showAllSteps ? navigationSteps : navigationSteps.slice(0, 3);
  const navigationToggleLabel = showAllSteps ? "Show less" : "View full route";
  const isImmersive = variant === "immersive";
  const navigationGuide =
    mapOnly || navigationSteps.length === 0 ? null : (
      <div className="rounded-2xl border border-slate-100 bg-white/90 px-5 py-4 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Navigation</p>
            <p className="text-base font-semibold text-slate-900">{progressLabel ?? "Routing provider"}</p>
          </div>
          {progressPercent !== null && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {Math.round(progressPercent)}% route
            </span>
          )}
        </div>
        {progressPercent !== null && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-emerald-500 transition-all duration-150 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
        )}
        <div className="mt-4 space-y-3">
          {stepsToShow.map((step, index) => (
            <div key={step.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
                {index === 0 ? "Next step" : `Step ${index + 1}`}
              </p>
              <p className="text-sm font-semibold text-slate-900">{step.instruction}</p>
              {(step.distanceText || step.durationText) && (
                <p className="text-xs text-slate-500">
                  {[step.distanceText, step.durationText].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          ))}
        </div>
        {navigationSteps.length > 3 && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setShowAllSteps((prev) => !prev)}
              className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-600"
            >
              {navigationToggleLabel}
            </button>
          </div>
        )}
      </div>
    );

  if (isLoading && !booking) {
    return (
      <Card title="Live booking tracker" className={className}>
        <div className="space-y-4">
          <Skeleton height={20} width="45%" rounded="pill" />
          <Skeleton height={14} width="65%" />
          <Skeleton height={340} rounded="lg" />
        </div>
      </Card>
    );
  }

  if (!booking) {
    return null;
  }

  const markers: MapMarker[] = [];
  const isClientView = role === "client";
  const isProviderView = role === "provider";

  if (destinationMarker) {
    markers.push({
      id: `${booking.id}-destination`,
      position: destinationMarker,
      label: "Destination",
      color: "#0ea5e9",
      zIndex: 1,
      variant: "destination",
      isFocused: isProviderView,
      pulse: false
    });
  }
  if (clientSmooth || clientMarker) {
    markers.push({
      id: `${booking.id}-client`,
      position: clientSmooth || (clientMarker as google.maps.LatLngLiteral),
      label: role === "provider" ? "Client" : "You",
      color: role === "provider" ? "#22c55e" : "#2563eb",
      zIndex: 3,
      variant: "client",
      isFocused: !isProviderView && !isClientView,
      pulse: !isProviderView
    });
  }
  if (providerSmooth || providerMarker) {
    markers.push({
      id: `${booking.id}-provider`,
      position: providerSmooth || (providerMarker as google.maps.LatLngLiteral),
      label: role === "provider" ? "You" : "Provider",
      color: "#f97316",
      zIndex: 4,
      variant: "provider",
      isFocused: isClientView,
      pulse: true,
      heading: providerHeading ?? undefined
    });
  }

  const polyline: MapPolyline | null =
    providerTrail.length > 1
      ? {
        id: `${booking.id}-provider-route`,
        path: providerTrail.map((point) => ({ lat: point.lat, lng: point.lng })),
        color: "#f97316",
        weight: 5,
        variant: "trail"
      }
      : null;

  const clientPolyline: MapPolyline | null =
    clientTrail.length > 1
      ? {
        id: `${booking.id}-client-route`,
        path: clientTrail.map((point) => ({ lat: point.lat, lng: point.lng })),
        color: "#22c55e",
        weight: 3,
        variant: "trail"
      }
      : null;

  // Use the calculated routePolyline (from Directions API) if available, otherwise fallback to direct line
  const displayRoute: MapPolyline | null = routePolyline
    ? {
      ...routePolyline,
      color: "#2563eb",
      weight: 6,
      borderColor: "#1e40af",
      borderWeight: 2,
    }
    : (providerMarker && targetMarker
      ? {
        id: `${booking.id}-to-destination`,
        path: [
          { lat: providerMarker.lat, lng: providerMarker.lng },
          { lat: targetMarker.lat, lng: targetMarker.lng }
        ],
        color: "#94a3b8", // Grey dashed line for fallback
        weight: 4,
        variant: "direct",
        dashArray: "10,10" // Make it dashed to indicate it's not a real road route
      }
      : null);

  const center =
    providerMarker ??
    clientMarker ??
    destinationMarker ?? {
      lat: 0,
      lng: 0
    };

  const computedHeight =
    height ??
    (isImmersive && mapOnly ? "100%" : role === "admin"
      ? 360
      : Math.max(480, Math.round(((viewportHeight ?? 720) * 0.8))));


  const overlayHeadline = providerName
    ? `${providerName} ${isClientView ? "is on the way" : "heading to the client"}`
    : "Awaiting provider update";
  const isUberWaiting = isClientView && UBER_WAITING_STATUSES.has(status ?? "");
  const providerInitials = (providerName ?? "Driver")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const classicOverlay = (
    <div className="flex h-full flex-col justify-between p-4">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-xl"
        >
          <span className="h-4 w-4">
            <span className="block h-0.5 w-4 rounded bg-slate-600" />
            <span className="mt-1 block h-0.5 w-4 rounded bg-slate-600" />
            <span className="mt-1 block h-0.5 w-3 rounded bg-slate-600" />
          </span>
        </button>
        <div className="pointer-events-auto rounded-3xl bg-white/95 px-4 py-2 text-left shadow-2xl ring-1 ring-black/5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-600">
            <Navigation className="h-3.5 w-3.5" />
            <span>{etaLabel ?? "Live"}</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-900">{destinationLabel}</p>
          {routeSummary?.distanceText && <p className="text-xs text-slate-500">{routeSummary.distanceText}</p>}
        </div>
      </div>
      <div className="pointer-events-none rounded-[28px] bg-white/90 px-4 py-3 shadow-xl ring-1 ring-black/5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
          {role === "provider" ? "Heading to client" : "Ride in progress"}
        </p>
        <p className="text-base font-semibold text-slate-900">{overlayHeadline}</p>
        <p className="text-sm text-slate-500">{statusMeta.description}</p>
      </div>
    </div>
  );

  const immersiveOverlay = (
    <div className="flex h-full flex-col justify-between px-4 py-5">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-xl"
        >
          <span className="h-4 w-4">
            <span className="block h-0.5 w-4 rounded bg-slate-600" />
            <span className="mt-1 block h-0.5 w-4 rounded bg-slate-600" />
            <span className="mt-1 block h-0.5 w-3 rounded bg-slate-600" />
          </span>
        </button>
        <div className="pointer-events-none rounded-3xl bg-white/95 px-4 py-3 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Your provider</p>
          <p className="text-base font-semibold text-slate-900">{providerName ?? "Matching provider"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {etaLabel && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                ETA {etaLabel}
              </span>
            )}
            <span className="rounded-full bg-slate-900/90 px-3 py-1 text-xs font-semibold text-white">
              {statusMeta.label}
            </span>
            {timerLabel && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {timerLabel}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="pointer-events-none rounded-[30px] bg-white/95 px-4 py-4 shadow-2xl ring-1 ring-black/5">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Destination</p>
        <p className="mt-1 text-base font-semibold text-slate-900">{destinationLabel}</p>
        <p className="text-sm text-slate-500">{statusMeta.description}</p>
      </div>
    </div>
  );

  const uberOverlay = (
    <div className="flex h-full flex-col justify-between p-4">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-xl"
        >
          <span className="h-4 w-4">
            <span className="block h-0.5 w-4 rounded bg-slate-600" />
            <span className="mt-1 block h-0.5 w-4 rounded bg-slate-600" />
            <span className="mt-1 block h-0.5 w-3 rounded bg-slate-600" />
          </span>
        </button>
        <div className="pointer-events-none rounded-3xl bg-white/95 px-4 py-3 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Your driver</p>
          <p className="text-base font-semibold text-slate-900">{providerName ?? "Matching provider"}</p>
          {etaLabel && <p className="text-xs text-slate-500">{`ETA ${etaLabel}`}</p>}
        </div>
      </div>
      <div className="pointer-events-none rounded-[28px] bg-white/90 px-4 py-3 shadow-xl ring-1 ring-black/5">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Ride status</p>
        <p className="text-xl font-semibold text-slate-900">{statusMeta.label}</p>
        <p className="text-sm text-slate-500">{statusMeta.description}</p>
      </div>
    </div>
  );

  const mapOverlay = hideOverlays ? null : (isUberWaiting ? uberOverlay : isImmersive ? immersiveOverlay : classicOverlay);

  const uberInfoCard = isUberWaiting ? (
    <div className="rounded-[30px] border border-slate-100 bg-white/95 px-5 py-5 shadow-xl ring-1 ring-black/5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-lg font-bold text-white">
            {providerInitials}
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Driver</p>
            <p className="text-lg font-semibold text-slate-900">{providerName ?? "Matching provider"}</p>
            <p className="text-xs text-slate-500">{routeSummary?.distanceText ?? "Vehicle info pending"}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">ETA</span>
          <p className="text-xl font-semibold text-slate-900">{etaLabel ?? "Live"}</p>
          <button
            type="button"
            onClick={() => onOpenChat?.(bookingId)}
            className="rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow-lg"
          >
            Message driver
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (isImmersive && mapOnly) {
    return (
      <MapView
        center={{ lat: center.lat, lng: center.lng }}
        markers={markers}
        polylines={[displayRoute, polyline, clientPolyline].filter(Boolean) as MapPolyline[]}
        height={computedHeight}
        intent={role}
        autoFit
        immersive={isImmersive}
        overlay={mapOverlay}
        emptyLabel="No live location yet. We will show updates once tracking begins."
        className={className}
      />
    );
  }

  if (isImmersive) {
    return (
      <div className={classNames("space-y-5", className)}>
        <div className="rounded-[34px] bg-gradient-to-br from-emerald-50/80 via-white to-white p-2 shadow-inner">
          <MapView
            center={{ lat: center.lat, lng: center.lng }}
            markers={markers}
            polylines={[displayRoute, polyline, clientPolyline].filter(Boolean) as MapPolyline[]}
            height={computedHeight}
            intent={role}
            autoFit
            overlay={mapOverlay}
            emptyLabel="No live location yet. We will show updates once tracking begins."
            className="rounded-[28px] border-none shadow-xl"
          />
        </div>
        {!hideOverlays && uberInfoCard}
        {!hideOverlays && navigationGuide}
        <div className="rounded-[30px] border border-slate-100/80 bg-white/95 px-5 py-5 shadow-xl ring-1 ring-black/5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-500">
                {booking.service?.name ?? "Live booking"}
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{statusMeta.label}</p>
              <p className="text-sm text-slate-500">{statusMeta.description}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {etaLabel && (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  ETA {etaLabel}
                </span>
              )}
              {timerLabel && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Timer {timerLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className={classNames("space-y-6", className)}>
      <div className="rounded-[34px] bg-gradient-to-br from-emerald-50/70 via-white to-white p-2">
        <MapView
          center={{ lat: center.lat, lng: center.lng }}
          markers={markers}
          polylines={[displayRoute, polyline, clientPolyline].filter(Boolean) as MapPolyline[]}
          height={computedHeight}
          intent={role}
          autoFit
          overlay={mapOverlay}
          emptyLabel="No live location yet. We will show updates once tracking begins."
          className="rounded-[28px] border-none shadow-xl"
        />
      </div>
      {uberInfoCard}
      {navigationGuide}

      <div className="rounded-[28px] border border-slate-100/80 bg-white/95 px-5 py-5 shadow-inner">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-500">
              {booking.service?.name ?? "Service"}
            </p>
            <h3 className="text-xl font-semibold text-neutral-900">
              {providerName ? `With ${providerName}` : "Waiting for provider confirmation"}
            </h3>
            <p className="text-sm text-neutral-500">{statusMeta.description}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={classNames("rounded-full px-3 py-1 text-xs font-semibold", statusMeta.badgeClass)}>
              {statusMeta.label}
            </span>
            {timerLabel && (
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
                {role === "provider" ? "On site" : "Elapsed"} · {timerLabel}
              </span>
            )}
            {etaLabel && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                ETA {etaLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <InfoStat label="Status" value={statusLabel} />
        <InfoStat label="Provider update" value={formatTime(providerMarker?.recordedAt)} />
        <InfoStat
          label="Route ETA"
          value={routeSummary?.durationText ?? "—"}
          helper={routeSummary?.distanceText ?? undefined}
        />
        <InfoStat label="Service timer" value={countdownLabel} />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p className="text-xs uppercase tracking-wide text-slate-400">Destination</p>
        <p className="text-sm font-semibold text-slate-900">{booking.addressText || "Hidden for privacy"}</p>
        <div className="mt-2 text-sm">
          {role === "provider"
            ? "Share your live location as you travel to the client. Arrive within the ETA to keep your reliability score high."
            : "We will notify you as soon as the provider is nearby. Keep the app open to chat or share additional directions."}
        </div>
      </div>

    </Card>
  );
};

const InfoStat = ({ label, value, helper }: { label: string; value: string; helper?: string }) => (
  <div className="rounded-2xl border border-slate-100 bg-white/90 px-4 py-3 shadow-inner">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
    {helper && <p className="text-xs text-slate-500">{helper}</p>}
  </div>
);
