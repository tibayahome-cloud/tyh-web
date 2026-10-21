import { useQuery } from "@tanstack/react-query";

import { reverseGeocode, UNNAMED_PLACE } from "../utils/geocoding";

/** What a saved point is called, for showing a location without ever showing its coordinates. */
export const usePlaceName = (lat: number | null | undefined, lng: number | null | undefined): string => {
  const known = typeof lat === "number" && typeof lng === "number" && !Number.isNaN(lat) && !Number.isNaN(lng);
  const query = useQuery({
    queryKey: ["place-name", known ? lat!.toFixed(4) : null, known ? lng!.toFixed(4) : null],
    queryFn: () => reverseGeocode({ lat: lat as number, lng: lng as number }),
    enabled: known,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false
  });
  return query.data ?? UNNAMED_PLACE;
};
