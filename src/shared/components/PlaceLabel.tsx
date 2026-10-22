import { usePlaceName } from "../hooks/usePlaceName";

/** The name of a point on the map ("Kilimani, Nairobi"), never its coordinates. */
export const PlaceLabel = ({ lat, lng }: { lat: number | null | undefined; lng: number | null | undefined }) => <>{usePlaceName(lat, lng)}</>;
