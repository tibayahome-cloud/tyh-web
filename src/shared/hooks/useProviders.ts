import { useQuery } from "@tanstack/react-query";

import type { ProviderCandidate } from "../libs/providers";
import { fetchEligibleProviders } from "../libs/providers";

type EligibleOptions = {
  bookingId: string | null;
  search?: string;
  limit?: number;
  enabled?: boolean;
};

export const useEligibleProviders = ({ bookingId, search, limit, enabled = true }: EligibleOptions) => {
  return useQuery<ProviderCandidate[]>({
    queryKey: ["admin", "providers", "eligible", bookingId, search, limit],
    queryFn: () => {
      if (!bookingId) {
        return Promise.resolve([]);
      }
      return fetchEligibleProviders(bookingId, { search, limit });
    },
    enabled: Boolean(bookingId) && enabled
  });
};
