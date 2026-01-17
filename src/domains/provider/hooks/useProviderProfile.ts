import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/libs/api";
import { buildFieldParams, providerProfile } from "../../../shared/libs/fieldInclude";

type ProviderProfile = {
  id: string;
  user_id: string;
  verified: boolean;
  is_available: boolean;
  daily_request_limit: number;
  can_emergency: boolean;
  home_lat?: number | null;
  home_lng?: number | null;
};

type Envelope<T> = {
  data: T;
};

export const useProviderProfile = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["provider", "profile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) {
        return null;
      }
      try {
        const response = await api.get<Envelope<ProviderProfile>>(`/providers/${userId}`, {
          params: buildFieldParams(providerProfile)
        });
        return response.data.data;
      } catch {
        return null;
      }
    }
  });
};

export const useUpdateProviderHomeLocation = (userId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ lat, lng }: { lat: number; lng: number }) => {
      if (!userId) {
        throw new Error("Provider id is required");
      }
      await api.patch(`/providers/${userId}`, {
        home_lat: lat,
        home_lng: lng
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider", "profile", userId] }).catch(() => undefined);
    }
  });
};

export const useUpdateProviderStatus = (userId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (isAvailable: boolean) => {
      if (!userId) {
        throw new Error("Provider id is required");
      }
      await api.patch(`/providers/${userId}`, {
        is_available: isAvailable
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider", "profile", userId] }).catch(() => undefined);
    }
  });
};

export type { ProviderProfile };
