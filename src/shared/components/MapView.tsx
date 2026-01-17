import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import classNames from "classnames";
import { GoogleMap, PolylineF, useGoogleMap, useJsApiLoader } from "@react-google-maps/api";
import type { Libraries } from "@react-google-maps/api";

import { MAP_LIBRARIES } from "../constants/maps";

type LatLngLiteral = google.maps.LatLngLiteral;


export type MapMarker = {
  id: string;
  position: LatLngLiteral;
  label?: string;
  color?: string;
  zIndex?: number;
  variant?: "client" | "provider" | "destination" | "admin" | "neutral" | "alert";
  isFocused?: boolean;
  pulse?: boolean;
};

export type MapPolyline = {
  id: string;
  path: LatLngLiteral[];
  color?: string;
  weight?: number;
  variant?: "route" | "trail" | "direct" | "ghost";
  borderColor?: string;
  borderWeight?: number;
  dashArray?: string;
};

type MapViewProps = {
  center?: LatLngLiteral;
  zoom?: number;
  height?: number | string;
  markers?: MapMarker[];
  polylines?: MapPolyline[];
  className?: string;
  emptyLabel?: string;
  mapId?: string;
  intent?: "client" | "provider" | "admin";
  autoFit?: boolean;
  immersive?: boolean;
  overlay?: ReactNode;
  padding?: number;
};

const defaultCenter: LatLngLiteral = { lat: 0, lng: 0 };

const MARKER_COLORS: Record<NonNullable<MapMarker["variant"]>, string> = {
  provider: "#ff8a00",
  client: "#2563eb",
  destination: "#6366f1",
  admin: "#0f172a",
  alert: "#ef4444",
  neutral: "#64748b"
};

const ROUTE_STYLE_MAP: Record<NonNullable<MapPolyline["variant"]>, { color: string; weight: number; opacity: number; dashed?: boolean; zIndex: number }> = {
  route: {
    color: "#16a34a",
    weight: 6,
    opacity: 0.95,
    zIndex: 6
  },
  trail: {
    color: "#0ea5e9",
    weight: 4,
    opacity: 0.55,
    dashed: true,
    zIndex: 4
  },
  direct: {
    color: "#f97316",
    weight: 5,
    opacity: 0.8,
    dashed: false,
    zIndex: 3
  },
  ghost: {
    color: "#cbd5f5",
    weight: 4,
    opacity: 0.25,
    zIndex: 2
  }
};

const getMarkerColor = (marker: MapMarker) => marker.color ?? MARKER_COLORS[marker.variant ?? "neutral"];

const buildPolylineOptions = (line: MapPolyline): google.maps.PolylineOptions => {
  const style = ROUTE_STYLE_MAP[line.variant ?? "trail"];
  const options: google.maps.PolylineOptions = {
    strokeColor: line.color ?? style.color,
    strokeOpacity: style.opacity,
    strokeWeight: line.weight ?? style.weight,
    zIndex: style.zIndex
  };

  if (style.dashed || line.dashArray) {
    options.strokeOpacity = 0;

    // Basic dash interpretation: if dashArray is present, we use it to calculate repeat
    // For "10,10", it's roughly 20px repeat
    let repeat = "16px";
    let dashLength = 2;

    if (line.dashArray) {
      const parts = line.dashArray.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
      if (parts.length >= 2) {
        dashLength = parts[0];
        repeat = `${parts[0] + parts[1]}px`;
      }
    }

    options.icons = [
      {
        icon: {
          path: `M 0,-${dashLength / 2} 0,${dashLength / 2}`,
          strokeOpacity: 1,
          strokeWeight: line.weight ?? style.weight,
          scale: 1
        },
        offset: "0",
        repeat: repeat
      }
    ];
  }
  return options;
};

