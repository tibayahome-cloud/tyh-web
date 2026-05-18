import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCursorInfiniteQuery } from "./useCursorInfiniteQuery";

import {
  acknowledgeSelfCareAlert,
  closeSelfCareAlert,
  createSelfCareCheckin,
  fetchSelfCareAlerts,
  fetchSelfCareCheckins,
  fetchSelfCareProfile,
  updateSelfCareProfile
} from "../libs/selfcare";
import type {
  SelfCareAlert,
  SelfCareAlertFilters,
  SelfCareCheckin,
  SelfCareCheckinInput,
  SelfCareProfile,
  SelfCareProfileUpdateInput
} from "../schemas/selfcare";

const normalizeUserId = (userId?: string | null) => userId ?? "me";

const normalizeFilters = (filters: SelfCareAlertFilters = {}) => ({
  status: filters.status ?? null,
  riskLevel: filters.riskLevel ?? null,
  clientId: filters.clientId ?? null,
  limit: filters.limit ?? 50
});

export const selfCareKeys = {
  all: ["selfcare"] as const,
  profile: (userId?: string | null) => ["selfcare", "profile", normalizeUserId(userId)] as const,
  checkins: (userId?: string | null) => ["selfcare", "checkins", normalizeUserId(userId)] as const,
  alerts: (filters: ReturnType<typeof normalizeFilters>) => ["selfcare", "alerts", filters] as const
};

export const useSelfCareProfile = (
  userId?: string | null,
  options?: { enabled?: boolean }
) => {
  return useQuery<SelfCareProfile>({
    queryKey: selfCareKeys.profile(userId),
    queryFn: () => fetchSelfCareProfile(userId),
    enabled: options?.enabled ?? true
  });
};

export const useSelfCareCheckins = (
  userId?: string | null,
  params?: { limit?: number; enabled?: boolean }
) => {
  return useQuery<SelfCareCheckin[]>({
    queryKey: [...selfCareKeys.checkins(userId), params?.limit ?? 20],
    queryFn: async () => {
      const res = await fetchSelfCareCheckins({ userId, limit: params?.limit });
      return res.data;
    },
    enabled: params?.enabled ?? true
  });
};

export const useSelfCareCheckinsInfinite = (
  userId?: string | null,
  params?: { limit?: number; enabled?: boolean }
) => {
  return useCursorInfiniteQuery(
    [...selfCareKeys.checkins(userId), "infinite", params?.limit ?? 20],
    ({ pageParam }) => fetchSelfCareCheckins({ userId, limit: params?.limit, cursor: pageParam }),
    {
      enabled: params?.enabled ?? true
    }
  );
};

export const useSelfCareAlerts = (
  filters?: SelfCareAlertFilters,
  options?: { enabled?: boolean }
) => {
  const normalized = normalizeFilters(filters);
  return useQuery<SelfCareAlert[]>({
    queryKey: selfCareKeys.alerts(normalized),
    queryFn: () => fetchSelfCareAlerts(filters),
    enabled: options?.enabled ?? true
  });
};

export const useUpdateSelfCareProfileMutation = (userId?: string | null) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SelfCareProfileUpdateInput) => updateSelfCareProfile(input, userId),
    onSuccess: (profile) => {
      queryClient.setQueryData(selfCareKeys.profile(userId), profile);
    }
  });
};

export const useCreateSelfCareCheckinMutation = (userId?: string | null) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SelfCareCheckinInput) => createSelfCareCheckin(input, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: selfCareKeys.checkins(userId) }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: selfCareKeys.profile(userId) }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ["selfcare", "alerts"], exact: false }).catch(() => undefined);
    }
  });
};

export const useAcknowledgeSelfCareAlertMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => acknowledgeSelfCareAlert(alertId),
    onSuccess: (alert) => {
      queryClient.invalidateQueries({ queryKey: ["selfcare", "alerts"], exact: false }).catch(() => undefined);
      if (alert?.clientUserId) {
        queryClient.invalidateQueries({ queryKey: selfCareKeys.checkins(alert.clientUserId) }).catch(() => undefined);
      }
    }
  });
};

export const useCloseSelfCareAlertMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ alertId, reason }: { alertId: string; reason?: string }) => closeSelfCareAlert(alertId, reason),
    onSuccess: (alert) => {
      queryClient.invalidateQueries({ queryKey: ["selfcare", "alerts"], exact: false }).catch(() => undefined);
      if (alert?.clientUserId) {
        queryClient.invalidateQueries({ queryKey: selfCareKeys.profile(alert.clientUserId) }).catch(() => undefined);
      }
    }
  });
};
