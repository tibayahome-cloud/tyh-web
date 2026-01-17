import { useQuery } from "@tanstack/react-query";

import { api } from "../libs/api";

export type ReverseGeocodeResult = {
  formattedAddress?: string;
  placeName?: string;
  placeId?: string;
};

const fetchReverseGeocode = async (lat: number, lng: number): Promise<ReverseGeocodeResult> => {
  const response = await api.get<{ data: ReverseGeocodeResult }>("/geocode", {
    params: { lat, lng }
  });
  return response.data?.data ?? {};
};

export const useReverseGeocode = (
  lat?: number | null,
  lng?: number | null,
  enabled = Boolean(lat != null && lng != null)
) => {
  return useQuery({
    queryKey: ["reverse-geocode", lat, lng],
    queryFn: () => fetchReverseGeocode(lat as number, lng as number),
    enabled: Boolean(enabled && lat != null && lng != null)
  });
};
