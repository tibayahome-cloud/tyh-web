export type Coords = { lat: number; lng: number };
export type Place = { name: string; coords: Coords };

/** What a person reads when we know a point on the map but not what it is called. Never the numbers. */
export const UNNAMED_PLACE = "Pinned location";
export const CURRENT_PLACE = "Current location";

const COORDINATE_TEXT = /^\s*-?\d+(?:\.\d+)?\s*(?:,|\s)\s*-?\d+(?:\.\d+)?\s*$/;

/** True for text that is just a latitude and longitude, which must not be shown or kept as a place name. */
export const isCoordinateText = (text: string | null | undefined): boolean => Boolean(text && COORDINATE_TEXT.test(text));

type AddressParts = Partial<Record<string, string | undefined>>;

/**
 * A short, readable name for a place, the way a ride or maps app shows it: the most specific local name, then the area
 * and town, e.g. "Argwings Kodhek Road, Kilimani, Nairobi". Never a full postal address and never coordinates.
 */
export const shortPlaceName = (address: AddressParts, fallbackLabel?: string | null): string => {
  const specific = address.amenity || address.building || address.shop || address.office || address.road || address.pedestrian;
  const area = address.neighbourhood || address.suburb || address.quarter || address.village;
  const town = address.city || address.town || address.municipality || address.county || address.state;
  const parts = [specific, area, town].filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index);
  if (parts.length > 0) return parts.slice(0, 3).join(", ");
  const label = fallbackLabel?.split(",").slice(0, 3).join(",").trim();
  return label && !isCoordinateText(label) ? label : UNNAMED_PLACE;
};

const NOMINATIM = "https://nominatim.openstreetmap.org";

type GoogleResult = {
  formatted_address?: string;
  address_components?: Array<{ long_name: string; types: string[] }>;
  geometry: { location: { lat: () => number; lng: () => number } };
};
type GoogleGeocoderLike = { geocode: (request: Record<string, unknown>) => Promise<{ results: GoogleResult[] }> };

const googleGeocoder = (): GoogleGeocoderLike | null => {
  const maps = (globalThis as { google?: { maps?: { Geocoder?: new () => GoogleGeocoderLike } } }).google?.maps;
  return maps?.Geocoder ? new maps.Geocoder() : null;
};

const googleParts = (components: Array<{ long_name: string; types: string[] }> = []): AddressParts => {
  const pick = (...types: string[]) => components.find((c) => types.some((t) => c.types.includes(t)))?.long_name;
  return {
    road: pick("route"),
    suburb: pick("sublocality", "sublocality_level_1", "neighborhood"),
    city: pick("locality"),
    state: pick("administrative_area_level_1")
  };
};

