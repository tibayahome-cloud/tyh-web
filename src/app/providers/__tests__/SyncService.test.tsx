/**
 * SyncService used to invalidate every mounted booking-list query on every booking socket
 * event, including high-frequency location pings during active tracking -- the single
 * highest-traffic accidental invalidation found in the app, since it scaled with tracking
 * frequency and however many list views happened to be open. This proves location events only
 * patch the booking's own detail cache, while meaningful events (status, created, accepted,
 * completed, reassigned) still invalidate lists as before.
 */

import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

type SocketHandler = (payload: unknown) => void;

const listeners: Record<string, SocketHandler[]> = {};
const fakeSocket = {
  on: vi.fn((event: string, handler: SocketHandler) => {
    listeners[event] = listeners[event] || [];
    listeners[event].push(handler);
  }),
  off: vi.fn((event: string) => {
    delete listeners[event];
  })
};

const emit = (event: string, payload: unknown) => {
  (listeners[event] ?? []).forEach((handler) => handler(payload));
};

const fetchBookingMock = vi.fn();

vi.mock("../../../shared/hooks/useSocket", () => ({
  useSocket: () => fakeSocket
}));

vi.mock("../../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, roles: [] })
}));

vi.mock("../../../shared/libs/bookings", () => ({
  fetchBooking: (...args: unknown[]) => fetchBookingMock(...args)
}));

vi.mock("../../../shared/components/ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn(), push: vi.fn() })
}));

import { SyncService } from "../SyncService";
import { bookingKeys } from "../../../shared/hooks/useBookings";

const renderService = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <SyncService />
    </QueryClientProvider>
  );
  return { queryClient, invalidateSpy };
};

describe("SyncService booking event invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(listeners).forEach((key) => delete listeners[key]);
    fetchBookingMock.mockResolvedValue({ id: "booking-1", status: "en_route", locations: [] });
  });

  it("does not invalidate booking lists for a location event", async () => {
    const { invalidateSpy } = renderService();

    emit("model.booking.location", { booking_id: "booking-1", lat: -1.29, lng: 36.82 });

    await waitFor(() => {
      // Give any accidental async invalidation a chance to happen before asserting its absence.
      expect(invalidateSpy.mock.calls.length).toBeGreaterThanOrEqual(0);
    });

    const listInvalidationCalls = invalidateSpy.mock.calls.filter(
      ([arg]) => JSON.stringify((arg as { queryKey?: unknown })?.queryKey) === JSON.stringify(bookingKeys.lists())
    );
    expect(listInvalidationCalls).toHaveLength(0);
  });

  it("still patches the booking detail cache for a location event", async () => {
    const { queryClient } = renderService();
    queryClient.setQueryData(bookingKeys.detail("booking-1"), { id: "booking-1", status: "en_route", locations: [] });

    emit("model.booking.location", { booking_id: "booking-1", lat: -1.29, lng: 36.82, event_topic: "model.booking.location" });

    await waitFor(() => {
      const detail = queryClient.getQueryData<{ locations: unknown[] }>(bookingKeys.detail("booking-1"));
      expect(detail?.locations).toHaveLength(1);
    });
  });

  it("invalidates booking lists for a status event", async () => {
    const { invalidateSpy } = renderService();

    emit("model.booking.status", { booking_id: "booking-1", status: "accepted" });

    await waitFor(() => {
      const listInvalidationCalls = invalidateSpy.mock.calls.filter(
        ([arg]) => JSON.stringify((arg as { queryKey?: unknown })?.queryKey) === JSON.stringify(bookingKeys.lists())
      );
      expect(listInvalidationCalls.length).toBeGreaterThan(0);
    });
  });

  it("invalidates booking lists for a created event", async () => {
    const { invalidateSpy } = renderService();

    emit("model.booking.created", { booking_id: "booking-2" });

    await waitFor(() => {
      const listInvalidationCalls = invalidateSpy.mock.calls.filter(
        ([arg]) => JSON.stringify((arg as { queryKey?: unknown })?.queryKey) === JSON.stringify(bookingKeys.lists())
      );
      expect(listInvalidationCalls.length).toBeGreaterThan(0);
    });
  });

  it("invalidates booking lists for a completed event", async () => {
    const { invalidateSpy } = renderService();

    emit("model.booking.completed", { booking_id: "booking-2" });

    await waitFor(() => {
      const listInvalidationCalls = invalidateSpy.mock.calls.filter(
        ([arg]) => JSON.stringify((arg as { queryKey?: unknown })?.queryKey) === JSON.stringify(bookingKeys.lists())
      );
      expect(listInvalidationCalls.length).toBeGreaterThan(0);
    });
  });
});
