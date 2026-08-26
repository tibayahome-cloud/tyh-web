import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../../../shared/libs/api";
import { buildFieldParams, providerProfile } from "../../../shared/libs/fieldInclude";

type ProviderProfile = {
  id: string;
  user_id: string;
  facility_id?: string | null;
  verified: boolean;
  is_available: boolean;
  daily_request_limit: number;
  can_emergency: boolean;
  compensation_mode?: "employee" | "fixed" | "percentage";
  fixed_payout_cents?: number | null;
  payout_percentage?: number | null;
  home_lat?: number | null;
  home_lng?: number | null;
  facility?: {
    id: string;
    name?: string | null;
    provider_financials_visible?: boolean | null;
  } | null;
  telemedicine_subcategory_assignments?: Array<{
    id: string;
    subcategory_id: string;
    status: string;
    subcategory?: {
      id: string;
      name?: string | null;
      category_id?: string | null;
      category?: { id: string; name?: string | null } | null;
    } | null;
  }>;
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

export const providerFinancialsAreVisible = (profile: ProviderProfile | null | undefined): boolean =>
  profile?.facility?.provider_financials_visible !== false;

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
