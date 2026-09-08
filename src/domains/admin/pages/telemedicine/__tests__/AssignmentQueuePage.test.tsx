import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

import AssignmentQueuePage from "../AssignmentQueuePage";
import type { TelemedicineAssignmentBooking } from "../../../../../shared/schemas/telemedicine";

const hooks = vi.hoisted(() => ({
  useAssignmentQueue: vi.fn(),
  useAssignProviderMutation: vi.fn(),
  useProposeRebookingMutation: vi.fn(),
  useTechnicalIssues: vi.fn(),
  useTelemedicinePolicy: vi.fn(),
  useBookingList: vi.fn()
}));

vi.mock("../../../../../shared/hooks/useTelemedicine", () => ({
  useAssignmentQueue: hooks.useAssignmentQueue,
  useAssignProviderMutation: hooks.useAssignProviderMutation,
  useProposeRebookingMutation: hooks.useProposeRebookingMutation,
  useTechnicalIssues: hooks.useTechnicalIssues,
  useTelemedicinePolicy: hooks.useTelemedicinePolicy
}));

vi.mock("../../../../../shared/hooks/useBookings", () => ({
  useBookingList: hooks.useBookingList
}));

vi.mock("../../../../../shared/components/ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn(), push: vi.fn() })
}));

// The card renders it per booking and it fetches on its own; the queue's own behaviour is what
// is under test here.
vi.mock("../../../components/PreferenceSummary", () => ({
  PreferenceSummary: () => null
}));

const booking = (overrides: Partial<TelemedicineAssignmentBooking> = {}): TelemedicineAssignmentBooking => ({
  id: "0c429cf5-9443-4b24-b2a1-e63a8da8d3ae",
  facilityId: "facility-1",
  serviceId: "service-1",
  serviceName: "Counselling Session",
  clientUserId: "client-1",
  clientFullName: "John Wanyonyi",
  scheduledAt: "2026-09-10T06:00:00.000Z",
  estimateDurationMinutes: 30,
  status: "telemedicine_paid_pending_assignment",
  recoveryState: "assignable",
  paymentReviewPending: false,
  assignableProviders: [{ providerUserId: "provider-1", fullName: "Dr. Miriam Naliaka" }],
  ...overrides
});

const renderQueue = (queue: TelemedicineAssignmentBooking[]) => {
  hooks.useAssignmentQueue.mockReturnValue({ data: queue, isLoading: false, isFetching: false, dataUpdatedAt: 0, refetch: vi.fn() });
  return render(<AssignmentQueuePage />, { wrapper: MemoryRouter });
};

beforeEach(() => {
  hooks.useAssignProviderMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  hooks.useProposeRebookingMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  hooks.useTechnicalIssues.mockReturnValue({ data: [], isLoading: false });
  hooks.useTelemedicinePolicy.mockReturnValue({ data: { defaultTimezone: "Africa/Nairobi" } });
  hooks.useBookingList.mockReturnValue({ data: { bookings: [] }, isLoading: false, isError: false });
});

describe("AssignmentQueuePage recovery states", () => {
  it("offers Assign for a booking whose slot is still held", () => {
    renderQueue([booking()]);

    expect(screen.getByRole("button", { name: "Assign" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Offer new time" })).not.toBeInTheDocument();
  });

  it("offers a replacement time, not Assign, once the slot has lapsed", () => {
    // The reported bug: the card showed a provider picker and an Assign button for a booking
    // the backend refuses with "No active hold protects this booking's slot".
    renderQueue([booking({ recoveryState: "needs_rebooking", paymentReviewPending: true, assignableProviders: [] })]);

    expect(screen.getByRole("button", { name: "Offer new time" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign" })).not.toBeInTheDocument();
    expect(screen.getByText(/slot was released before a provider was assigned/i)).toBeInTheDocument();
  });

  it("says the payment is not taken again when offering a new time", () => {
    renderQueue([booking({ recoveryState: "needs_rebooking", assignableProviders: [] })]);

    expect(screen.getByText(/No new payment is taken/i)).toBeInTheDocument();
  });

  it("shows neither action while the client is deciding", () => {
    renderQueue([booking({ recoveryState: "awaiting_client", assignableProviders: [] })]);

    expect(screen.getByText("Awaiting client")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Offer new time" })).not.toBeInTheDocument();
  });

  it("exposes no hold or dispute identifiers on the card", () => {
    const { container } = renderQueue([booking({ recoveryState: "needs_rebooking", assignableProviders: [] })]);

    expect(container.textContent).not.toMatch(/hold_id|dispute_id|holdId|disputeId/i);
  });
});
