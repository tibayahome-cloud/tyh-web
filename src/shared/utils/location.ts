const formatCardinal = (value: number, positiveLabel: string, negativeLabel: string) => {
  const absValue = Math.abs(value);
  const direction = value >= 0 ? positiveLabel : negativeLabel;
  return `${absValue.toFixed(4)}° ${direction}`;
};

export const formatLatLngLabel = (lat: number, lng: number) => {
  const latLabel = formatCardinal(lat, "N", "S");
  const lngLabel = formatCardinal(lng, "E", "W");
  return `${latLabel} · ${lngLabel}`;
};

export const formatDecimalLocation = (lat: number, lng: number) => {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Calculates haversine distance in meters between two points
 */
export const distanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371e3; // Earth radius in meters
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

