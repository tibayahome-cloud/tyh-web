import { useQuery } from "@tanstack/react-query";

import { api } from "../../../shared/libs/api";
import { buildFieldParams, provApp } from "../../../shared/libs/fieldInclude";

type ProviderApplication = {
  id: string;
  status: string;
  progress_percent?: number;
  notes?: string | null;
  items?: Array<{
    id: string;
    status: string;
    comment?: string | null;
    requirement_type?: {
      id: string;
      label?: string;
    };
  }>;
};

type Envelope<T> = {
  data: T;
};

export const useProviderApplication = (userId: string | undefined) =>
  useQuery({
    queryKey: ["provider", "application", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) {
        return null;
      }
      try {
        const response = await api.get<Envelope<ProviderApplication>>("/provider-applications/me", {
          params: buildFieldParams(provApp)
        });
        return response.data.data;
      } catch {
        return null;
      }
    },
    staleTime: 30000
  });
