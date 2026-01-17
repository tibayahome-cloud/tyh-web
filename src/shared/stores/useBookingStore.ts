import { create } from "zustand";

import type { Booking } from "../schemas/booking";

type BookingStoreState = {
  active: Record<string, Booking>;
  selectedBookingId?: string;
  setSelectedBooking: (bookingId: string | undefined) => void;
  upsertBooking: (booking: Booking) => void;
  removeBooking: (bookingId: string) => void;
  clear: () => void;
};

export const useBookingStore = create<BookingStoreState>((set) => ({
  active: {},
  selectedBookingId: undefined,
  setSelectedBooking: (bookingId) =>
    set(() => ({
      selectedBookingId: bookingId
    })),
  upsertBooking: (booking) =>
    set((state) => ({
      active: {
        ...state.active,
        [booking.id]: booking
      }
    })),
  removeBooking: (bookingId) =>
    set((state) => {
      if (!state.active[bookingId]) {
        return state;
      }
      const next = { ...state.active };
      delete next[bookingId];
      return {
        active: next,
        selectedBookingId: state.selectedBookingId === bookingId ? undefined : state.selectedBookingId
      };
    }),
  clear: () =>
    set(() => ({
      active: {},
      selectedBookingId: undefined
    }))
}));
