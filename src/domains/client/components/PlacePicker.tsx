import { useEffect, useId, useRef, useState } from "react";
import { Crosshair, Loader2, MapPin, Search } from "lucide-react";

import { Button } from "../../../shared/components/Button";
import { LocationPickerMap } from "../../../shared/components/LocationPickerMap";
import { useJsApiLoader } from "@react-google-maps/api";

import { MAP_LIBRARIES } from "../../../shared/constants/maps";
import { CURRENT_PLACE, reverseGeocode, searchPlaces, type Coords, type Place, type PlaceSuggestion } from "../../../shared/utils/geocoding";

export type PlaceSource = "current" | "search" | "map";

type Props = {
  value: Place | null;
  onChange: (place: Place, source: PlaceSource) => void;
};

const SEARCH_DELAY_MS = 300;

/** Loads Google Maps with Places up front, so the first search already uses it; renders nothing. */
const GoogleMapsLoader = ({ apiKey, onReady }: { apiKey: string; onReady: () => void }) => {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: apiKey, libraries: MAP_LIBRARIES, id: "shared-map", version: "weekly" });
  useEffect(() => {
    if (isLoaded) onReady();
  }, [isLoaded, onReady]);
  return null;
};

/**
 * Where the provider should come: use my current location, or search for a place by name. The chosen place is shown as
 * a name ("Kilimani, Nairobi"), the way a ride or maps app does, and the numbers behind it are never shown.
 */
export const PlacePicker = ({ value, onChange }: Props) => {
  const listId = useId();
  const [editing, setEditing] = useState(!value);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [googleReady, setGoogleReady] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(-1);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const searchRun = useRef(0);
  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const hasMap = Boolean(mapsKey);

  useEffect(() => {
    if (!value) setEditing(true);
  }, [value]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    const run = ++searchRun.current;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      const found = await searchPlaces(text);
      if (run !== searchRun.current) return;
      setResults(found);
      setActive(-1);
      setSearching(false);
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query, googleReady]);

  const choose = (place: Place, source: PlaceSource) => {
    onChange(place, source);
    setEditing(false);
    setQuery("");
    setResults([]);
    setNotice(null);
  };

  const chooseSuggestion = async (suggestion: PlaceSuggestion) => {
    if (resolving) return;
    setResolving(true);
    const place = await suggestion.resolve();
    setResolving(false);
    if (!place) {
      setNotice("We could not open that place. Try another one.");
      return;
    }
    choose(place, "search");
  };

  const useCurrentLocation = () => {
    if (locating) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setNotice("This device cannot share its location. Search for your address instead.");
      return;
    }
    setLocating(true);
    setNotice(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords: Coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        const name = (await reverseGeocode(coords)) ?? CURRENT_PLACE;
        setLocating(false);
        choose({ name, coords }, "current");
      },
      (error) => {
        setLocating(false);
        setNotice(
          error.code === 1
            ? "Location is blocked for this site. Allow it in your browser settings, or search for your address."
            : "We could not find you. Check your signal and try again, or search for your address."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      void chooseSuggestion(results[active]);
    } else if (event.key === "Escape") {
      setResults([]);
    }
  };

  const mapMoved = async (coords: Coords) => {
    const name = (await reverseGeocode(coords)) ?? value?.name ?? "Pinned location";
    onChange({ name, coords }, "map");
  };

  return (
    <div className="space-y-3">
      {value && !editing ? (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-50 text-tiba-blue">
            <MapPin aria-hidden="true" size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-600">Your provider will come to</p>
            <p className="truncate text-base font-semibold text-slate-900">{value.name}</p>
          </div>
          <Button type="button" variant="secondary" className="min-h-[44px]" onClick={() => setEditing(true)}>
            Change
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Button type="button" className="min-h-[48px] w-full" onClick={useCurrentLocation} disabled={locating}>
            {locating ? <Loader2 aria-hidden="true" className="mr-2 h-5 w-5 animate-spin motion-reduce:animate-none" /> : <Crosshair aria-hidden="true" className="mr-2 h-5 w-5" />}
            {locating ? "Finding you…" : "Use my current location"}
          </Button>

          <div className="relative">
            <label className="block">
              <span className="sr-only">Search for an address or place</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                role="combobox"
                aria-expanded={results.length > 0}
                aria-controls={listId}
                aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search for an address or place"
                className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-base text-slate-900 focus:border-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/40"
              />
            </label>

            {results.length > 0 && (
              <ul id={listId} role="listbox" aria-label="Matching places" className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {results.map((place, index) => (
                  <li key={`${place.primary}-${index}`} role="option" id={`${listId}-${index}`} aria-selected={index === active}>
                    <button
                      type="button"
                      onClick={() => void chooseSuggestion(place)}
                      className={`flex min-h-[48px] w-full items-center gap-3 px-4 text-left text-sm text-slate-900 hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-100 ${index === active ? "bg-slate-100" : ""}`}
                    >
                      <MapPin aria-hidden="true" size={16} className="shrink-0 text-slate-500" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{place.primary}</span>
                        {place.secondary && <span className="block truncate text-slate-600">{place.secondary}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-2 min-h-[20px] text-sm text-slate-600" role="status" aria-live="polite">
              {resolving ? "Opening that place…" : searching ? "Searching…" : query.trim().length >= 3 && results.length === 0 ? "No place found. Try the estate, street or a nearby landmark." : ""}
            </p>
          </div>

          {value && (
            <Button type="button" variant="ghost" className="min-h-[44px]" onClick={() => setEditing(false)}>
              Keep {value.name}
            </Button>
          )}
        </div>
      )}

      {notice && (
        <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {notice}
        </p>
      )}

      {mapsKey && <GoogleMapsLoader apiKey={mapsKey} onReady={() => setGoogleReady(true)} />}

      {hasMap && value && (
        <LocationPickerMap value={value.coords} onChange={mapMoved} height={220} />
      )}
    </div>
  );
};

export default PlacePicker;
