import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { approveWithdrawal, fetchAdminWithdrawal, fetchAdminWithdrawals, fetchWalletAccount, rejectWithdrawal, requestWithdrawal } from "../libs/wallet";
import type { WithdrawalListResult } from "../libs/wallet";

const normalizeAdminParams = (params: { page?: number; size?: number; status?: string } = {}) => ({
  page: params.page ?? 1,
  size: params.size ?? 25,
  status: params.status ?? null
});

export const walletKeys = {
  all: ["wallet"] as const,
  account: () => ["wallet", "account"] as const,
  adminList: (params: ReturnType<typeof normalizeAdminParams>) => ["wallet", "admin", "withdrawals", params] as const,
  adminDetail: (withdrawalId: string) => ["wallet", "admin", "withdrawal", withdrawalId] as const
};

export const useWalletAccount = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: walletKeys.account(),
    queryFn: fetchWalletAccount,
    enabled: options?.enabled ?? true
  });
};

export const useWalletWithdrawalRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ amountCents, reason }: { amountCents: number; reason?: string }) =>
      requestWithdrawal(amountCents, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletKeys.account() }).catch(() => undefined);
    }
  });
};

export const useAdminWithdrawals = (
  params: { page?: number; size?: number; status?: string },
  options?: { enabled?: boolean }
) => {
  const normalized = normalizeAdminParams(params);
  return useQuery<WithdrawalListResult>({
    queryKey: walletKeys.adminList(normalized),
    queryFn: () => fetchAdminWithdrawals(params),
    keepPreviousData: true,
    enabled: options?.enabled ?? true
  });
};

export const useAdminWithdrawalDetail = (withdrawalId: string | null) => {
  return useQuery({
    queryKey: withdrawalId ? walletKeys.adminDetail(withdrawalId) : ["wallet", "admin", "withdrawal", "unknown"],
    queryFn: () => {
      if (!withdrawalId) {
        return Promise.reject(new Error("withdrawalId required"));
      }
      return fetchAdminWithdrawal(withdrawalId);
    },
    enabled: Boolean(withdrawalId)
  });
};

export const useAdminApproveWithdrawal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (withdrawalId: string) => approveWithdrawal(withdrawalId),
    onSuccess: (_data, withdrawalId) => {
      queryClient.invalidateQueries({ queryKey: ["wallet", "admin", "withdrawals"], exact: false }).catch(
        () => undefined
      );
      if (withdrawalId) {
        queryClient.invalidateQueries({ queryKey: walletKeys.adminDetail(withdrawalId) }).catch(() => undefined);
      }
    }
  });
};

export const useAdminRejectWithdrawal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ withdrawalId, reason }: { withdrawalId: string; reason?: string }) =>
      rejectWithdrawal(withdrawalId, reason),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["wallet", "admin", "withdrawals"], exact: false }).catch(
        () => undefined
      );
      if (variables?.withdrawalId) {
        queryClient.invalidateQueries({ queryKey: walletKeys.adminDetail(variables.withdrawalId) }).catch(
          () => undefined
        );
      }
    }
  });
};
