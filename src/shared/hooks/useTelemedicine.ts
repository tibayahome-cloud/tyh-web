import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  assignProvider,
  confirmSessionJoin,
  createHold,
  discoverRemoteFacilities,
  endSession,
  fetchAssignmentQueue,
  fetchAvailableSlots,
  getHold,
  initiateHoldPayment,
  joinSession,
  releaseHold,
  reportNoShow
} from "../libs/telemedicine";
import { bookingKeys } from "./useBookings";

export const telemedicineKeys = {
  remoteFacilities: (serviceId: string, countryCode?: string) =>
    ["telemedicine", "remote-facilities", serviceId, countryCode ?? null] as const,
  slots: (facilityId: string, facilityServiceId: string, startDate: string, endDate?: string) =>
    ["telemedicine", "slots", facilityId, facilityServiceId, startDate, endDate ?? startDate] as const,
  hold: (holdId: string) => ["telemedicine", "hold", holdId] as const,
  assignments: () => ["telemedicine", "assignments"] as const
};

export const useRemoteFacilities = (
  serviceId: string | null,
  countryCode?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: telemedicineKeys.remoteFacilities(serviceId ?? "unknown", countryCode),
    queryFn: () => {
      if (!serviceId) {
        return Promise.reject(new Error("serviceId required"));
      }
      return discoverRemoteFacilities(serviceId, countryCode);
    },
    enabled: Boolean(serviceId) && (options?.enabled ?? true)
  });
};

export const useAvailableSlots = (
  facilityId: string | null,
  facilityServiceId: string | null,
  startDate: string | null,
  endDate?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: telemedicineKeys.slots(facilityId ?? "unknown", facilityServiceId ?? "unknown", startDate ?? "unknown", endDate),
    queryFn: () => {
      if (!facilityId || !facilityServiceId || !startDate) {
        return Promise.reject(new Error("facilityId, facilityServiceId, and startDate are required"));
      }
      return fetchAvailableSlots(facilityId, facilityServiceId, startDate, endDate);
    },
    enabled: Boolean(facilityId && facilityServiceId && startDate) && (options?.enabled ?? true)
  });
};

export const useCreateHoldMutation = () => {
  return useMutation({
    mutationFn: ({
      facilityId,
      facilityServiceId,
      startAt,
      idempotencyKey
    }: {
      facilityId: string;
      facilityServiceId: string;
      startAt: string;
      idempotencyKey?: string;
    }) => createHold(facilityId, { facilityServiceId, startAt, idempotencyKey })
  });
};

export const useHoldQuery = (holdId: string | null, options?: { enabled?: boolean; refetchInterval?: number | false }) => {
  return useQuery({
    queryKey: telemedicineKeys.hold(holdId ?? "unknown"),
    queryFn: () => {
      if (!holdId) {
        return Promise.reject(new Error("holdId required"));
      }
      return getHold(holdId);
    },
    enabled: Boolean(holdId) && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval
  });
};

export const useReleaseHoldMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (holdId: string) => releaseHold(holdId),
    onSuccess: (hold) => {
      queryClient.setQueryData(telemedicineKeys.hold(hold.id), hold);
    }
  });
};

export const useInitiateHoldPaymentMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ holdId, phone, method }: { holdId: string; phone?: string; method?: string }) =>
      initiateHoldPayment(holdId, { phone, method }),
    onSuccess: ({ hold }) => {
      queryClient.setQueryData(telemedicineKeys.hold(hold.id), hold);
    }
  });
};

export const useJoinSessionMutation = () => {
  return useMutation({
    mutationFn: (bookingId: string) => joinSession(bookingId)
  });
};

export const useConfirmSessionJoinMutation = () => {
  return useMutation({
    mutationFn: (bookingId: string) => confirmSessionJoin(bookingId)
  });
};

export const useEndSessionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => endSession(bookingId),
    onSuccess: (_result, bookingId) => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(bookingId) }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists(), exact: false }).catch(() => undefined);
    }
  });
};

export const useReportNoShowMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => reportNoShow(bookingId),
    onSuccess: (_result, bookingId) => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(bookingId) }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists(), exact: false }).catch(() => undefined);
    }
  });
};

export const useAssignmentQueue = (options?: { enabled?: boolean; refetchInterval?: number | false }) => {
  return useQuery({
    queryKey: telemedicineKeys.assignments(),
    queryFn: () => fetchAssignmentQueue(),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval
  });
};

export const useAssignProviderMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, providerUserId }: { bookingId: string; providerUserId: string }) =>
      assignProvider(bookingId, providerUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: telemedicineKeys.assignments() }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists(), exact: false }).catch(() => undefined);
    }
  });
};
