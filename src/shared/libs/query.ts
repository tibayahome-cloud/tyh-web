import { QueryClient } from "@tanstack/react-query";
import { fetchBooking } from "./bookings";
import { bookingKeys } from "../hooks/useBookings";

const shouldRetry = (failureCount: number, error: unknown) => {
  if (failureCount > 0) {
    return false;
  }

  const axiosError = error as { response?: { status?: number }; config?: { url?: string } };
  const status = axiosError.response?.status;
  if (status === 401 || status === 403) {
    return false;
  }

  const url = axiosError.config?.url ?? "";
  if (url.includes("/auth/")) {
    return false;
  }

  return true;
};

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: shouldRetry
      },
      mutations: {
        retry: false
      }
    }
  });

export const queryClient = createQueryClient();

/**
 * High-performance prefetching utility for booking details.
 * Call this on hover over booking cards to eliminate transition delay.
 */
export const prefetchBooking = async (bookingId: string) => {
  return queryClient.prefetchQuery({
    queryKey: bookingKeys.detail(bookingId),
    queryFn: () => fetchBooking(bookingId, "detail"),
    staleTime: 30_000 // Prememptive load is valid for 30s
  });
};

/**
 * Prefetcher for global registries.
 */
export const prefetchRegistries = async () => {
  // Add global prefetches here (Services, FAQs, etc.)
};
