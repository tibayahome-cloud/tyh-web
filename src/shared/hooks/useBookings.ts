import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  Booking,
  BookingConfirmDecision,
  BookingLocationInput,
  BookingMarkAction,
  BookingMutateInput,
  BookingFeedbackInput
} from "../schemas/booking";
import { fetchBooking, fetchBookingEvents, fetchBookings, createBooking, acceptBooking, markBooking, confirmBooking, cancelBooking, postBookingLocation, reassignBooking, submitBookingFeedback } from "../libs/bookings";
import type { BookingListParams, BookingPresetName } from "../libs/bookings";

const normalizeListParams = (params: BookingListParams = {}) => ({
  page: params.page ?? 1,
  pageSize: params.pageSize ?? 25,
  statuses: params.statuses ? [...params.statuses].sort() : [],
  clientId: params.clientId ?? null,
  providerId: params.providerId ?? null,
  serviceId: params.serviceId ?? null,
  from: params.from ?? null,
  to: params.to ?? null,
  scheduledFrom: params.scheduledFrom ?? null,
  scheduledTo: params.scheduledTo ?? null,
  preset: params.preset ?? "card"
});

export const bookingKeys = {
  all: ["bookings"] as const,
  lists: () => ["bookings", "list"] as const,
  list: (params: ReturnType<typeof normalizeListParams>) => ["bookings", "list", params] as const,
  detail: (bookingId: string) => ["bookings", "detail", bookingId] as const,
  events: (bookingId: string) => ["bookings", "events", bookingId] as const
};

export const useBookingList = (
  params: BookingListParams,
  options?: { enabled?: boolean }
) => {
  const normalized = normalizeListParams(params);
  return useQuery({
    queryKey: bookingKeys.list(normalized),
    queryFn: () => fetchBookings(params),
    placeholderData: (previousData) => previousData,
    enabled: options?.enabled ?? true
  });
};

export const useBookingDetail = (
  bookingId: string | null,
  preset: BookingPresetName = "detail",
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: bookingId ? bookingKeys.detail(bookingId) : ["bookings", "detail", "unknown"],
    queryFn: () => {
      if (!bookingId) {
        return Promise.reject(new Error("bookingId required"));
      }
      return fetchBooking(bookingId, preset);
    },
    enabled: Boolean(bookingId) && (options?.enabled ?? true)
  });
};

export const useBookingEvents = (bookingId: string | null, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: bookingId ? bookingKeys.events(bookingId) : ["bookings", "events", "unknown"],
    queryFn: () => {
      if (!bookingId) {
        return Promise.reject(new Error("bookingId required"));
      }
      return fetchBookingEvents(bookingId);
    },
    enabled: Boolean(bookingId) && (options?.enabled ?? true)
  });
};

const useInvalidateBookingLists = () => {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: bookingKeys.lists(), exact: false }).catch(() => undefined);
};

const useStoreBookingDetail = () => {
  const queryClient = useQueryClient();
  return (booking: Booking) => {
    queryClient.setQueryData(bookingKeys.detail(booking.id), booking);
  };
};

export const useCreateBookingMutation = (preset: BookingPresetName = "detail") => {
  const storeBooking = useStoreBookingDetail();
  const invalidateLists = useInvalidateBookingLists();
  return useMutation({
    mutationFn: (input: BookingMutateInput) => createBooking(input, preset),
    onSuccess: (result) => {
      storeBooking(result.booking);
      invalidateLists();
    }
  });
};

export const useAcceptBookingMutation = (preset: BookingPresetName = "detail") => {
  const storeBooking = useStoreBookingDetail();
  const invalidateLists = useInvalidateBookingLists();
  return useMutation({
    mutationFn: (bookingId: string) => acceptBooking(bookingId, preset),
    onSuccess: (booking) => {
      storeBooking(booking);
      invalidateLists();
    }
  });
};

export const useMarkBookingMutation = (preset: BookingPresetName = "detail") => {
  const storeBooking = useStoreBookingDetail();
  const invalidateLists = useInvalidateBookingLists();
  return useMutation({
    mutationFn: ({ bookingId, action }: { bookingId: string; action: BookingMarkAction }) =>
      markBooking(bookingId, action, preset),
    onSuccess: (booking) => {
      storeBooking(booking);
      invalidateLists();
    }
  });
};

export const useConfirmBookingMutation = (preset: BookingPresetName = "detail") => {
  const storeBooking = useStoreBookingDetail();
  const invalidateLists = useInvalidateBookingLists();
  return useMutation({
    mutationFn: ({
      bookingId,
      decision,
      reason,
      phone             
    }: {
      bookingId: string;
      decision: BookingConfirmDecision;
      reason?: string;
      phone?: string;
    }) => confirmBooking(bookingId, decision, reason, phone, preset),
    onSuccess: (booking) => {
      storeBooking(booking);
      invalidateLists();
    }
  });
};

export const useCancelBookingMutation = (preset: BookingPresetName = "detail") => {
  const storeBooking = useStoreBookingDetail();
  const invalidateLists = useInvalidateBookingLists();
  return useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) =>
      cancelBooking(bookingId, reason, preset),
    onSuccess: (booking) => {
      storeBooking(booking);
      invalidateLists();
    }
  });
};

export const useBookingLocationMutation = () => {
  return useMutation({
    mutationFn: ({ bookingId, input }: { bookingId: string; input: BookingLocationInput }) =>
      postBookingLocation(bookingId, input)
  });
};

export const useReassignBookingMutation = (preset: BookingPresetName = "detail") => {
  const storeBooking = useStoreBookingDetail();
  const invalidateLists = useInvalidateBookingLists();
  return useMutation({
    mutationFn: ({ bookingId, providerUserId, reason }: { bookingId: string; providerUserId: string; reason?: string }) =>
      reassignBooking(bookingId, providerUserId, reason, preset),
    onSuccess: (booking) => {
      storeBooking(booking);
      invalidateLists();
    }
  });
};

export const useCreateFeedbackMutation = () => {
  const invalidateLists = useInvalidateBookingLists();
  return useMutation({
    mutationFn: (variables: BookingFeedbackInput & { bookingId: string }) => {
      const { bookingId, ...input } = variables;
      return submitBookingFeedback(bookingId, input);
    },
    onSuccess: () => {
      invalidateLists();
    }
  });
};
