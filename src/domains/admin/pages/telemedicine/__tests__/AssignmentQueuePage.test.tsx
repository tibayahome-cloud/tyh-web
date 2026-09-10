import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

  it("says the client is not charged again when offering a new time", () => {
    renderQueue([booking({ recoveryState: "needs_rebooking", assignableProviders: [] })]);

    expect(screen.getByText(/not charged again/i)).toBeInTheDocument();
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

describe("offering a replacement time from outside the facility's timezone", () => {
  // Node re-reads process.env.TZ on assignment, so this moves the ambient zone the way sitting
  // at a machine in New York would. The submitted instant must not depend on it.
  const ORIGINAL_TZ = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "America/New_York";
  });

  afterAll(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it("submits the instant the chosen facility-local time names, not the operator's own", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    hooks.useProposeRebookingMutation.mockReturnValue({ mutateAsync, isPending: false });
    renderQueue([booking({ recoveryState: "needs_rebooking", assignableProviders: [] })]);

    fireEvent.change(screen.getByLabelText(/Choose a replacement time/i), {
      target: { value: "2026-09-10T09:00" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Offer new time" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    // 09:00 in Nairobi (UTC+3), not 09:00 in New York.
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ proposedStartAt: "2026-09-10T06:00:00.000Z" })
    );
  });

  it("tells the operator which timezone the picker is in", () => {
    renderQueue([booking({ recoveryState: "needs_rebooking", assignableProviders: [] })]);

    expect(screen.getByText(/Africa\/Nairobi/)).toBeInTheDocument();
  });

  it("will not offer a time until the facility timezone is known", () => {
    // Guessing the browser's zone here books a real appointment at the wrong hour, so the
    // action waits for the policy rather than falling back.
    hooks.useTelemedicinePolicy.mockReturnValue({ data: undefined });
    renderQueue([booking({ recoveryState: "needs_rebooking", assignableProviders: [] })]);

    fireEvent.change(screen.getByLabelText(/Choose a replacement time/i), {
      target: { value: "2026-09-10T09:00" }
    });
    expect(screen.getByRole("button", { name: "Offer new time" })).toBeDisabled();
  });
});