/** What this point is called. Uses Google when the map is loaded, otherwise OpenStreetMap; null when neither answers. */
export const reverseGeocode = async (coords: Coords, signal?: AbortSignal): Promise<string | null> => {
  const google = googleGeocoder();
  try {
    if (google) {
      const { results } = await google.geocode({ location: coords });
      const first = results?.[0];
      return first ? shortPlaceName(googleParts(first.address_components), first.formatted_address) : null;
    }
    const response = await fetch(
      `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=en&lat=${coords.lat}&lon=${coords.lng}`,
      { signal }
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { address?: AddressParts; display_name?: string };
    return shortPlaceName(body.address ?? {}, body.display_name);
  } catch {
    return null;
  }
};

/** A match for what someone typed. Its point is looked up only when it is chosen, which is what Google's suggestions need. */
export type PlaceSuggestion = {
  /** What to show: "502 Lower Kabete Road". */
  primary: string;
  /** Where it is, in smaller text: "Kabete, Nairobi". */
  secondary?: string;
  resolve: () => Promise<Place | null>;
};

type PlacesApi = {
  AutocompleteService: new () => {
    getPlacePredictions: (request: Record<string, unknown>) => Promise<{
      predictions: Array<{ place_id: string; description: string; structured_formatting?: { main_text: string; secondary_text?: string } }>;
    }>;
  };
  PlacesService: new (el: HTMLElement) => {
    getDetails: (
      request: Record<string, unknown>,
      callback: (place: { name?: string; formatted_address?: string; geometry?: { location: { lat: () => number; lng: () => number } }; address_components?: Array<{ long_name: string; types: string[] }> } | null, status: string) => void
    ) => void;
  };
  AutocompleteSessionToken: new () => unknown;
};

const placesApi = (): PlacesApi | null => {
  const places = (globalThis as unknown as { google?: { maps?: { places?: PlacesApi } } }).google?.maps?.places;
  return places?.AutocompleteService && places.PlacesService ? places : null;
};

// One session per typed search, so a search plus its pick is billed as one.
let sessionToken: unknown = null;
const sessionFor = (places: PlacesApi) => (sessionToken ??= new places.AutocompleteSessionToken());

/** Nairobi, to rank nearby results first without hiding the rest of Kenya. */
const NAIROBI = { lat: -1.286389, lng: 36.817223 };

const googleSuggestions = async (text: string, places: PlacesApi): Promise<PlaceSuggestion[]> => {
  const maps = (globalThis as unknown as { google: { maps: { places: PlacesApi } } }).google.maps;
  const { predictions } = await new places.AutocompleteService().getPlacePredictions({
    input: text,
    componentRestrictions: { country: "ke" },
    sessionToken: sessionFor(places),
    locationBias: { center: NAIROBI, radius: 50000 }
  });
  return (predictions ?? []).slice(0, 6).map((prediction) => ({
    primary: prediction.structured_formatting?.main_text ?? prediction.description.split(",")[0],
    secondary: prediction.structured_formatting?.secondary_text,
    resolve: () =>
      new Promise<Place | null>((resolve) => {
        const service = new maps.places.PlacesService(document.createElement("div"));
        service.getDetails(
          { placeId: prediction.place_id, fields: ["name", "formatted_address", "geometry", "address_components"], sessionToken: sessionFor(places) },
          (place, status) => {
            sessionToken = null;
            const location = place?.geometry?.location;
            if (status !== "OK" || !place || !location) return resolve(null);
            const name = [prediction.structured_formatting?.main_text ?? place.name, prediction.structured_formatting?.secondary_text?.split(",")[0]]
              .filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index)
              .join(", ");
            resolve({ name: name || shortPlaceName(googleParts(place.address_components), place.formatted_address), coords: { lat: location.lat(), lng: location.lng() } });
          }
        );
      })
  }));
};

/**
 * Places matching what someone typed, in Kenya, best first. Google Places finds buildings, estates and businesses the
 * way Maps, Uber and Bolt do; without Google loaded, OpenStreetMap is used, which knows far fewer Kenyan streets.
 */
export const searchPlaces = async (query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> => {
  const text = query.trim();
  if (text.length < 3) return [];
  const places = placesApi();
  try {
    if (places) return await googleSuggestions(text, places);
    const response = await fetch(
      `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=ke&accept-language=en&q=${encodeURIComponent(text)}`,
      { signal }
    );
    if (!response.ok) return [];
    const rows = (await response.json()) as Array<{ lat: string; lon: string; address?: AddressParts; display_name?: string }>;
    return rows.map((row) => {
      const name = shortPlaceName(row.address ?? {}, row.display_name);
      const [primary, ...rest] = name.split(", ");
      const place: Place = { name, coords: { lat: Number(row.lat), lng: Number(row.lon) } };
      return { primary, secondary: rest.join(", ") || undefined, resolve: async () => place };
    });
  } catch {
    return [];
  }
};

/** True once the Google Maps script with Places has loaded, so callers can wait for the better source. */
export const googlePlacesReady = (): boolean => placesApi() !== null;
