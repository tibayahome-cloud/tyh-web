import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import AssignmentQueuePage from "../AssignmentQueuePage";
import type { TelemedicineAssignmentBooking } from "../../../../../shared/schemas/telemedicine";
import type { Booking } from "../../../../../shared/schemas/booking";

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

const consultationBooking = (overrides: Partial<Booking> = {}): Booking => ({
  id: "9f8c1e2a-1111-4b24-b2a1-e63a8da8d3ae",
  status: "accepted",
  scheduledAt: "2026-09-10T06:00:00.000Z",
  bookingType: "scheduled",
  parentBookingId: null,
  preferredProviderId: null,
  facilityId: "facility-1",
  requestMode: "selected_facility",
  facilityStatus: null,
  facilityClaimedAt: null,
  facilityResponseDueAt: null,
  clientConfirmedRerouteAt: null,
  addressText: null,
  lat: null,
  lng: null,
  priceCents: 150000,
  currency: "KES",
  estimateDurationMinutes: 30,
  acceptedAt: null,
  arrivedAt: null,
  serviceStartedAt: null,
  serviceCompletedAt: null,
  clientConfirmedAt: null,
  paidAt: null,
  cancelledAt: null,
  cancelReason: null,
  escalationAt: null,
  escalatedAt: null,
  createdAt: null,
  updatedAt: null,
  meta: {},
  client: { id: "client-1", fullName: "John Wanyonyi", avatarUrl: null, email: null, phone: null },
  provider: null,
  service: { id: "service-1", name: "Counselling Session", key: "counselling", basePriceCents: 150000, defaultEstimateMinutes: 30 },
  locations: [],
  events: [],
  feedback: [],
  disputes: [],
  isTelemedicine: true,
  paymentReviewPending: false,
  telemedicineSession: null,
  ...overrides
});

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

    // "Awaiting client" also appears in the summary strip's stat label, so this scopes to the
    // row's own action slot rather than asserting on the ambiguous bare text.
    const panel = screen.getByRole("tabpanel", { name: /action queue/i });
    expect(within(panel).getByText("Awaiting client")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Offer new time" })).not.toBeInTheDocument();
  });

  it("exposes no hold or dispute identifiers on the card", () => {
    const { container } = renderQueue([booking({ recoveryState: "needs_rebooking", assignableProviders: [] })]);

    expect(container.textContent).not.toMatch(/hold_id|dispute_id|holdId|disputeId/i);
  });
});