const AdvancedMarker = ({ marker }: { marker: MapMarker }) => {
  const map = useGoogleMap();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const advancedRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  useEffect(() => {
    if (!map || typeof google === "undefined" || !google.maps?.marker?.AdvancedMarkerElement) {
      return;
    }
    containerRef.current = document.createElement("div");
    advancedRef.current = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: marker.position,
      content: containerRef.current,
      zIndex: marker.zIndex ?? undefined
    });
    return () => {
      if (advancedRef.current) {
        advancedRef.current.map = null;
        advancedRef.current = null;
      }
      containerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, marker.id]);

  useEffect(() => {
    if (advancedRef.current) {
      advancedRef.current.position = marker.position;
      advancedRef.current.zIndex = marker.zIndex ?? undefined;
    }
  }, [marker.position, marker.position.lat, marker.position.lng, marker.zIndex]);

  if (!containerRef.current) {
    return null;
  }

  const color = getMarkerColor(marker);
  const variant = marker.variant ?? "neutral";
  const showPulse = marker.pulse ?? marker.isFocused ?? variant === "provider";

  return createPortal(
    <span className="relative flex h-4 w-4 items-center justify-center" title={marker.label}>
      {showPulse && (
        <span
          className={classNames(
            "pointer-events-none absolute inline-flex h-7 w-7 animate-ping rounded-full",
            variant === "provider" ? "bg-emerald-400/40" : "bg-sky-400/30"
          )}
        />
      )}
      <span
        className={classNames(
          "relative inline-flex h-3.5 w-3.5 rounded-full border border-white shadow",
          marker.isFocused ? "scale-110" : "scale-100"
        )}
        style={{ background: color }}
      />
    </span>,
    containerRef.current
  );
};

const MAP_INTENT_THEME = {
  client: {
    badge: "Client view",
    overlay: "from-emerald-50 via-white to-white",
    mapId: import.meta.env.VITE_GOOGLE_MAP_ID_CLIENT,
    options: {
      zoomControl: true,
      tilt: 0,
      heading: 0,
      mapTypeControl: false
    }
  },
  provider: {
    badge: "Provider view",
    overlay: "from-sky-50 via-white to-white",
    mapId: import.meta.env.VITE_GOOGLE_MAP_ID_PROVIDER,
    options: {
      zoomControl: true,
      tilt: 45,
      heading: 0,
      mapTypeControl: false
    }
  },
  admin: {
    badge: "Operations view",
    overlay: "from-slate-100 via-white to-white",
    mapId: import.meta.env.VITE_GOOGLE_MAP_ID_ADMIN,
    options: {
      zoomControl: true,
      tilt: 0,
      heading: 0,
      mapTypeControl: true
    }
  }
} as const;

