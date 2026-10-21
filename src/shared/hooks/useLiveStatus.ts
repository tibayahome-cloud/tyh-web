import { useQuery } from "@tanstack/react-query";

import { fetchFacilityLiveStatus, fetchProviderLiveStatus } from "../libs/liveStatus";

export const liveStatusKeys = {
  facility: (facilityId: string | undefined) => ["live-status", "facility", facilityId] as const,
  provider: (userId: string | undefined) => ["live-status", "provider", userId] as const
};

// A minute is plenty: the answer changes when someone edits a setting, and those screens invalidate it.
const STALE_MS = 60_000;

export const useFacilityLiveStatus = (facilityId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: liveStatusKeys.facility(facilityId),
    queryFn: () => fetchFacilityLiveStatus(facilityId as string),
    enabled: enabled && Boolean(facilityId),
    staleTime: STALE_MS
  });

export const useProviderLiveStatus = (userId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: liveStatusKeys.provider(userId),
    queryFn: () => fetchProviderLiveStatus(userId as string),
    enabled: enabled && Boolean(userId),
    staleTime: STALE_MS
  });