describe("assignment queue error state", () => {
  it("shows a retryable error banner instead of the empty-queue message when the queue fails to load", async () => {
    // Only isLoading was checked before; a fetch failure fell through to the same "No
    // consultations waiting for assignment" copy as a genuinely empty queue.
    const refetch = vi.fn();
    hooks.useAssignmentQueue.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error(),
      isFetching: false,
      dataUpdatedAt: 0,
      refetch
    });

    render(<AssignmentQueuePage />, { wrapper: MemoryRouter });

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/couldn't load the assignment queue/i)).toBeInTheDocument();
    expect(screen.queryByText(/no consultations waiting for assignment/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
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

describe("page header", () => {
  it("describes the whole workspace, not just assignment -- the queue also covers rebookings", () => {
    renderQueue([booking()]);

    expect(screen.getByText("Manage assignments, rebookings, consultations, and review flags.")).toBeInTheDocument();
    // The old copy specifically named only "awaiting an eligible provider", which undersold the
    // needs-rebooking, awaiting-client, consultations, and review-flags parts of this page.
    expect(screen.queryByText(/awaiting an eligible provider/i)).not.toBeInTheDocument();
  });
});

describe("workspace navigation", () => {
  it("defaults to the Action queue view with the queue tab marked active", () => {
    renderQueue([booking()]);

    const queueTab = screen.getByRole("tab", { name: /action queue/i });
    const consultationsTab = screen.getByRole("tab", { name: /^consultations/i });
    const reviewTab = screen.getByRole("tab", { name: /review flags/i });

    expect(queueTab).toHaveAttribute("aria-selected", "true");
    expect(consultationsTab).toHaveAttribute("aria-selected", "false");
    expect(reviewTab).toHaveAttribute("aria-selected", "false");

    expect(screen.getByRole("tabpanel", { name: /action queue/i })).toBeInTheDocument();
    expect(screen.queryByRole("tabpanel", { name: /^consultations/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign" })).toBeInTheDocument();
  });

  it("switches views when a tab is clicked, and only one panel is shown at a time", () => {
    renderQueue([booking()]);

    fireEvent.click(screen.getByRole("tab", { name: /^consultations/i }));

    expect(screen.getByRole("tab", { name: /^consultations/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /action queue/i })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel", { name: /^consultations/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /review flags/i }));

    expect(screen.getByRole("tab", { name: /review flags/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: /review flags/i })).toBeInTheDocument();
  });

  it("moves between tabs with the arrow keys", () => {
    renderQueue([booking()]);

    const queueTab = screen.getByRole("tab", { name: /action queue/i });
    queueTab.focus();
    fireEvent.keyDown(queueTab, { key: "ArrowRight" });

    expect(screen.getByRole("tab", { name: /^consultations/i })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(screen.getByRole("tab", { name: /^consultations/i }), { key: "ArrowLeft" });

    expect(screen.getByRole("tab", { name: /action queue/i })).toHaveAttribute("aria-selected", "true");
  });

  it("moves DOM focus onto the newly selected tab, not just its aria-selected/tabIndex state", () => {
    renderQueue([booking()]);

    const queueTab = screen.getByRole("tab", { name: /action queue/i });
    const consultationsTab = screen.getByRole("tab", { name: /^consultations/i });
    const reviewTab = screen.getByRole("tab", { name: /review flags/i });

    queueTab.focus();
    expect(document.activeElement).toBe(queueTab);

    fireEvent.keyDown(queueTab, { key: "ArrowRight" });
    expect(document.activeElement).toBe(consultationsTab);
    expect(consultationsTab).toHaveAttribute("tabindex", "0");
    expect(queueTab).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(consultationsTab, { key: "ArrowRight" });
    expect(document.activeElement).toBe(reviewTab);
    expect(reviewTab).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(reviewTab, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(consultationsTab);
  });
});

describe("summary strip", () => {
  it("derives counts from already-loaded queue and review-flag data, not a new request", () => {
    hooks.useTechnicalIssues.mockReturnValue({
      data: [
        { id: "issue-1", bookingId: "b-1", status: "open", reporterRole: "client", category: "no_show" },
        { id: "issue-2", bookingId: "b-2", status: "resolved", reporterRole: "client", category: "no_show" }
      ],
      isLoading: false
    });

    renderQueue([
      booking({ id: "b-1", recoveryState: "assignable" }),
      booking({ id: "b-2", recoveryState: "assignable" }),
      booking({ id: "b-3", recoveryState: "needs_rebooking", assignableProviders: [] }),
      booking({ id: "b-4", recoveryState: "awaiting_client", assignableProviders: [] })
    ]);

    // Only the one open issue counts -- resolved reports don't inflate the flag count, matching
    // TechnicalIssueReviewList's own open-issues filter.
    expect(screen.getByLabelText("2 Awaiting assignment")).toBeInTheDocument();
    expect(screen.getByLabelText("1 Needs rebooking")).toBeInTheDocument();
    expect(screen.getByLabelText("1 Awaiting client")).toBeInTheDocument();
    expect(screen.getByLabelText("1 Review flags")).toBeInTheDocument();

    // No hook beyond the ones the page already called for its own views was invoked.
    expect(hooks.useAssignmentQueue).toHaveBeenCalled();
    expect(hooks.useTechnicalIssues).toHaveBeenCalled();
  });

  it("shows a badge on the Action queue and Review flags tabs matching the summary counts", () => {
    hooks.useTechnicalIssues.mockReturnValue({
      data: [{ id: "issue-1", bookingId: "0c429cf5-9443-4b24-b2a1-e63a8da8d3ae", status: "open", reporterRole: "client", category: "no_show" }],
      isLoading: false
    });
    renderQueue([booking({ recoveryState: "assignable" })]);

    const queueTab = screen.getByRole("tab", { name: /action queue/i });
    const reviewTab = screen.getByRole("tab", { name: /review flags/i });
    expect(within(queueTab).getByText("1")).toBeInTheDocument();
    expect(within(reviewTab).getByText("1")).toBeInTheDocument();
  });

  it("badges the Consultations tab with the total across Upcoming, Active, and History, not just Upcoming", () => {
    // One of each: an upcoming, an in-session ("Active"), and a historical consultation. The
    // tab is labeled "Consultations" (not "Upcoming consultations"), so its badge must reflect
    // everything reachable from that tab, or it silently undercounts the moment anything is
    // active or historical.
    hooks.useBookingList.mockReturnValue({
      data: {
        bookings: [
          consultationBooking({ id: "upcoming-1", status: "accepted", telemedicineSession: null }),
          consultationBooking({
            id: "active-1",
            status: "in_service",
            telemedicineSession: {
              id: "session-1",
              roomName: null,
              status: "in_progress",
              providerJoinedAt: null,
              clientJoinedAt: null,
              startedAt: null,
              endedAt: null
            }
          }),
          consultationBooking({ id: "history-1", status: "fully_completed", telemedicineSession: null })
        ]
      },
      isLoading: false,
      isError: false
    });
    renderQueue([]);

    const consultationsTab = screen.getByRole("tab", { name: /^consultations/i });
    // Exactly one "3" in the tab's own badge -- not "1" (the old, Upcoming-only count).
    expect(within(consultationsTab).getByText("3")).toBeInTheDocument();
    expect(within(consultationsTab).queryByText("1")).not.toBeInTheDocument();
  });
});

describe("consultations view", () => {
  const setUpcomingActiveHistory = () => {
    hooks.useBookingList.mockReturnValue({
      data: {
        bookings: [
          consultationBooking({
            id: "upcoming-1",
            status: "accepted",
            service: { id: "service-upcoming", name: "Upcoming Consult", key: null, basePriceCents: 150000, defaultEstimateMinutes: 30 },
            telemedicineSession: null
          }),
          consultationBooking({
            id: "active-1",
            status: "in_service",
            service: { id: "service-active", name: "Active Consult", key: null, basePriceCents: 150000, defaultEstimateMinutes: 30 },
            telemedicineSession: { id: "session-1", roomName: null, status: "in_progress", providerJoinedAt: null, clientJoinedAt: null, startedAt: null, endedAt: null }
          }),
          consultationBooking({
            id: "history-1",
            status: "fully_completed",
            service: { id: "service-history", name: "History Consult", key: null, basePriceCents: 150000, defaultEstimateMinutes: 30 },
            telemedicineSession: null
          })
        ]
      },
      isLoading: false,
      isError: false
    });
  };

  it("defaults to Upcoming and excludes active/history consultations", () => {
    setUpcomingActiveHistory();
    renderQueue([]);

    fireEvent.click(screen.getByRole("tab", { name: /^consultations/i }));

    expect(screen.getByRole("tab", { name: "Upcoming 1" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Upcoming Consult")).toBeInTheDocument();
    expect(screen.queryByText("Active Consult")).not.toBeInTheDocument();
    expect(screen.queryByText("History Consult")).not.toBeInTheDocument();
  });

  it("switches to Active and History via the internal filter", () => {
    setUpcomingActiveHistory();
    renderQueue([]);

    fireEvent.click(screen.getByRole("tab", { name: /^consultations/i }));
    fireEvent.click(screen.getByRole("tab", { name: "Active 1" }));

    expect(screen.getByText("Active Consult")).toBeInTheDocument();
    expect(screen.queryByText("Upcoming Consult")).not.toBeInTheDocument();
    expect(screen.queryByText("History Consult")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "History 1" }));

    expect(screen.getByText("History Consult")).toBeInTheDocument();
    expect(screen.queryByText("Active Consult")).not.toBeInTheDocument();
    expect(screen.queryByText("Upcoming Consult")).not.toBeInTheDocument();
  });

  it("preserves booking links, status badges, and payment-review badges", () => {
    hooks.useBookingList.mockReturnValue({
      data: {
        bookings: [
          consultationBooking({
            id: "linked-1",
            status: "accepted",
            paymentReviewPending: true,
            telemedicineSession: { id: "session-2", roomName: null, status: "scheduled", providerJoinedAt: null, clientJoinedAt: null, startedAt: null, endedAt: null }
          })
        ]
      },
      isLoading: false,
      isError: false
    });
    renderQueue([]);

    fireEvent.click(screen.getByRole("tab", { name: /^consultations/i }));

    const link = screen.getByRole("link", { name: /Counselling Session/i });
    expect(link).toHaveAttribute("href", "/admin/bookings/linked-1");
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByText("Payment review")).toBeInTheDocument();
  });

  it("shows the loading state while consultations are being fetched", () => {
    hooks.useBookingList.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderQueue([]);

    fireEvent.click(screen.getByRole("tab", { name: /^consultations/i }));

    expect(screen.getByText(/loading consultations/i)).toBeInTheDocument();
  });

  it("shows the error state when consultations fail to load", () => {
    hooks.useBookingList.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderQueue([]);

    fireEvent.click(screen.getByRole("tab", { name: /^consultations/i }));

    expect(screen.getByText(/unable to load telemedicine consultations/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no upcoming consultations", () => {
    hooks.useBookingList.mockReturnValue({ data: { bookings: [] }, isLoading: false, isError: false });
    renderQueue([]);

    fireEvent.click(screen.getByRole("tab", { name: /^consultations/i }));

    expect(screen.getByText(/no upcoming consultations/i)).toBeInTheDocument();
  });
});

describe("review flags view", () => {
  it("shows the loading state", () => {
    hooks.useTechnicalIssues.mockReturnValue({ data: undefined, isLoading: true });
    renderQueue([]);

    fireEvent.click(screen.getByRole("tab", { name: /review flags/i }));

    expect(screen.getByText(/loading review flags/i)).toBeInTheDocument();
  });

  it("shows a retryable error state", () => {
    const refetch = vi.fn();
    hooks.useTechnicalIssues.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error(), refetch });
    renderQueue([]);

    fireEvent.click(screen.getByRole("tab", { name: /review flags/i }));

    expect(screen.getByText(/couldn't load technical issue reports/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows an empty state when there are no open reports", () => {
    hooks.useTechnicalIssues.mockReturnValue({ data: [], isLoading: false });
    renderQueue([]);

    fireEvent.click(screen.getByRole("tab", { name: /review flags/i }));

    expect(screen.getByText(/no open reports/i)).toBeInTheDocument();
  });
});

describe("mobile-safe rendering", () => {
  it("renders the action queue as a single responsive grid, not a fixed-width table that would force horizontal scroll", () => {
    const { container } = renderQueue([booking()]);

    // No literal <table>: the desktop/mobile layouts share one DOM tree (so PreferenceSummary
    // and each row's action component mount exactly once) and reflow via CSS grid columns
    // instead of swapping between two separately-rendered layouts.
    expect(container.querySelector("table")).not.toBeInTheDocument();
    const row = container.querySelector(".grid.grid-cols-1");
    expect(row).toBeInTheDocument();
    expect(row?.className).toMatch(/md:grid-cols-/);
  });
});
