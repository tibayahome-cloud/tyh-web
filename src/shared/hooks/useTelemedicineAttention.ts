import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  acknowledgeAttentionItem,
  acceptReschedule,
  acceptRebookingOffer,
  declineReschedule,
  declineRebookingOffer,
  fetchTelemedicineAttention,
  type AttentionItem
} from "../libs/telemedicineOps";
import { bookingKeys } from "./useBookings";

export const attentionKey = ["telemedicine", "attention"] as const;

// What is waiting on the signed-in person. Refreshed on focus and on a timer so a proposal made while
// the app is open turns up without a reload. A failure here only means no marker, never a broken page.
export const useTelemedicineAttention = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: attentionKey,
    queryFn: fetchTelemedicineAttention,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false
  });

export type AttentionAnswer = "accept" | "decline";

export const useAnswerAttention = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ item, answer }: { item: AttentionItem; answer: AttentionAnswer }) => {
      if (item.kind === "rebooking_offer") {
        return answer === "accept" ? acceptRebookingOffer(item.bookingId) : declineRebookingOffer(item.bookingId);
      }
      return (answer === "accept" ? acceptReschedule(item.id) : declineReschedule(item.id)).then(() => undefined);
    },
    onSettled: (_data, _error, { item }) => {
      queryClient.invalidateQueries({ queryKey: attentionKey }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists(), exact: false }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ["telemedicine", "reschedules", item.bookingId] }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(item.bookingId) }).catch(() => undefined);
    }
  });
};

// Opening a heads-up that needs no answer. The list is refreshed so the marker goes as soon as the server
// has recorded it; if recording fails the item simply stays, which is the honest outcome.
export const useAcknowledgeAttention = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (item: AttentionItem) => acknowledgeAttentionItem(item.id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: attentionKey }).catch(() => undefined);
    }
  });
};
