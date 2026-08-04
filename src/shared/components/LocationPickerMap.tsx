import { useCallback, useMemo } from "react";
import classNames from "classnames";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
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
            }}
          >
            {value && <Marker position={value} />}
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
