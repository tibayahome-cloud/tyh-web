import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import classNames from "classnames";
import { GoogleMap, useGoogleMap, useJsApiLoader } from "@react-google-maps/api";
import type { Libraries } from "@react-google-maps/api";

import { MAP_LIBRARIES } from "../constants/maps";

type LatLngLiteral = google.maps.LatLngLiteral;


type LocationPickerMapProps = {
  value?: LatLngLiteral | null;
  onChange?: (value: LatLngLiteral) => void;
  /** Called when address is resolved from coordinates via reverse geocoding */
  onAddressChange?: (address: string) => void;
  height?: number;
  className?: string;
  disabled?: boolean;
};

const DEFAULT_CENTER: LatLngLiteral = { lat: -1.286389, lng: 36.817223 };

// Reverse geocode coordinates to human-readable address
const reverseGeocode = async (coords: LatLngLiteral): Promise<string | null> => {
  if (typeof google === "undefined" || !google.maps?.Geocoder) {
    return null;
  }
  try {
    const geocoder = new google.maps.Geocoder();
    const response = await geocoder.geocode({ location: coords });
    if (response.results && response.results.length > 0) {
      // Return the first result's formatted address
      return response.results[0].formatted_address;
    }
  } catch {
    // Geocoding failed
  }
  return null;
};

export const LocationPickerMap = ({
  value,
  onChange,
  onAddressChange,
  height = 260,
  className,
  disabled = false
}: LocationPickerMapProps) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey ?? "",
    libraries: MAP_LIBRARIES,
    id: "shared-map",
    version: "weekly"
  });
  const [advancedReady, setAdvancedReady] = useState(false);
  const mapId = import.meta.env.VITE_GOOGLE_MAP_ID;

  useEffect(() => {
    let cancelled = false;
    const loadAdvanced = async () => {
      if (!isLoaded || typeof window === "undefined" || typeof google === "undefined" || !google.maps) {
        return;
      }
      try {
        if (!google.maps.marker?.AdvancedMarkerElement && google.maps.importLibrary) {
          await google.maps.importLibrary("marker");
        }
        if (!cancelled && google.maps.marker?.AdvancedMarkerElement) {
          setAdvancedReady(true);
        }
      } catch {
        if (!cancelled) {
          setAdvancedReady(false);
        }
      }
    };
    loadAdvanced();
    return () => {
      cancelled = true;
    };
  }, [isLoaded]);

  const center = useMemo<LatLngLiteral>(() => value ?? DEFAULT_CENTER, [value]);

  const handleClick = useCallback(
    async (event: google.maps.MapMouseEvent) => {
      if (disabled || !event.latLng) {
        return;
      }
      const coords = event.latLng.toJSON();
      if (onChange) {
        onChange(coords);
      }
      // Perform reverse geocoding if callback provided
      if (onAddressChange) {
        const address = await reverseGeocode(coords);
        if (address) {
          onAddressChange(address);
        }
      }
    },
    [disabled, onChange, onAddressChange]
  );

  if (!apiKey) {
    return (
      <div
        className={classNames(
          "flex h-60 w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-sm text-slate-500",
          className
        )}
      >
        Set <code className="rounded bg-slate-100 px-1">VITE_GOOGLE_MAPS_API_KEY</code> to enable picking locations.
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className={classNames(
          "flex h-60 w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-sm text-rose-700",
          className
        )}
      >
        We couldn&apos;t load the map. Try again shortly.
      </div>
    );
  }

  return (
    <div
      className={classNames(
        "relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
        className
      )}
      style={{ height }}
    >
      {isLoaded ? (
        <>
          <GoogleMap
            center={center}
            zoom={value ? 15 : 13}
            mapContainerClassName="h-full w-full"
            onClick={handleClick}
            options={{
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
              clickableIcons: false,
              draggableCursor: disabled ? undefined : "crosshair",
              mapId
            }}
          >
            {value && advancedReady && <AdvancedMarkerPin position={value} />}
            {!advancedReady && (
              <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white/90 px-4 py-1 text-xs font-semibold text-slate-600 shadow">
                Warming up markers…
              </div>
            )}
          </GoogleMap>
          {!disabled && (
            <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white/90 px-4 py-1 text-xs font-semibold text-slate-600 shadow">
              Tap the map to drop a pin
            </div>
          )}
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading map…</div>
      )}
    </div>
  );
};

export default LocationPickerMap;

const AdvancedMarkerPin = ({ position }: { position: LatLngLiteral }) => {
  const map = useGoogleMap();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  useEffect(() => {
    if (!map || typeof google === "undefined" || !google.maps.marker?.AdvancedMarkerElement) {
      return undefined;
    }
    containerRef.current = document.createElement("div");
    markerRef.current = new google.maps.marker.AdvancedMarkerElement({
      map,
      position,
      content: containerRef.current
    });
    return () => {
      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }
      containerRef.current = null;
    };
  }, [map, position]);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.position = position;
    }
  }, [position]);

  if (!containerRef.current) {
    return null;
  }

  return createPortal(
    <span className="flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-rose-500 shadow-lg" />,
    containerRef.current
  );
};
