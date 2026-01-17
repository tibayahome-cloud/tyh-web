import { useQuery } from "@tanstack/react-query";

import { api } from "../../../shared/libs/api";

type ProviderAnalytics = {
  provider_id: string;
  user_id: string;
  rating_avg: number;
  rating_count: number;
  rank: number | null;
  total_providers: number;
  active_services: number;
  availability_blocks: number;
  upcoming_blackouts: number;
  is_available: boolean;
  daily_request_limit: number;
  can_emergency: boolean;
  timezone: string | null;
};

type Envelope<T> = {
  data: T;
};

export const useProviderAnalytics = (userId: string | undefined) =>
  useQuery({
    queryKey: ["provider", "analytics", userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!userId) {
        return null;
      }
      try {
        const response = await api.get<Envelope<ProviderAnalytics>>(`/providers/${userId}/analytics`);
        return response.data.data;
      } catch {
        return null;
      }
    }
  });

export type { ProviderAnalytics };
