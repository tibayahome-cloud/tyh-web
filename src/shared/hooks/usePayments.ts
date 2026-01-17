import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { PaymentListParams, PaymentListResult } from "../libs/payments";
import { fetchAdminPayment, fetchAdminPayments, fetchPaymentSummary, retryPayment } from "../libs/payments";

const normalizeParams = (params: PaymentListParams = {}) => ({
  page: params.page ?? 1,
  pageSize: params.pageSize ?? 25,
  status: params.status ?? null,
  bookingId: params.bookingId ?? null,
  preset: params.preset ?? "card"
});

export const paymentKeys = {
  all: ["payments"] as const,
  summary: () => ["payments", "summary"] as const,
  adminList: (params: ReturnType<typeof normalizeParams>) => ["payments", "admin", "list", params] as const,
  adminDetail: (paymentId: string) => ["payments", "admin", "detail", paymentId] as const
};

export const usePaymentSummary = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: paymentKeys.summary(),
    queryFn: fetchPaymentSummary,
    staleTime: 60_000,
    enabled: options?.enabled ?? true
  });
};

export const useAdminPayments = (params: PaymentListParams, options?: { enabled?: boolean }) => {
  const normalized = normalizeParams(params);
  return useQuery<PaymentListResult>({
    queryKey: paymentKeys.adminList(normalized),
    queryFn: () => fetchAdminPayments(params),
    keepPreviousData: true,
    enabled: options?.enabled ?? true
  });
};

export const useAdminPaymentDetail = (paymentId: string | null, preset: PaymentListParams["preset"] = "detail") => {
  return useQuery({
    queryKey: paymentId ? paymentKeys.adminDetail(paymentId) : ["payments", "admin", "detail", "unknown"],
    queryFn: () => {
      if (!paymentId) {
        return Promise.reject(new Error("paymentId required"));
      }
      return fetchAdminPayment(paymentId, preset ?? "detail");
    },
    enabled: Boolean(paymentId)
  });
};

export const useRetryPaymentMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => retryPayment(paymentId),
    onSuccess: (_data, paymentId) => {
      if (paymentId) {
        queryClient.invalidateQueries({ queryKey: paymentKeys.adminDetail(paymentId) }).catch(() => undefined);
      }
      queryClient.invalidateQueries({ queryKey: ["payments", "admin"], exact: false }).catch(() => undefined);
    }
  });
};
