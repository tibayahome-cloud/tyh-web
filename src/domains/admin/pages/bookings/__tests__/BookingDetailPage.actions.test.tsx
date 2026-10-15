/**
 * What a super admin can do from a booking's page: assign or reassign the provider, and cancel with a
 * required reason, with the state of the booking deciding which of those are offered.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

let booking: Record<string, unknown>;

vi.mock("../../../../../shared/hooks/useBookings", () => ({
  useBookingDetail: () => ({ data: booking, isLoading: false, refetch: vi.fn() }),
  useBookingEvents: () => ({ data: [], isLoading: false }),
  useCancelBookingMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePayBookingMutation: () => ({ mutateAsync: vi.fn(), isPending: false })
}));
vi.mock("../../../../../shared/hooks/useTelemedicine", () => ({
  useTelemedicineReschedules: () => ({ data: [], isLoading: false })
}));
vi.mock("../../../components/TelemedicineReassignModal", () => ({
  default: ({ open, mode }: { open: boolean; mode?: string }) => (open ? <div role="dialog">telemedicine modal: {mode}</div> : null)
}));
vi.mock("../../../components/ReassignBookingModal", () => ({ default: () => null }));
vi.mock("../../../../../shared/components/BookingLiveMapCard", () => ({ BookingLiveMapCard: () => null }));
vi.mock("../../../../../shared/components/ToastProvider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import AdminBookingDetailPage from "../BookingDetailPage";

const base = {
  id: "b1",
  isTelemedicine: true,
  client: { id: "c1", fullName: "Micubu James" },
  provider: null,
  service: { id: "s1", name: "First Medical Consultation" },
  scheduledAt: "2026-10-15T12:50:00Z",
  paidAt: "2026-10-15T12:14:00Z",
  estimateDurationMinutes: 30,
  telemedicineSession: null
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/admin/bookings/b1"]}>
      <Routes>
        <Route path="/admin/bookings/:bookingId" element={<AdminBookingDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  booking = { ...base, status: "telemedicine_paid_pending_assignment" };
});

describe("telemedicine booking actions", () => {
  it("offers Assign provider on a paid consultation that has no provider, in assign mode", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Assign provider" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("telemedicine modal: assign");
  });

  it("offers Reassign provider on a confirmed consultation that has not started, in reassign mode", async () => {
    booking = { ...base, status: "scheduled", provider: { id: "p1", fullName: "Dr Denis Gitobu" } };
    const user = userEvent.setup();
    renderPage();
    expect(screen.queryByRole("button", { name: "Assign provider" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reassign provider" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("telemedicine modal: reassign");
  });

  it("does not offer reassigning once the call has started", () => {
    booking = {
      ...base, status: "scheduled", provider: { id: "p1", fullName: "Dr Denis Gitobu" },
      telemedicineSession: { status: "in_progress", providerJoinedAt: "2026-10-15T12:50:30Z", clientJoinedAt: null }
    };
    renderPage();
    expect(screen.queryByRole("button", { name: "Reassign provider" })).not.toBeInTheDocument();
  });

  it("explains a booking cancelled after payment and offers nothing to change", () => {
    booking = { ...base, status: "telemedicine_cancelled_payment_review" };
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(/cancelled after payment/i);
    expect(screen.getByRole("status")).toHaveTextContent(/needs to book a new one|book a new one/i);
    expect(screen.queryByRole("button", { name: "Cancel booking" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign provider" })).not.toBeInTheDocument();
  });

  it("warns before cancelling a paid telemedicine booking, with no reason pre-selected", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/cannot be undone/i);
    expect(screen.getByRole("combobox", { name: /Reason/ })).toHaveValue("");
  });
});
