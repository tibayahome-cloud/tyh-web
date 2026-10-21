import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchPaymentRequest, sendPaymentRequest } from "../libs/paymentRequest";
import { bookingKeys } from "./useBookings";

export const paymentRequestKey = (bookingId: string) => ["bookings", "payment-request", bookingId] as const;

/** Where the payment request for a finished visit stands, checked every few seconds while someone is waiting on it. */
export const usePaymentRequest = (bookingId: string | null, options?: { enabled?: boolean; pollMs?: number }) =>
  useQuery({
    queryKey: paymentRequestKey(bookingId ?? "none"),
    queryFn: () => fetchPaymentRequest(bookingId as string),
    enabled: Boolean(bookingId) && (options?.enabled ?? true),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state === "sending" || state === "waiting" ? (options?.pollMs ?? 5000) : false;
    }
  });

export const useSendPaymentRequest = (bookingId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payerPhone?: string) => sendPaymentRequest(bookingId, payerPhone),
    onSuccess: (state) => {
      queryClient.setQueryData(paymentRequestKey(bookingId), state);
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() }).catch(() => undefined);
    }
  });
};
