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

/** Places matching what someone typed, in Kenya, best first. Empty when nothing matches or the service cannot be reached. */
export const searchPlaces = async (query: string, signal?: AbortSignal): Promise<Place[]> => {
  const text = query.trim();
  if (text.length < 3) return [];
  const google = googleGeocoder();
  try {
    if (google) {
      const { results } = await google.geocode({ address: text, region: "ke", componentRestrictions: { country: "KE" } });
      return (results ?? []).slice(0, 5).map((r) => ({
        name: shortPlaceName(googleParts(r.address_components), r.formatted_address),
        coords: { lat: r.geometry.location.lat(), lng: r.geometry.location.lng() }
      }));
    }
    const response = await fetch(
      `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=ke&accept-language=en&q=${encodeURIComponent(text)}`,
      { signal }
    );
    if (!response.ok) return [];
    const rows = (await response.json()) as Array<{ lat: string; lon: string; address?: AddressParts; display_name?: string }>;
    return rows.map((row) => ({
      name: shortPlaceName(row.address ?? {}, row.display_name),
      coords: { lat: Number(row.lat), lng: Number(row.lon) }
    }));
  } catch {
    return [];
  }
};