export const MapView = ({
  center,
  zoom = 14,
  height,
  markers = [],
  polylines = [],
  className,
  emptyLabel = "Location data unavailable",
  mapId,
  intent = "client",
  autoFit,
  immersive,
  overlay,
  padding = 50
}: MapViewProps) => {
  const finalHeight = height ?? (immersive ? "100%" : 320);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey ?? "",
    libraries: MAP_LIBRARIES,
    version: "beta",
    id: "shared-map"
  });

  const derivedCenter = useMemo<LatLngLiteral | null>(() => {
    if (center) {
      return center;
    }
    if (markers.length > 0) {
      const { lat, lng } = markers.reduce(
        (acc, marker) => ({
          lat: acc.lat + marker.position.lat,
          lng: acc.lng + marker.position.lng
        }),
        { lat: 0, lng: 0 }
      );
      return {
        lat: lat / markers.length,
        lng: lng / markers.length
      };
    }
    return null;
  }, [center, markers]);

  const intentTheme = MAP_INTENT_THEME[intent] ?? MAP_INTENT_THEME.client;
  const mapRef = useRef<google.maps.Map | null>(null);
  const shouldAutoFit = autoFit ?? intent !== "admin";
  const markersSignature = useMemo(
    () => markers.map((marker) => marker.id).join("|"),
    [markers]
  );
  const polylinesSignature = useMemo(
    () => polylines.map((line) => line.id).join("|"),
    [polylines]
  );
  const markersRef = useRef(markers);
  const polylinesRef = useRef(polylines);
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);
  useEffect(() => {
    polylinesRef.current = polylines;
  }, [polylines]);

  const fitBounds = useCallback(
    (map: google.maps.Map) => {
      if (typeof google === "undefined" || !google.maps) {
        return;
      }
      const bounds = new google.maps.LatLngBounds();
      markersRef.current.forEach((marker) => bounds.extend(marker.position));
      polylinesRef.current.forEach((line) => line.path.forEach((point) => bounds.extend(point)));
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          top: padding,
          right: padding,
          bottom: padding,
          left: padding
        });
      } else if (derivedCenter) {
        map.setCenter(derivedCenter);
        map.setZoom(zoom);
      }
    },
    [derivedCenter, zoom, padding]
  );

  const handleMapLoad = (mapInstance: google.maps.Map) => {
    mapRef.current = mapInstance;
    if (shouldAutoFit) {
      fitBounds(mapInstance);
    }
  };

  useEffect(() => {
    if (!shouldAutoFit || !mapRef.current || !isLoaded) {
      return;
    }
    fitBounds(mapRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markersSignature, polylinesSignature, shouldAutoFit, isLoaded]);

  if (!apiKey) {
    return (
      <div
        className={classNames(
          "flex h-64 w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-sm text-slate-500",
          className
        )}
      >
        Set <code className="rounded bg-slate-100 px-1">VITE_GOOGLE_MAPS_API_KEY</code> to enable maps.
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className={classNames(
          "flex h-64 w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-sm text-rose-700",
          className
        )}
      >
        Unable to load map services. Please retry shortly.
      </div>
    );
  }

  if (!derivedCenter) {
    return (
      <div
        className={classNames(
          "flex h-64 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500",
          className
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  const resolvedMapId = mapId || intentTheme.mapId || import.meta.env.VITE_GOOGLE_MAP_ID;
  const overlayGradient = intentTheme.overlay;

  return (
    <div
      className={classNames(
        "relative w-full overflow-hidden bg-gradient-to-br from-white via-white to-slate-50",
        immersive ? "rounded-none border-none" : "rounded-2xl border border-slate-200 shadow-lg ring-1 ring-black/5",
        className
      )}
      style={{ height: finalHeight }}
    >
      <div className={classNames("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60", overlayGradient)} />
      <div className="absolute inset-0">
        {isLoaded ? (
          <GoogleMap
            center={derivedCenter ?? defaultCenter}
            zoom={zoom}
            mapContainerClassName="h-full w-full"
            onLoad={handleMapLoad}
            options={{
              mapTypeControl: intentTheme.options.mapTypeControl,
              streetViewControl: false,
              fullscreenControl: false,
              clickableIcons: false,
              mapId: resolvedMapId,
              zoomControl: intentTheme.options.zoomControl,
              tilt: intentTheme.options.tilt,
              heading: intentTheme.options.heading,
              gestureHandling: "greedy",
              backgroundColor: "#f8fafc",
              maxZoom: 18
            }}
          >
            {markers.map((marker) => (
              <AdvancedMarker key={marker.id} marker={marker} />
            ))}
            {polylines.map((line) => {
              const mainOptions = buildPolylineOptions(line);
              const elements = [];

              if (line.borderColor) {
                const borderWeight = line.borderWeight ?? 2;
                const borderOptions = {
                  ...mainOptions,
                  strokeColor: line.borderColor,
                  strokeWeight: (Number(mainOptions.strokeWeight) || 4) + (borderWeight * 2),
                  zIndex: (Number(mainOptions.zIndex) || 1) - 1
                };
                elements.push(
                  <PolylineF key={`${line.id}-border`} path={line.path} options={borderOptions} />
                );
              }

              elements.push(
                <PolylineF key={line.id} path={line.path} options={mainOptions} />
              );

              return elements;
            })}
          </GoogleMap>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading live map…</div>
        )}
      </div>
      {overlay && (
        <div className="pointer-events-none absolute inset-0">{overlay}</div>
      )}
      <div className="pointer-events-none absolute right-4 top-4">
        <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 shadow">
          {intentTheme.badge}
        </span>
      </div>
    </div>
  );
};
