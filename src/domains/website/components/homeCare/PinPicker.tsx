import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { Crosshair, Loader2, MapPin } from "lucide-react";

import { Button } from "../../../../shared/components/Button";
import { MAP_LIBRARIES } from "../../../../shared/constants/maps";
import { useMapFailed } from "../../../../shared/hooks/useMapFailed";
import { describePlace, UNNAMED_PLACE, type Coords, type Place } from "../../../../shared/utils/geocoding";
import { PlacePicker } from "../../../client/components/PlacePicker";
import { accuracyNote } from "./accuracy";
import { PlaceSearch } from "./PlaceSearch";

const NAIROBI: Coords = { lat: -1.286389, lng: 36.817223 };
// A move smaller than this (about a metre) is not a move: it is the map settling after we moved it ourselves.
const SAME_SPOT = 0.00001;

const sameSpot = (a: Coords, b: Coords) => Math.abs(a.lat - b.lat) < SAME_SPOT && Math.abs(a.lng - b.lng) < SAME_SPOT;

type PinPickerProps = {
  value: Place | null;
  onChange: (place: Place) => void;
  /** Where the device says it is, and how far off that may be in metres. Drawn as a circle under the pin. */
  device: { coords: Coords | null; accuracyM: number | null; locating: boolean; ask: () => void };
};

/**
 * Where the carer should come, the way a ride app asks: the pin stays in the middle of the screen and the person moves the
 * map under it until it is on their gate. The address under the map follows the pin, in full (a building or street, not just
 * the ward) with its plus code, and the circle shows how sure the device was. A map that cannot draw gives way to the
 * address search and the "use my location" button.
 */
export const PinPicker = ({ value, onChange, device }: PinPickerProps) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: apiKey ?? "", libraries: MAP_LIBRARIES, id: "shared-map", version: "weekly" });
  const failed = useMapFailed(Boolean(apiKey));
  const map = useRef<google.maps.Map | null>(null);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const [moving, setMoving] = useState(false);
  const [finding, setFinding] = useState(false);
  const run = useRef(0);

  // Name the spot under the pin. A newer move cancels an older answer, so a slow reply never names the wrong place.
  const settle = useCallback(async (coords: Coords) => {
    const mine = ++run.current;
    setFinding(true);
    const described = await describePlace(coords);
    if (mine !== run.current) return;
    setFinding(false);
    latest.current.onChange({ name: described?.address ?? UNNAMED_PLACE, coords, plusCode: described?.plusCode ?? null });
  }, []);

  // When something else changes the place (the device reading, a search result), move the map to it.
  const target = value?.coords ?? null;
  useEffect(() => {
    if (!target || !map.current) return;
    const centre = map.current.getCenter()?.toJSON();
    if (!centre || !sameSpot(centre, target)) {
      map.current.panTo(target);
      map.current.setZoom(17);
    }
  }, [target?.lat, target?.lng]); // eslint-disable-line react-hooks/exhaustive-deps -- only the point matters

  const onIdle = useCallback(() => {
    setMoving(false);
    const centre = map.current?.getCenter()?.toJSON();
    const current = latest.current.value?.coords;
    if (!centre || (current && sameSpot(centre, current))) return;
    void settle(centre);
  }, [settle]);

  if (!apiKey || failed) {
    // No map to move: the search and the device button still work.
    return <PlacePicker value={value} onChange={onChange} />;
  }

  const note = value && device.coords ? accuracyNote(device.accuracyM) : null;
  const start = target ?? device.coords ?? NAIROBI;

  return (
    <div className="space-y-3">
      <PlaceSearch onPick={onChange} />

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" style={{ height: 340 }}>
        {isLoaded ? (
          <>
            <GoogleMap
              center={start}
              zoom={target || device.coords ? 17 : 13}
              mapContainerClassName="h-full w-full"
              onLoad={(instance) => {
                map.current = instance;
              }}
              onUnmount={() => {
                map.current = null;
              }}
              onDragStart={() => setMoving(true)}
              onIdle={onIdle}
              options={{
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                clickableIcons: false,
                gestureHandling: "greedy",
                zoomControl: true
              }}
            >
              {device.coords && device.accuracyM !== null && (
                <Circle
                  center={device.coords}
                  radius={device.accuracyM}
                  options={{ strokeColor: "#1e40af", strokeOpacity: 0.5, strokeWeight: 1, fillColor: "#3b82f6", fillOpacity: 0.12, clickable: false }}
                />
              )}
            </GoogleMap>

            {/* The pin never moves: the map does. Its tip is the exact middle of the map. */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full" aria-hidden="true">
              <MapPin
                className={`h-10 w-10 fill-tiba-blue text-white drop-shadow-md transition-transform motion-reduce:transition-none ${moving ? "-translate-y-2" : ""}`}
                strokeWidth={1.5}
              />
            </div>
            <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-4 py-1 text-xs font-medium text-slate-700 shadow">
              Move the map to put the pin on your gate
            </p>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500" role="status">
            Loading map…
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        fullWidth
        icon={device.locating ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Crosshair className="h-4 w-4" aria-hidden />}
        onClick={device.ask}
        disabled={device.locating}
      >
        {device.locating ? "Finding you…" : "Use my current location"}
      </Button>

      <div className="rounded-xl border border-slate-200 bg-white p-4" role="status" aria-live="polite">
        <p className="text-sm text-slate-600">The carer will come to</p>
        <p className="mt-0.5 text-base font-semibold text-slate-900">
          {finding ? "Finding the address…" : value && value.name !== UNNAMED_PLACE ? value.name : "Move the map until the pin is on your gate"}
        </p>
        {value?.plusCode && !finding && <p className="mt-1 text-xs text-slate-500">Plus code {value.plusCode}</p>}
        {note && <p className={`mt-2 text-sm ${note.tone === "warn" ? "text-amber-800" : "text-slate-600"}`}>{note.text}</p>}
      </div>
    </div>
  );
};
