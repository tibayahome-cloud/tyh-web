import { useQuery } from "@tanstack/react-query";

import { api } from "../../../shared/libs/api";
import { mapOnboardingSummary } from "../utils/onboardingStatus";

export const onboardingStatusKey = ["provider", "onboarding-status"] as const;

/** The one status for this provider, worked out by the server so it is right even when no application exists. */
export const useOnboardingStatus = () =>
  useQuery({
    queryKey: onboardingStatusKey,
    queryFn: async () => {
      const response = await api.get("/provider-applications/me/status");
      return mapOnboardingSummary((response.data?.data ?? {}) as Record<string, unknown>);
    },
    refetchOnWindowFocus: false
  });
